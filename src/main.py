import argparse
import json
import logging
import sys
import urllib.parse
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import cast

from book import BookInfo, FileKind, discover_books, library_path
from crypto import decrypt_book, decrypt_key, decrypt_with_progress
from metadata import extract_title
from models import ConfigData, UserData, UserDevice, UserDevices
from table import display_width, get_terminal_width, truncate_text

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("ridi")

CONFIG_FILE = Path.home() / ".ridi_auth.json"
RIDI_LOGIN_URL = "https://ridibooks.com/account/login"
RIDI_USER_DEVICES_API = "https://account.ridibooks.com/api/user-devices/app"


def _get_available_books(user_idx: str) -> list[BookInfo]:
    lib_path = library_path(user_idx)
    if not lib_path.exists():
        logger.error("Library path not found for user %s: %s", user_idx, lib_path)
        return []

    infos = [b for b in discover_books(lib_path) if b.get_file(FileKind.DATA).exists()]
    if not infos:
        logger.warning("No books found in library.")
    return infos


def _filter_by_id(infos: list[BookInfo], id_filter: str | None) -> list[BookInfo]:
    if not id_filter:
        return infos
    filtered = [b for b in infos if b.id == id_filter]
    if not filtered:
        logger.warning("No books found with ID: %s", id_filter)
    return filtered


def _filter_by_name(
    infos: list[BookInfo], device_id: str, name_filter: str | None
) -> list[BookInfo]:
    if not name_filter:
        return infos

    logger.info("Scanning books to match title...")
    matched: list[BookInfo] = []
    for book in infos:
        try:
            key = decrypt_key(book, device_id)
            content = decrypt_book(book, key)
            title = extract_title(book.format, content)
            if title and name_filter in title:
                matched.append(book)
        except Exception:
            continue
    return matched


class ConfigManager:
    def __init__(self, config_path: Path):
        self.config_path: Path = config_path
        self.config: ConfigData = self._load()

    def _load(self) -> ConfigData:
        if not self.config_path.exists():
            return {"users": [], "active_user": None}
        try:
            return cast(
                ConfigData,
                json.loads(self.config_path.read_text(encoding="utf-8")),
            )
        except json.JSONDecodeError, OSError:
            return {"users": [], "active_user": None}

    def save(self) -> None:
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            self.config_path.write_text(
                json.dumps(self.config, indent=2, ensure_ascii=False), encoding="utf-8"
            )
        except OSError as e:
            logger.error("Failed to save config: %s", e)

    def add_user(
        self,
        user_idx: str,
        device_id: str,
        device_name: str | None,
    ) -> None:
        for user in self.config["users"]:
            if user["user_idx"] == str(user_idx) and user["device_id"] == device_id:
                user["device_name"] = device_name or "Unknown Device"
                self.config["active_user"] = self._make_id(user_idx, device_id)
                self.save()
                return

        new_user: UserData = {
            "id": self._make_id(user_idx, device_id),
            "user_idx": user_idx,
            "device_id": device_id,
            "device_name": device_name or "Unknown Device",
        }
        self.config["users"].append(new_user)
        self.config["active_user"] = new_user["id"]
        self.save()

    def _make_id(self, user_idx: str, device_id: str) -> str:
        return f"{user_idx}_{device_id[:8]}"

    def get_active_user(self) -> UserData | None:
        if not self.config["active_user"]:
            return None
        for user in self.config["users"]:
            if user["id"] == self.config["active_user"]:
                return user
        return None

    def switch_user(self, user_id: str) -> bool:
        for user in self.config["users"]:
            if user["id"] == user_id:
                self.config["active_user"] = user_id
                self.save()
                return True
        return False

    def remove_user(self, user_id: str) -> bool:
        initial_len = len(self.config["users"])
        self.config["users"] = [u for u in self.config["users"] if u["id"] != user_id]
        if len(self.config["users"]) < initial_len:
            if self.config["active_user"] == user_id:
                self.config["active_user"] = (
                    self.config["users"][0]["id"] if self.config["users"] else None
                )
            self.save()
            return True
        return False

    def list_users(self) -> list[UserData]:
        return self.config["users"]


