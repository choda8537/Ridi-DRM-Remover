import os
import sys
from enum import Enum
from pathlib import Path


class BookFormat(Enum):
    EPUB = "epub"
    PDF = "pdf"

    @classmethod
    def from_path(cls, path: Path) -> "BookFormat":
        ext = path.suffix[1:].lower()
        if ext == "epub":
            return cls.EPUB
        if ext == "pdf":
            return cls.PDF
        raise ValueError(f"not a book file: {path}")

    def extension(self) -> str:
        return self.value


class FileKind(Enum):
    BOOK = "book"
    DATA = "data"


class BookInfo:
    def __init__(self, path: Path):
        self.path: Path = path
        self.id: str = path.name
        self.format: BookFormat = self._detect_format(path)

    def _detect_format(self, path: Path) -> BookFormat:
        for entry in path.iterdir():
            if entry.is_file():
                try:
                    return BookFormat.from_path(entry)
                except ValueError:
                    continue
        raise ValueError(f"Valid book file not found in: {path}")

    def get_file(self, kind: FileKind) -> Path:
        ext = self.format.extension() if kind == FileKind.BOOK else "dat"
        for entry in self.path.iterdir():
            if (
                entry.is_file()
                and entry.name.startswith(self.id)
                and entry.suffix.lower() == f".{ext}"
            ):
                return entry
        return self.path / f"{self.id}.{ext}"

    def file_name(self, kind: FileKind) -> str:
        if kind == FileKind.BOOK:
            return f"{self.id}.{self.format.extension()}"
        return self.get_file(kind).name


def library_path(user_idx: str) -> Path:
    if sys.platform == "darwin":
        home = Path(os.environ.get("HOME", "~")).expanduser()
        return (
            home
            / "Library"
            / "Application Support"
            / "Ridibooks"
            / "library"
            / f"_{user_idx}"
        )
    if sys.platform == "win32":
        appdata = Path(os.environ.get("APPDATA", ""))
        if not appdata or not appdata.exists():
            raise ValueError("APPDATA environment variable not found")
        return appdata / "Ridibooks" / "library" / f"_{user_idx}"
    raise NotImplementedError("library_path() not implemented for this OS")


def discover_books(path: Path) -> list[BookInfo]:
    if not path.exists():
        return []
    infos: list[BookInfo] = []
    for entry in path.iterdir():
        if entry.is_dir():
            try:
                infos.append(BookInfo(entry))
            except ValueError:
                continue
    return infos
