from functools import lru_cache

import numpy as np


@lru_cache(maxsize=1)
def _engine():
    from paddleocr import PaddleOCR

    return PaddleOCR(
        lang='en',
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def read_detections(image: np.ndarray) -> list[dict]:
    try:
        results = _engine().predict(image)
        if not results:
            return []
        page = results[0]
    except Exception:
        return []

    detections = []
    rec_texts = page.get('rec_texts', []) if isinstance(page, dict) else []
    rec_scores = page.get('rec_scores', []) if isinstance(page, dict) else []
    rec_polys = page.get('rec_polys', []) if isinstance(page, dict) else []

    for text, score, polygon in zip(rec_texts, rec_scores, rec_polys):
        try:
            points = np.asarray(polygon, dtype=float)
            text = str(text).strip()
            if not text:
                continue
            detections.append({
                'text': text,
                'score': float(score),
                'x': float(points[:, 0].mean()),
                'y': float(points[:, 1].mean()),
                'h': float(points[:, 1].max() - points[:, 1].min()),
            })
        except Exception:
            continue
    return detections
