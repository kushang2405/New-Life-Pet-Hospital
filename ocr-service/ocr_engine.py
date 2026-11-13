from functools import lru_cache

import numpy as np


@lru_cache(maxsize=1)
def _engine():
    from paddleocr import PaddleOCR

    return PaddleOCR(
        lang='en',
        # The default medium models exceed the practical CPU/memory budget of
        # a small hosted instance. Mobile models are designed for this use.
        text_detection_model_name='PP-OCRv5_mobile_det',
        text_recognition_model_name='PP-OCRv5_mobile_rec',
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def warm_up_ocr() -> None:
    """Load the PaddleOCR model while the service starts, not on a request."""
    _engine()


def read_detections(image: np.ndarray) -> list[dict]:
    page = _engine().predict(image)[0]
    detections = []
    for text, score, polygon in zip(page['rec_texts'], page['rec_scores'], page['rec_polys']):
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
    return detections
