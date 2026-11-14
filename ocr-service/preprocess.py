import cv2
import numpy as np

MIN_SIDE = 1600
MAX_SIDE = 2400
MAX_UPSCALE = 2.5


def decode_image(raw: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('The file is not a readable image.')
    return image


def _order_corners(points: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype='float32')
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).reshape(-1)
    rect[0] = points[np.argmin(sums)]
    rect[2] = points[np.argmax(sums)]
    rect[1] = points[np.argmin(diffs)]
    rect[3] = points[np.argmax(diffs)]
    return rect


def _find_page_quad(image: np.ndarray):
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.dilate(cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150), None, iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
        area = cv2.contourArea(contour)
        if area < 0.35 * width * height:
            break
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(approx) == 4 and cv2.isContourConvex(approx) and area < 0.97 * width * height:
            return approx.reshape(4, 2).astype('float32')
    return None


def _warp_to_quad(image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    rect = _order_corners(quad)
    top_left, top_right, bottom_right, bottom_left = rect
    width = int(max(np.linalg.norm(bottom_right - bottom_left), np.linalg.norm(top_right - top_left)))
    height = int(max(np.linalg.norm(top_right - bottom_right), np.linalg.norm(top_left - bottom_left)))
    target = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype='float32')
    matrix = cv2.getPerspectiveTransform(rect, target)
    return cv2.warpPerspective(image, matrix, (width, height))


def _scale_factor(longest: int) -> float:
    if longest > MAX_SIDE:
        return MAX_SIDE / longest
    if longest < MIN_SIDE:
        return min(MIN_SIDE / longest, MAX_UPSCALE)
    return 1.0


def prepare_image(image: np.ndarray) -> np.ndarray:
    quad = _find_page_quad(image)
    if quad is not None:
        image = _warp_to_quad(image, quad)

    scale = _scale_factor(max(image.shape[:2]))
    if scale != 1.0:
        interpolation = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=interpolation)

    image = cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)
    lightness, green_red, blue_yellow = cv2.split(cv2.cvtColor(image, cv2.COLOR_BGR2LAB))
    lightness = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lightness)
    return cv2.cvtColor(cv2.merge((lightness, green_red, blue_yellow)), cv2.COLOR_LAB2BGR)
