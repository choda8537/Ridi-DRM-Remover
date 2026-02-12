import PyInstaller.__main__
import sys
from pathlib import Path


def main():
    src_dir = Path(__file__).parent
    main_script = src_dir / "main.py"

    if not main_script.exists():
        print(f"Error: Could not find main script at {main_script}")
        sys.exit(1)

    args = [
        str(main_script),
        "--onefile",
        "--name=ridi",
        "--clean",
        f"--paths={src_dir}",
    ]

    print(f"Running PyInstaller with args: {' '.join(args)}")
    PyInstaller.__main__.run(args)


if __name__ == "__main__":
    main()
