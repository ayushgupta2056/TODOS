"""Image decoding, orientation, resizing, WebP derivatives, EXIF timestamps and blurhash."""

from __future__ import annotations

import io
import math
from dataclasses import dataclass
from datetime import UTC, datetime

import cv2
import numpy as np
import numpy.typing as npt
from PIL import Image, ImageDraw, ImageFont, ImageOps

from glimpse_worker.engine import BGRImage

Image.MAX_IMAGE_PIXELS = 200_000_000  # large camera files are fine, decompression bombs are not

_EXIF_DATETIME_ORIGINAL = 0x9003
_EXIF_DATETIME = 0x0132
_EXIF_IFD = 0x8769


class ImageDecodeError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class DecodedImage:
    pil: Image.Image  # RGB, orientation fixed (possibly decoded at reduced scale, see `decode`)
    taken_at: datetime | None
    width: int  # full-resolution, oriented
    height: int


def decode(data: bytes, max_edge: int | None = None) -> DecodedImage:
    """Decode + fix EXIF orientation. With `max_edge`, JPEGs are decoded at a reduced DCT scale
    (never below `max_edge` on the long side): a 24 MP file decodes ~4x faster."""
    try:
        opened = Image.open(io.BytesIO(data))
        full_w, full_h = opened.size
        if max_edge and opened.format == "JPEG":
            opened.draft("RGB", (max_edge, max_edge))
        opened.load()
    except Exception as exc:  # Pillow raises many types
        raise ImageDecodeError(f"cannot decode image: {exc}") from exc
    taken_at = _exif_taken_at(opened)
    rotated = _exif_orientation(opened) in (5, 6, 7, 8)
    img: Image.Image = ImageOps.exif_transpose(opened) or opened
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = (full_h, full_w) if rotated else (full_w, full_h)
    return DecodedImage(pil=img, taken_at=taken_at, width=w, height=h)


def _exif_orientation(img: Image.Image) -> int:
    try:
        return int(img.getexif().get(0x0112, 1))
    except Exception:
        return 1


def _exif_taken_at(img: Image.Image) -> datetime | None:
    try:
        exif = img.getexif()
    except Exception:
        return None
    raw = None
    try:
        raw = exif.get_ifd(_EXIF_IFD).get(_EXIF_DATETIME_ORIGINAL)
    except Exception:
        raw = None
    raw = raw or exif.get(_EXIF_DATETIME)
    if not isinstance(raw, str):
        return None
    try:
        # EXIF has no timezone; store as UTC-naive-interpreted value.
        return datetime.strptime(raw.strip("\x00 "), "%Y:%m:%d %H:%M:%S").replace(tzinfo=UTC)
    except ValueError:
        return None


def resized(img: Image.Image, long_edge: int) -> Image.Image:
    w, h = img.size
    scale = long_edge / max(w, h)
    if scale >= 1.0:
        return img
    return img.resize(
        (max(1, round(w * scale)), max(1, round(h * scale))),
        Image.Resampling.LANCZOS,
        reducing_gap=3.0,
    )


def to_bgr(img: Image.Image) -> BGRImage:
    arr = np.asarray(img, dtype=np.uint8)
    return np.asarray(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR), dtype=np.uint8)


def resize_bgr(img: BGRImage, long_edge: int) -> tuple[BGRImage, float]:
    """Downscale so the long edge is at most `long_edge`. Returns (image, scale applied)."""
    h, w = img.shape[:2]
    scale = long_edge / max(w, h)
    if scale >= 1.0:
        return img, 1.0
    out = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    return out.astype(np.uint8), scale


def webp_bytes(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=2)
    return buf.getvalue()


def watermark(img: Image.Image, text: str) -> Image.Image:
    """A restrained corner watermark: small caps text, low-opacity paper colour."""
    base = img.convert("RGBA")
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    size = max(14, base.width // 45)
    try:
        font: ImageFont.FreeTypeFont | ImageFont.ImageFont = ImageFont.load_default(size=size)
    except TypeError:
        font = ImageFont.load_default()
    label = text.upper()
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    margin = max(12, base.width // 60)
    pos = (base.width - tw - margin, base.height - th - margin * 1.3)
    draw.text((pos[0] + 1, pos[1] + 1), label, font=font, fill=(14, 12, 10, 90))
    draw.text(pos, label, font=font, fill=(243, 237, 228, 170))
    return Image.alpha_composite(base, layer).convert("RGB")


def laplacian_variance(bgr: BGRImage) -> float:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


# --- blurhash (encoder only; https://github.com/woltapp/blurhash, MIT algorithm) -------------

_B83 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"


def _b83(value: int, length: int) -> str:
    return "".join(_B83[(value // (83 ** (length - i - 1))) % 83] for i in range(length))


def _srgb_to_linear(v: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    v = v / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(v: float) -> int:
    v = max(0.0, min(1.0, v))
    if v <= 0.0031308:
        return int(v * 12.92 * 255 + 0.5)
    return int((1.055 * v ** (1 / 2.4) - 0.055) * 255 + 0.5)


def _sign_pow(v: float, exp: float) -> float:
    return math.copysign(abs(v) ** exp, v)


def blurhash(img: Image.Image, cx: int = 4, cy: int = 3) -> str:
    small = np.asarray(img.convert("RGB").resize((32, 32)), dtype=np.float64)
    lin = _srgb_to_linear(small)
    h, w = lin.shape[:2]
    xs = np.arange(w)
    ys = np.arange(h)
    factors: list[npt.NDArray[np.float64]] = []
    for j in range(cy):
        for i in range(cx):
            basis = np.outer(np.cos(math.pi * j * ys / h), np.cos(math.pi * i * xs / w))
            norm = 1.0 if (i == 0 and j == 0) else 2.0
            factors.append(norm * (lin * basis[:, :, None]).sum(axis=(0, 1)) / (w * h))
    dc, ac = factors[0], factors[1:]
    out = _b83((cx - 1) + (cy - 1) * 9, 1)
    if ac:
        actual_max = float(max(np.abs(a).max() for a in ac))
        q_max = max(0, min(82, math.floor(actual_max * 166 - 0.5)))
        max_val = (q_max + 1) / 166
        out += _b83(q_max, 1)
    else:
        max_val = 1.0
        out += _b83(0, 1)
    out += _b83(
        (_linear_to_srgb(dc[0]) << 16) + (_linear_to_srgb(dc[1]) << 8) + _linear_to_srgb(dc[2]), 4
    )
    for a in ac:
        q = [max(0, min(18, math.floor(_sign_pow(float(c) / max_val, 0.5) * 9 + 9.5))) for c in a]
        out += _b83(q[0] * 19 * 19 + q[1] * 19 + q[2], 2)
    return out
