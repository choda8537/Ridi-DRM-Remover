from typing import TypedDict

ConfigData = TypedDict(
    "ConfigData",
    {
        "users": list["UserData"],
        "active_user": str | None,
    },
)

UserData = TypedDict(
    "UserData",
    {
        "id": str,
        "user_idx": str,
        "device_id": str,
        "device_name": str | None,
        "cookies": dict[str, str],
    },
)

UserDevice = TypedDict(
    "UserDevice",
    {
        "id": int,
        "user_idx": int,
        "device_id": str,
        "device_code": str,
        "device_ver": str | None,
        "device_nick": str,
        "status": str,
        "last_used": str,
        "created": str,
        "last_modified": str,
    },
)

UserDevices = TypedDict("UserDevices", {"user_devices": list[UserDevice]})