class AuthCommand:
    def __init__(self, config_mgr: ConfigManager):
        self.config_mgr: ConfigManager = config_mgr

    def login(self) -> None:
        callback_url = RIDI_USER_DEVICES_API
        state_payload = json.dumps({"return_url": callback_url}, separators=(",", ":"))
        state_q = urllib.parse.quote(state_payload)
        target_url = f"{RIDI_LOGIN_URL}?state={state_q}"

        logger.info("Opening browser to: %s", target_url)
        logger.info("\n=== Login Instructions ===")
        logger.info("1. Log in to Ridi Books in the opened browser window.")
        logger.info(
            "2. After logging in, you will be redirected to a page showing JSON text (device list)."
        )
        logger.info("3. Copy ALL the JSON text displayed on that page.")
        logger.info("4. Paste it below and press Enter.")

        webbrowser.open(target_url)

        try:
            print("\nPaste JSON > ", end="", flush=True)
            json_input = sys.stdin.readline().strip()
        except KeyboardInterrupt:
            return

        if not json_input:
            logger.warning("No data entered.")
            return

        self._process_device_list(json_input)

    @staticmethod
    def _format_last_used(last_used_raw: str | None) -> str:
        if not last_used_raw:
            return "N/A"
        try:
            dt = datetime.fromisoformat(last_used_raw.replace("Z", "+00:00"))
            return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S")
        except ValueError, TypeError:
            return last_used_raw

    def _display_devices(self, devices: list[UserDevice]) -> None:
        terminal_width = get_terminal_width()

        # Fixed widths: No.(4) + spaces(3*1) + margin(5)
        fixed_width = 4 + 3 + 5
        # Device ID and Code are fixed
        device_id_width = 40
        code_width = 10

        # Distribute remaining space between Device Name and Last Used
        remaining = max(terminal_width - fixed_width - device_id_width - code_width, 30)
        device_name_width = max(int(remaining * 0.4), 15)
        last_used_width = max(remaining - device_name_width, 15)

        print("\nSelect the device you are using for this machine:")
        print(
            f"{'No.':<4} {'Device Name':<{device_name_width}} {'Device ID':<{device_id_width}} {'Code':<{code_width}} {'Last Used':<{last_used_width}}"
        )
        print(
            "-"
            * min(
                terminal_width,
                4
                + device_name_width
                + device_id_width
                + code_width
                + last_used_width
                + 4,
            )
        )

        for idx, dev in enumerate(devices):
            last_used = self._format_last_used(dev.get("last_used"))
            device_name_raw = dev.get("device_nick", "Unknown")
            device_id = dev.get("device_id")

            device_name = truncate_text(device_name_raw, device_name_width)
            device_id_display = truncate_text(device_id, device_id_width)
            last_used_display = truncate_text(last_used, last_used_width)

            device_name_padded = device_name + " " * (
                device_name_width - display_width(device_name)
            )
            device_id_padded = device_id_display + " " * (
                device_id_width - display_width(device_id_display)
            )
            last_used_padded = last_used_display + " " * (
                last_used_width - display_width(last_used_display)
            )

            print(
                f"{idx + 1:<4} {device_name_padded} {device_id_padded} {dev.get('device_code'):<{code_width}} {last_used_padded}"
            )
        print(
            "-"
            * min(
                terminal_width,
                4
                + device_name_width
                + device_id_width
                + code_width
                + last_used_width
                + 4,
            )
        )

        for idx, dev in enumerate(devices):
            last_used = self._format_last_used(dev.get("last_used"))
            device_name = (
                (dev.get("device_nick", "Unknown")[: device_name_width - 2] + "..")
                if len(dev.get("device_nick", "Unknown")) > device_name_width
                else dev.get("device_nick", "Unknown")
            )
            device_id = dev.get("device_id")
            device_id_display = (
                (device_id[: device_id_width - 2] + "..")
                if len(device_id) > device_id_width
                else device_id
            )
            last_used_display = (
                (last_used[: last_used_width - 2] + "..")
                if len(last_used) > last_used_width
                else last_used
            )

            print(
                f"{idx + 1:<4} {device_name:<{device_name_width}} {device_id_display:<{device_id_width}} {dev.get('device_code'):<{code_width}} {last_used_display:<{last_used_width}}"
            )

    @staticmethod
    def _select_device(devices: list[UserDevice]) -> UserDevice:
        while True:
            try:
                line = input("\nEnter number: ")
                sel = int(line)
                if 1 <= sel <= len(devices):
                    return devices[sel - 1]
                logger.warning("Invalid selection.")
            except ValueError:
                logger.warning("Please enter a number.")

    def _process_device_list(self, json_str: str) -> None:
        try:
            if not json_str.startswith("{"):
                start = json_str.find("{")
                if start != -1:
                    json_str = json_str[start:]

            data = cast(UserDevices, json.loads(json_str))
            devices = data.get("user_devices", [])

            if not devices:
                logger.error("No devices found in the provided JSON.")
                return

            self._display_devices(devices)
            target = self._select_device(devices)

            user_idx = str(target.get("user_idx"))
            device_id = target.get("device_id")
            device_name = target.get("device_nick")

            if user_idx and device_id:
                self.config_mgr.add_user(user_idx, device_id, device_name)
                logger.info(
                    "Successfully added user %s (Device: %s)", user_idx, device_id
                )
            else:
                logger.error("Error: Invalid device data in selection.")

        except json.JSONDecodeError:
            logger.error(
                "Invalid JSON format. Please ensure you copied the text correctly."
            )
        except Exception as e:
            logger.error("Error processing data: %s", e)

    def switch(self) -> None:
        users = self.config_mgr.list_users()
        if not users:
            logger.info("No users found.")
            return

        print("\nRegistered Users:")
        for idx, user in enumerate(users):
            is_active = user["id"] == self.config_mgr.config.get("active_user")
            active = "*" if is_active else " "
            print(f"{active} {idx + 1}. {user['user_idx']} ({user['device_name']})")

        try:
            sel = int(input("\nSelect user to switch to: "))
            if 1 <= sel <= len(users):
                target_user = users[sel - 1]
                if self.config_mgr.switch_user(target_user["id"]):
                    logger.info("Switched to user %s", target_user["user_idx"])
            else:
                logger.warning("Invalid selection.")
        except ValueError:
            logger.error("Invalid input.")

    def list_accounts(self) -> None:
        users = self.config_mgr.list_users()
        if not users:
            logger.info("No users found.")
            return
        print("\nRegistered Users:")
        for user in users:
            is_active = user["id"] == self.config_mgr.config.get("active_user")
            active = "*" if is_active else " "
            print(
                f"{active} [{user['id']}] User: {user['user_idx']}, Device: {user['device_name']}"
            )

    def logout(self) -> None:
        active_user_id = self.config_mgr.config.get("active_user")
        if not active_user_id:
            logger.info("No active user.")
            return
        if self.config_mgr.remove_user(active_user_id):
            logger.info("User removed.")
        else:
            logger.error("Failed to remove user.")


