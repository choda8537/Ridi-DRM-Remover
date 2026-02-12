import shutil
import unicodedata


def display_width(text: str) -> int:
    width = 0
    for char in text:
        if unicodedata.east_asian_width(char) in ("F", "W"):
            width += 2
        else:
            width += 1
    return width


def truncate_text(text: str, max_width: int) -> str:
    if max_width < 3:
        return ""

    current_width = 0
    result: list[str] = []

    for char in text:
        char_width = 2 if unicodedata.east_asian_width(char) in ("F", "W") else 1

        if current_width + char_width > max_width - 2:
            result.append("..")
            break

        result.append(char)
        current_width += char_width

    return "".join(result)


def get_terminal_width() -> int:
    return shutil.get_terminal_size().columns
