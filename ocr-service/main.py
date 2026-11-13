import base64
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from ocr_engine import read_detections, warm_up_ocr
from preprocess import decode_image, prepare_image
from table_parser import group_rows, merge_pages, parse_page

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    # PaddleOCR lazily downloads/loads its models. Do that at Render startup
    # so Netlify's short request timeout is not spent initializing OCR.
    warm_up_ocr()
    yield


app = FastAPI(title='Report OCR', lifespan=lifespan)


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
    for image in request.images:
        try:
            source = decode_image(base64.b64decode(image.dataUrl.split(',')[-1]))
        except ValueError as err:
            raise HTTPException(status_code=400, detail=f'{image.name or "Image"}: {err}')
        try:
            prepared = prepare_image(source)
            detections = read_detections(prepared)
            pages.append(parse_page(detections, prepared.shape[1], request.reportType))
            raw_sections.append('\n'.join(' '.join(d['text'] for d in row) for row in group_rows(detections)))
        except Exception as err:
            logger.exception('OCR processing failed for %s', image.name or 'uploaded image')
            raise HTTPException(
                status_code=500,
                detail=f'{image.name or "Image"}: OCR processing failed ({type(err).__name__}: {err})',
            ) from err

    rows = merge_pages(pages)
    warnings = []
    if not rows:
        warnings.append('No result rows were found. Try a straighter, sharper photo of the whole table.')
    needs_review = sum(1 for row in rows if row['needsReview'])
    if needs_review:
        warnings.append(f'{needs_review} row(s) are highlighted because the reading was unclear. Please check them.')
    return {'rows': rows, 'warnings': warnings, 'rawText': '\n\n'.join(raw_sections)}