class BooksCommand:
    def __init__(self, config_mgr: ConfigManager):
        self.config_mgr: ConfigManager = config_mgr

    def run(self, name_filter: str | None = None, id_filter: str | None = None) -> None:
        active = self.config_mgr.get_active_user()
        if not active:
            logger.error("No active user. Please login first.")
            return

        user_idx = active["user_idx"]
        device_id = active["device_id"]

        try:
            infos = _get_available_books(user_idx)
            if not infos:
                return

            infos = _filter_by_id(infos, id_filter)
            if not infos:
                return

            results = self._scan_book_titles(infos, device_id, name_filter)
            if not results:
                logger.warning("No books matched criteria.")
                return

            self._display_books(results)

        except Exception as e:
            logger.error("Error: %s", e)

    @staticmethod
    def _scan_book_titles(
        infos: list[BookInfo],
        device_id: str,
        name_filter: str | None,
    ) -> list[tuple[str, str]]:
        results: list[tuple[str, str]] = []
        logger.info("Scanning %d books for metadata...", len(infos))

        for i, book in enumerate(infos):
            try:
                print(
                    f"\rProcessing {i + 1}/{len(infos)}: {book.id}",
                    end="",
                    file=sys.stderr,
                )

                key = decrypt_key(book, device_id)
                content = decrypt_book(book, key)
                title = extract_title(book.format, content) or "Unknown Title"

                if name_filter and name_filter not in title:
                    continue

                results.append((book.id, title))
            except Exception as e:
                if not name_filter:
                    results.append((book.id, f"[Error: {e}]"))

        print("\r" + " " * 50 + "\r", end="", file=sys.stderr)
        return results

    @staticmethod
    def _display_books(results: list[tuple[str, str]]) -> None:
        terminal_width = get_terminal_width()

        id_width = 12
        separator_width = 3

        title_width = max(terminal_width - id_width - separator_width - 5, 30)

        print(f"{'ID':<{id_width}} | {'Title'}")
        print("-" * min(terminal_width, id_width + separator_width + title_width))

        for bid, btitle in results:
            title_display = truncate_text(btitle, title_width)
            print(f"{bid:<{id_width}} | {title_display}")


