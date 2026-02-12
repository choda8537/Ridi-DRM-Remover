import logging
from pathlib import Path

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from book import BookFormat, BookInfo, FileKind
from metadata import extract_title, sanitize_filename

logger = logging.getLogger("ridi")


def _is_valid_output(fmt: BookFormat, data: bytes) -> bool:
    match fmt:
        case BookFormat.EPUB:
            return data.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"))
        case BookFormat.PDF:
            return data.startswith(b"%PDF")


def decrypt_key(book_info: BookInfo, device_id: str, debug: bool = False) -> bytes:
    """Extract AES session key from the encrypted .dat file.

    Layout: first 16 bytes = IV, rest = AES-128-CBC ciphertext (PKCS7).
    The 16-byte session key sits at byte offset 68..84 of the plaintext.
    """
    data_path = book_info.get_file(FileKind.DATA)
    if not data_path.exists():
        raise FileNotFoundError(f"Missing data file: {data_path}")

    data = data_path.read_bytes()

    if debug:
        logger.debug("Data file: %s (%d bytes)", data_path, len(data))

    # first 16 bytes of device_id → AES key; first 16 bytes of .dat → IV
    key = device_id.encode("utf-8")[:16]
    iv = data[:16]

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(data[16:]) + decryptor.finalize()

    unpadder = padding.PKCS7(128).unpadder()
    plaintext = unpadder.update(decrypted) + unpadder.finalize()

    if len(plaintext) < 84:
        raise ValueError(f".dat plaintext too short: {len(plaintext)} bytes")

    # session key: 16 ASCII bytes at positions 68..84
    session_key = plaintext[68:84].decode("utf-8", errors="ignore").encode("utf-8")
    if len(session_key) != 16:
        raise ValueError("Invalid session key length")

    if debug:
        logger.debug("Session key: %s", session_key.hex())

    return session_key


def decrypt_book(book_info: BookInfo, key: bytes, debug: bool = False) -> bytes:
    """Decrypt the book file using the session key (AES-128-CBC + PKCS7).

    If the file already looks like a valid EPUB/PDF, it is returned as-is.
    """
    book_file_path = book_info.get_file(FileKind.BOOK)

    if not book_file_path.exists():
        raise FileNotFoundError(f"Book file not found: {book_file_path}")

    raw = book_file_path.read_bytes()

    if debug:
        logger.debug("Book file: %s (%d bytes)", book_file_path, len(raw))

    if _is_valid_output(book_info.format, raw):
        if debug:
            logger.debug("File already valid; returning as-is")
        return raw

    if len(raw) < 16:
        raise ValueError("Book file too small to contain IV")

    iv = raw[:16]
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(raw[16:]) + decryptor.finalize()

    unpadder = padding.PKCS7(128).unpadder()
    return unpadder.update(decrypted) + unpadder.finalize()


def decrypt_and_save(
    book_info: BookInfo,
    device_id: str,
    debug: bool = False,
    output_dir: Path | None = None,
) -> Path:
    key = decrypt_key(book_info, device_id, debug)
    content = decrypt_book(book_info, key, debug)

    title = extract_title(book_info.format, content)
    if title:
        out_name = f"{sanitize_filename(title)}.{book_info.format.extension()}"
    else:
        out_name = book_info.file_name(FileKind.BOOK)

    out_dir = output_dir or Path.cwd()
    target = out_dir / out_name

    if target.exists():
        stem, suffix = target.stem, target.suffix
        i = 1
        while target.exists() and i < 1000:
            target = out_dir / f"{stem} ({i}){suffix}"
            i += 1

    target.write_bytes(content)
    if debug:
        logger.debug("Wrote output: %s", target)
    return target


def decrypt_with_progress(
    book_info: BookInfo,
    device_id: str,
    debug: bool = False,
    output_dir: Path | None = None,
) -> bool:
    file_name = book_info.file_name(FileKind.BOOK)

    print(f'\r\u28ff Decrypting "{file_name}"', end="", flush=True)

    try:
        decrypt_and_save(book_info, device_id, debug, output_dir)
        print(f'\r\u28ff Decrypting "{file_name}" \u2714\ufe0e')
        return True
    except Exception as e:
        print(f'\r\u28ff Decrypting "{file_name}" \u2718')
        if debug:
            logger.error("Error decrypting %s: %s", book_info.id, e)
        return False
