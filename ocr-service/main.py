import base64
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from ocr_engine import read_detections
from preprocess import decode_image, prepare_image
from table_parser import group_rows, merge_pages, parse_page

app = FastAPI(title='Report OCR')


class ReportImage(BaseModel):
    name: str = ''
    dataUrl: str = Field(min_length=20)


class ExtractRequest(BaseModel):
    reportType: Literal['BIO', 'CBC']
    images: list[ReportImage] = Field(min_length=1, max_length=10)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/extract')
def extract(request: ExtractRequest):
    pages = []
    raw_sections = []
    warnings = []
    for image in request.images:
        try:
            raw_b64 = image.dataUrl.split(',')[-1]
            source = decode_image(base64.b64decode(raw_b64))
            prepared = prepare_image(source)
            detections = read_detections(prepared)
            pages.append(parse_page(detections, prepared.shape[1], request.reportType))
            raw_sections.append('\n'.join(' '.join(d['text'] for d in row) for row in group_rows(detections)))
        except Exception as err:
            warnings.append(f'{image.name or "Photo"}: {err}')
            continue

    rows = merge_pages(pages)
    if not rows and not warnings:
        warnings.append('No result rows were found. Try a straighter, sharper photo of the whole table.')
    needs_review = sum(1 for row in rows if row.get('needsReview'))
    if needs_review:
        warnings.append(f'{needs_review} row(s) are highlighted because the reading was unclear. Please check them.')
    return {'rows': rows, 'warnings': warnings, 'rawText': '\n\n'.join(raw_sections)}