class ExportCommand:
    def __init__(self, config_mgr: ConfigManager):
        self.config_mgr: ConfigManager = config_mgr

    def run(
        self,
        output_dir: str,
        name_filter: str | None = None,
        id_filter: str | None = None,
    ) -> None:
        active = self.config_mgr.get_active_user()
        if not active:
            logger.error("No active user. Please login first.")
            return

        user_idx = active["user_idx"]
        device_id = active["device_id"]

        try:
            infos = _get_available_books(user_idx)
            if not infos:
                return

            candidates = _filter_by_id(infos, id_filter)
            if not candidates:
                return

            candidates = _filter_by_name(candidates, device_id, name_filter)
            if not candidates:
                logger.warning("No books found matching criteria.")
                return

            logger.info("Found %d books. Preparing to export...", len(candidates))
            out_path = Path(output_dir)
            out_path.mkdir(parents=True, exist_ok=True)

            success_count = sum(
                1
                for b in candidates
                if decrypt_with_progress(b, device_id, output_dir=out_path)
            )
            logger.info(
                "\nExport completed. %d/%d books exported to %s",
                success_count,
                len(candidates),
                out_path.absolute(),
            )

        except Exception as e:
            logger.error("Error during export: %s", e)


class CLIArgs(argparse.Namespace):
    command: str | None = None
    auth_command: str | None = None
    name: str | None = None
    id: str | None = None
    output: str = "."
    all: bool = False


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="ridi", description="Ridi Books DRM Remover CLI Utility"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    auth_parser = subparsers.add_parser("auth", help="Manage authentication")
    auth_subparsers = auth_parser.add_subparsers(dest="auth_command")
    auth_subparsers.add_parser("login", help="Login to Ridi account")
    auth_subparsers.add_parser("logout", help="Logout current account")
    auth_subparsers.add_parser("switch", help="Switch between accounts")
    auth_subparsers.add_parser("list", help="List accounts")

    books_parser = subparsers.add_parser("books", help="List downloaded books")
    books_parser.add_argument(
        "-n", "--name", help="Filter by book title (partial match)"
    )
    books_parser.add_argument("-i", "--id", help="Filter by book ID (exact match)")

    export_parser = subparsers.add_parser("export", help="Export and decrypt books")
    export_parser.add_argument(
        "-o", "--output", default=".", help="Output directory (default: current)"
    )
    export_parser.add_argument(
        "-n", "--name", help="Export books matching title (partial match)"
    )
    export_parser.add_argument(
        "-i", "--id", help="Export book matching ID (exact match)"
    )
    export_parser.add_argument(
        "-a", "--all", action="store_true", help="Export all books"
    )

    args = parser.parse_args(namespace=CLIArgs())

    config_mgr = ConfigManager(CONFIG_FILE)

    try:
        if args.command == "auth":
            auth_cmd = AuthCommand(config_mgr)
            match args.auth_command:
                case "login":
                    auth_cmd.login()
                case "switch":
                    auth_cmd.switch()
                case "logout":
                    auth_cmd.logout()
                case "list":
                    auth_cmd.list_accounts()
                case _:
                    auth_parser.print_help()

        elif args.command == "books":
            BooksCommand(config_mgr).run(name_filter=args.name, id_filter=args.id)

        elif args.command == "export":
            if not any([args.all, args.name, args.id]):
                export_parser.print_help()
            else:
                ExportCommand(config_mgr).run(
                    args.output, name_filter=args.name, id_filter=args.id
                )

        else:
            parser.print_help()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(0)


if __name__ == "__main__":
    main()
