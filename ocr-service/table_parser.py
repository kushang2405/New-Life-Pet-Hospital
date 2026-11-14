"""Turns OCR detections of a BIO or CBC analyser screen into result rows.

Both screens are fixed layouts. Words are grouped into rows by vertical
position, and cells are read left to right. CBC prints two panels side by
side, so each row is split at the boundary between the two "Para" columns.
"""
import re
from statistics import median

FLAGS = {'H', 'L'}
UI_WORDS = {'print', 'save', 'back', 'next', 'mode', 'validate', 'sample'}
NAME_PATTERN = re.compile(r'^[A-Za-z][A-Za-z0-9#%/()\-]*$')
UNIT_PATTERN = re.compile(r'^[A-Za-zµμ%/^0-9.]{1,8}$')
RANGE_PATTERN = re.compile(r'\d+(?:\.\d+)?\s*[-–—~]{1,2}\s*\d+(?:\.\d+)?')
NUMBER_PATTERN = re.compile(r'[<>]?\s?[-+]?\d+(?:[.,]\d+)?')
SYMBOL_PATTERN = re.compile(r'\+{2,}|-{1,2}|[—–]{1,2}')
LOW_CONFIDENCE = 0.8

BIO_ALIASES = {
    'TP': 'Total protein', 'ALB': 'Albumin', 'GLOB': 'Globulin', 'A/G': 'A/G Ratio',
    'TB': 'Total bilirubin', 'DB': 'Direct bilirubin', 'IBIL': 'Indirect bilirubin',
    'GGT': 'Gamma-glutamyl transpeptidase (GGT)', 'AST': 'Aspartate aminotransferase (AST)',
    'ALT': 'Alanine Transaminase (ALT)', 'UREA': 'Urea', 'Crea': 'Creatinine',
    'UA': 'Uric Acid', 'U/C': 'U/C Ratio',
}
BIO_SECTION_GROUPS = {
    'Liver Profile': ['Total protein', 'Albumin', 'Globulin', 'A/G Ratio', 'Total bilirubin', 'Direct bilirubin',
                      'Indirect bilirubin', 'Gamma-glutamyl transpeptidase (GGT)',
                      'Aspartate aminotransferase (AST)', 'Alanine Transaminase (ALT)', 'ALP', 'TBA', 'CHE'],
    'Kidney Profile': ['Urea', 'Creatinine', 'Uric Acid', 'U/C Ratio', 'eGFRcr'],
    'Pancreatic Profile': ['AMY'],
    'Lipid Profile': ['TC', 'TG', 'HDL', 'LDL'],
}
BIO_SECTIONS = {name: section for section, names in BIO_SECTION_GROUPS.items() for name in names}


def group_rows(detections):
    if not detections:
        return []
    tolerance = max(median(d['h'] for d in detections) * 0.6, 4)
    rows = []
    for det in sorted(detections, key=lambda d: d['y']):
        if rows and abs(det['y'] - rows[-1]['y']) <= tolerance:
            rows[-1]['items'].append(det)
            rows[-1]['y'] = sum(item['y'] for item in rows[-1]['items']) / len(rows[-1]['items'])
        else:
            rows.append({'y': det['y'], 'items': [det]})
    return [sorted(row['items'], key=lambda d: d['x']) for row in rows]


def cbc_boundaries(detections, width):
    para_xs = sorted(d['x'] for d in detections if d['text'].strip().lower() == 'para')
    unit_xs = sorted(d['x'] for d in detections if d['text'].strip().lower() == 'unit')
    if len(para_xs) >= 2 and unit_xs:
        return (unit_xs[0] + para_xs[1]) / 2, unit_xs[-1] + 0.06 * width
    return width / 2, width


def merge_symbols(tokens):
    merged = []
    for token in tokens:
        if merged and merged[-1]['text'] in ('<', '>'):
            prev = merged.pop()
            merged.append({**token, 'text': f"{prev['text']} {token['text']}", 'score': min(prev['score'], token['score'])})
        else:
            merged.append(token)
    return merged


