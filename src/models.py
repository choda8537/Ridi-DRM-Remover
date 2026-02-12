"""Data models for Ridi DRM Remover configuration and API responses."""

from typing import TypedDict


class UserData(TypedDict):
    """Stored user/device authentication data."""

    id: str
    user_idx: str
    device_id: str
    device_name: str | None


class ConfigData(TypedDict):
    """Persisted configuration file structure."""

    users: list[UserData]
    active_user: str | None


class UserDevice(TypedDict):
    """Single device entry from the Ridibooks API response."""

    id: int
    user_idx: int
    device_id: str
    device_code: str
    device_ver: str | None
    device_nick: str
    status: str
    last_used: str
    created: str
    last_modified: str


class UserDevices(TypedDict):
    """Top-level API response containing a list of user devices."""

    user_devices: list[UserDevice]
