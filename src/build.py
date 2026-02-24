from pathlib import Path
import PyInstaller.__main__

def main():
    src_dir = Path(__file__).parent
    main_script = src_dir / "main.py"
    
    if not main_script.exists():
        print(f"Error: main.py not found at {main_script}")
        return 1

    args = [
        str(main_script),
        "--onefile",
        "--name=ridi",
        "--windowed",
        # "--icon=app.ico",
        # "--add-data=assets;assets",
    ]

    print("Building:", " ".join(args))
    PyInstaller.__main__.run(args)
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main() or 0)