def is_result(text):
    return bool(NUMBER_PATTERN.fullmatch(text) or SYMBOL_PATTERN.fullmatch(text))


def clean_result(text):
    return re.sub(r'\s+', ' ', text).strip()


def normalize_range(text):
    return re.sub(r'\s*[-–—~]{1,2}\s*', '-', re.sub(r'\s+', ' ', text).strip())


def normalize_unit(text):
    compact = re.sub(r'\s+', '', text)
    if re.fullmatch(r'10[\^A]?12/?L', compact):
        return '10^12/L'
    if re.fullmatch(r'10[\^A]?9/?L', compact):
        return '10^9/L'
    return text.strip()


def parse_cbc_cells(tokens):
    tokens = merge_symbols(tokens)
    if len(tokens) < 2 or not NAME_PATTERN.match(tokens[0]['text']):
        return None
    rest = tokens[1:]
    flag = ''
    if rest[0]['text'] in FLAGS:
        flag = rest[0]['text']
        rest = rest[1:]
    if not rest or not is_result(rest[0]['text']):
        return None
    unit = normalize_unit(' '.join(t['text'] for t in rest[1:]))
    return {
        'name': tokens[0]['text'], 'result': clean_result(rest[0]['text']), 'unit': unit,
        'referenceRange': '', 'remarks': flag, 'scores': [t['score'] for t in tokens],
    }


def parse_bio_cells(tokens):
    tokens = merge_symbols(tokens)
    if len(tokens) < 2 or not NAME_PATTERN.match(tokens[0]['text']):
        return None
    if tokens[0]['text'].lower() in UI_WORDS:
        return None
    if not is_result(tokens[1]['text']):
        return None
    rest = tokens[2:]
    flag = ''
    if rest and rest[0]['text'] in FLAGS:
        flag = rest[0]['text']
        rest = rest[1:]
    text = ' '.join(t['text'] for t in rest)
    match = RANGE_PATTERN.search(text)
    reference = normalize_range(match.group(0)) if match else ''
    before = text[:match.start()].strip() if match else ''
    unit = before if UNIT_PATTERN.match(before) and before.lower() not in UI_WORDS else ''
    return {
        'name': tokens[0]['text'], 'result': clean_result(tokens[1]['text']), 'unit': unit,
        'referenceRange': reference, 'remarks': flag, 'scores': [t['score'] for t in tokens],
    }


def to_analyte(row, report_type):
    if report_type == 'BIO':
        name = BIO_ALIASES.get(row['name'], row['name'])
        section = BIO_SECTIONS.get(name, 'Other')
    else:
        name = row['name']
        section = 'CBC'
    scores = row['scores']
    return {
        'section': section,
        'name': name,
        'result': row['result'],
        'unit': row['unit'],
        'referenceRange': row['referenceRange'],
        'remarks': row['remarks'],
        'confidence': round(sum(scores) / len(scores), 3),
        'needsReview': min(scores) < LOW_CONFIDENCE or not re.search(r'\d', row['result']),
    }


def parse_page(detections, width, report_type):
    if report_type == 'CBC':
        split, right_edge = cbc_boundaries(detections, width)
        scoped = [d for d in detections if d['x'] <= right_edge]
        panels = []
        for row in group_rows(scoped):
            panels.append([d for d in row if d['x'] < split])
            panels.append([d for d in row if d['x'] >= split])
        parsed = [parse_cbc_cells(panel) for panel in panels if panel]
    else:
        parsed = [parse_bio_cells(row) for row in group_rows(detections)]
    return [to_analyte(row, report_type) for row in parsed if row]


def merge_pages(pages):
    seen = set()
    rows = []
    for page in pages:
        for row in page:
            key = row['name'].lower()
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows
