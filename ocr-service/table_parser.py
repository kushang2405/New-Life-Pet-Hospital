"""Turns OCR detections of a BIO or CBC analyser screen into result rows.

Both screens are fixed layouts. Words are grouped into rows by vertical
position, and cells are read left to right. CBC prints two panels side by
side, so each row is split at the boundary between the two "Para" columns.
"""
import re
from statistics import median

FLAGS = {'H', 'L'}
UI_WORDS = {
    'print', 'save', 'back', 'next', 'mode', 'validate', 'valldate', 'val',
    'sample', 'sample id', 'type', 'cat', 'dog', 'wbc info', 'rbc info', 'plt info',
    'name', 'gender', 'male', 'female', 'age', 'test time', 'time',
    'para', 'result', 'unit', 'edit result', 'edit', 'position/sum',
    'lymphocytosis', 'anemia', 'macrocytosis', 'mid increase', 'review', 'qc', 'reagent', 'diluent'
}
NAME_PATTERN = re.compile(r'^[A-Za-z][A-Za-z0-9#%/()\-]*$')
UNIT_PATTERN = re.compile(r'^[A-Za-zµμ%/^0-9.]{1,8}$')
RANGE_PATTERN = re.compile(r'\d+(?:\.\d+)?\s*[-–—~]{1,2}\s*\d+(?:\.\d+)?')
NUMBER_PATTERN = re.compile(r'[<>]?\s?[-+]?\d+(?:[.,]\d+)?')
SYMBOL_PATTERN = re.compile(r'\+{2,}|-{1,2}|[—–]{1,2}')
LOW_CONFIDENCE = 0.8

CBC_ROW_PAIRS = [
    ('WBC', 'MCV'),
    ('Lym#', 'MCH'),
    ('Mid#', 'MCHC'),
    ('Gran#', 'RDW-CV'),
    ('Lym%', 'RDW-SD'),
    ('Mid%', 'PLT'),
    ('Gran%', 'MPV'),
    ('NLR', 'PDW-CV'),
    ('PLR', 'PDW-SD'),
    ('RBC', 'PCT'),
    ('HGB', 'P-LCC'),
    ('HCT', 'P-LCR'),
]
CBC_LEFT_TO_RIGHT = dict(CBC_ROW_PAIRS)
CBC_RIGHT_TO_LEFT = {v: k for k, v in CBC_ROW_PAIRS}

CBC_ALIASES = {
    'wbc': 'WBC',
    'mcv': 'MCV',
    'lym#': 'Lym#',
    'lym': 'Lym#',
    'mch': 'MCH',
    'mid#': 'Mid#',
    'mid': 'Mid#',
    'mchc': 'MCHC',
    'gran#': 'Gran#',
    'gran': 'Gran#',
    'rdw-cv': 'RDW-CV',
    'rdw_cv': 'RDW-CV',
    'rdwcv': 'RDW-CV',
    'rdw': 'RDW-CV',
    'lym%': 'Lym%',
    'rdw-sd': 'RDW-SD',
    'rdw_sd': 'RDW-SD',
    'rdwsd': 'RDW-SD',
    'mid%': 'Mid%',
    'plt': 'PLT',
    'gran%': 'Gran%',
    'mpv': 'MPV',
    'nlr': 'NLR',
    'pdw-cv': 'PDW-CV',
    'pdw_cv': 'PDW-CV',
    'pdwcv': 'PDW-CV',
    'plr': 'PLR',
    'pdw-sd': 'PDW-SD',
    'pdw_sd': 'PDW-SD',
    'pdwsd': 'PDW-SD',
    'rbc': 'RBC',
    'pct': 'PCT',
    'hgb': 'HGB',
    'hb': 'HGB',
    'p-lcc': 'P-LCC',
    'p_lcc': 'P-LCC',
    'plcc': 'P-LCC',
    'hct': 'HCT',
    'p-lcr': 'P-LCR',
    'p_lcr': 'P-LCR',
    'plcr': 'P-LCR',
}

CBC_KNOWN_UNITS = {
    'WBC': '10^9/L',
    'MCV': 'fL',
    'Lym#': '10^9/L',
    'MCH': 'pg',
    'Mid#': '10^9/L',
    'MCHC': 'g/dL',
    'Gran#': '10^9/L',
    'RDW-CV': '',
    'Lym%': '%',
    'RDW-SD': 'fL',
    'Mid%': '%',
    'PLT': '10^9/L',
    'Gran%': '%',
    'MPV': 'fL',
    'NLR': '',
    'PDW-CV': '',
    'PLR': '',
    'PDW-SD': 'fL',
    'RBC': '10^12/L',
    'PCT': 'mL/L',
    'HGB': 'g/dL',
    'P-LCC': '10^9/L',
    'HCT': '%',
    'P-LCR': '',
}

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


def clean_cbc_unit(u_text, param_name=None):
    if not u_text:
        return CBC_KNOWN_UNITS.get(param_name, '')
    compact = re.sub(r'\s+', '', u_text)
    if re.fullmatch(r'10[\^A]?12/?L', compact, re.I) or compact == '1012/L':
        return '10^12/L'
    if re.fullmatch(r'10[\^A]?9/?L', compact, re.I) or compact == '109/L':
        return '10^9/L'
    if compact in ('%/%', '9/6', '/%', 'o/o', '0/0', '%'):
        return '%'
    if compact.lower() in ('fl', 'fi', 'f1'):
        return 'fL'
    if compact.lower() in ('pg', 'p9'):
        return 'pg'
    if compact.lower() in ('g/dl', 'g/d1', 'g/di'):
        return 'g/dL'
    if compact.lower() in ('ml/l', 'mi/l', 'm1/l'):
        return 'mL/L'
    return CBC_KNOWN_UNITS.get(param_name, u_text.strip())


def parse_cbc_panel(tokens, expected_name=None):
    if not tokens:
        return None

    # Filter out UI words and headers
    filtered = []
    for t in tokens:
        raw = t['text'].strip()
        low = raw.lower()
        if low in UI_WORDS or low in ('para', 'result', 'unit', 'edit', 'validate', 'val', 'next', 'previous'):
            continue
        filtered.append(t)
    if not filtered:
        return None

    filtered = sorted(filtered, key=lambda d: d['x'])

    # 1. Identify name
    name = None
    name_idx = -1
    for i, t in enumerate(filtered):
        raw = t['text'].strip()
        cl = re.sub(r'[^a-zA-Z0-9#%\-_]', '', raw).lower()
        if cl in CBC_ALIASES:
            candidate = CBC_ALIASES[cl]
            # Disambiguation if needed (e.g. 'lym' without # or %)
            if candidate in ('Lym#', 'Mid#', 'Gran#'):
                other_text = ' '.join(tok['text'] for j, tok in enumerate(filtered) if j != i)
                if any(p in other_text for p in ('%', '%/%', '9/6', 'o/o')):
                    candidate = candidate.replace('#', '%')
            name = candidate
            name_idx = i
            break

    if not name and expected_name:
        name = expected_name

    if not name:
        for i, t in enumerate(filtered):
            txt = t['text'].strip()
            if NAME_PATTERN.match(txt) and txt not in FLAGS and not NUMBER_PATTERN.fullmatch(txt):
                name = txt
                name_idx = i
                break

    if not name:
        return None

    remaining = [t for i, t in enumerate(filtered) if i != name_idx]
    if not remaining:
        return None

    flag = ''
    result = ''
    unit_tokens = []
    scores = [filtered[name_idx]['score']] if name_idx >= 0 else [0.9]

    for t in remaining:
        txt = t['text'].strip()
        scores.append(t['score'])

        # Standalone flag: 'H' or 'L'
        if txt in FLAGS and not flag:
            flag = txt
            continue

        # Flag + number, e.g. "H 22.06", "H22.06", "L 17.7", "L17.7"
        m1 = re.match(r'^([HL])\s*([<>]?\s?[-+]?\d+(?:[.,]\d+)?|\+{2,}|-{1,2}|[—–]{1,2})$', txt)
        if m1:
            if not flag:
                flag = m1.group(1)
            if not result:
                result = m1.group(2)
            continue

        # Number + flag, e.g. "22.06 H", "17.7 L"
        m2 = re.match(r'^([<>]?\s?[-+]?\d+(?:[.,]\d+)?)\s*([HL])$', txt)
        if m2:
            if not result:
                result = m2.group(1)
            if not flag:
                flag = m2.group(2)
            continue

        # Pure number / symbol
        if (NUMBER_PATTERN.fullmatch(txt) or SYMBOL_PATTERN.fullmatch(txt)) and not result:
            result = txt
            continue

        unit_tokens.append(txt)

    if not result:
        # Fallback: scan unit_tokens for embedded number
        for txt in list(unit_tokens):
            m = re.search(r'[<>]?\s?[-+]?\d+(?:[.,]\d+)?', txt)
            if m and not result:
                result = m.group(0).strip()
                if 'H' in txt and not flag:
                    flag = 'H'
                elif 'L' in txt and not flag:
                    flag = 'L'
                unit_tokens.remove(txt)
                break

    if not result:
        return None

    unit_str = ' '.join(unit_tokens)
    unit = clean_cbc_unit(unit_str, name)

    return {
        'name': name,
        'result': clean_result(result),
        'unit': unit,
        'referenceRange': '',
        'remarks': flag,
        'scores': scores,
    }


def parse_cbc_cells(tokens):
    return parse_cbc_panel(tokens)


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
        rows = group_rows(scoped)

        parsed_by_name = {}
        for row in rows:
            left_tokens = [d for d in row if d['x'] < split]
            right_tokens = [d for d in row if d['x'] >= split]

            lp = parse_cbc_panel(left_tokens)
            rp = parse_cbc_panel(right_tokens)

            # Cross-inference if one panel was recognized and the other wasn't
            if lp and not rp and right_tokens:
                expected_right = CBC_LEFT_TO_RIGHT.get(lp['name'])
                if expected_right:
                    rp = parse_cbc_panel(right_tokens, expected_name=expected_right)
            elif rp and not lp and left_tokens:
                expected_left = CBC_RIGHT_TO_LEFT.get(rp['name'])
                if expected_left:
                    lp = parse_cbc_panel(left_tokens, expected_name=expected_left)

            if lp:
                parsed_by_name[lp['name']] = lp
            if rp:
                parsed_by_name[rp['name']] = rp

        # Order line by line as on the analyser photo:
        # Line 1: WBC, MCV
        # Line 2: Lym#, MCH
        # Line 3: Mid#, MCHC
        # Line 4: Gran#, RDW-CV
        # Line 5: Lym%, RDW-SD
        # Line 6: Mid%, PLT
        # Line 7: Gran%, MPV
        # Line 8: NLR, PDW-CV
        # Line 9: PLR, PDW-SD
        # Line 10: RBC, PCT
        # Line 11: HGB, P-LCC
        # Line 12: HCT, P-LCR
        ordered = []
        for left_expected, right_expected in CBC_ROW_PAIRS:
            if left_expected in parsed_by_name:
                ordered.append(parsed_by_name[left_expected])
            if right_expected in parsed_by_name:
                ordered.append(parsed_by_name[right_expected])

        # Include any extra parameters not in standard 24 pairs
        for name, item in parsed_by_name.items():
            if item not in ordered:
                ordered.append(item)

        return [to_analyte(row, report_type) for row in ordered]
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
