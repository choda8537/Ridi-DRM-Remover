import io
import re
import zipfile
from xml.etree import ElementTree as ET

from book import BookFormat


def extract_title(fmt: BookFormat, data: bytes) -> str | None:
    match fmt:
        case BookFormat.EPUB:
            return _extract_title_epub(data)
        case BookFormat.PDF:
            return _extract_title_pdf(data)


def _extract_title_epub(data: bytes) -> str | None:
    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            with zf.open("META-INF/container.xml") as f:
                container = ET.fromstring(f.read())

            namespaces = {"c": "urn:oasis:names:tc:opendocument:xmlns:container"}
            rootfile = container.find(".//c:rootfile", namespaces)
            if rootfile is None:
                return None

            opf_path = rootfile.attrib.get("full-path")
            if not opf_path:
                return None

            with zf.open(opf_path) as f:
                opf = ET.fromstring(f.read())

            ns = {
                "opf": "http://www.idpf.org/2007/opf",
                "dc": "http://purl.org/dc/elements/1.1/",
            }
            title_el = opf.find(".//dc:title", ns)
            if title_el is not None and title_el.text:
                return title_el.text.strip()

            for el in opf.iter():
                if el.tag.lower().endswith("title") and el.text:
                    return el.text.strip()
    except (zipfile.BadZipFile, KeyError, ET.ParseError):
        pass
    return None


def _extract_title_pdf(data: bytes) -> str | None:
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    try:
        reader = PdfReader(io.BytesIO(data))
        meta = reader.metadata
        if meta and getattr(meta, "title", None):
            return str(meta.title).strip()
    except Exception:
        pass
    return None


# Regex: Windows/filesystem-unsafe characters
_UNSAFE_CHARS = re.compile(r"[\\/:*?\"<>|]")
_WHITESPACE_RUN = re.compile(r"\s+")
_WINDOWS_RESERVED = frozenset(
    {
        "CON",
        "PRN",
        "AUX",
        "NUL",
        *(f"COM{i}" for i in range(1, 10)),
        *(f"LPT{i}" for i in range(1, 10)),
    }
)


def sanitize_filename(name: str, max_len: int = 120) -> str:
    name = _UNSAFE_CHARS.sub(" ", name.strip())
    name = _WHITESPACE_RUN.sub(" ", name).strip()
    if len(name) > max_len:
        name = name[:max_len].rstrip()
    if name.upper() in _WINDOWS_RESERVED:
        name = f"_{name}"
    return name or "untitled"
