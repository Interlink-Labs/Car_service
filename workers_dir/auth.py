"""Подписанные токены и серверные проверки ролей."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import repository as repo

_SECRET = os.environ.get("AUTOSERVICE_SECRET", "autoservice-local-change-me").encode()
_bearer = HTTPBearer(auto_error=False)


def create_token(user: dict) -> str:
    payload = {
        "uid": int(user["id"]),
        "username": user["username"],
        "role": user["role_code"],
        "exp": int(time.time()) + 60 * 60 * 12,
    }
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(_SECRET, raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{signature}"


def _decode(token: str) -> dict | None:
    try:
        raw, signature = token.split(".", 1)
        expected = hmac.new(_SECRET, raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        padded = raw + "=" * (-len(raw) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeError):
        return None


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")
    payload = _decode(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла, войдите снова")
    user = repo.get_user(int(payload["uid"]))
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ к учётной записи отключён")
    return user


def require_roles(*roles: str) -> Callable:
    def dependency(user: dict = Depends(current_user)) -> dict:
        if user["role_code"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для этой операции")
        return user
    return dependency


admin_required = require_roles("admin")
manager_required = require_roles("admin", "manager")
employee_required = require_roles("admin", "manager", "mechanic")
read_required = require_roles("admin", "manager", "mechanic", "user")
request_create_required = require_roles("admin", "manager", "mechanic", "user")
client_car_write_required = require_roles("admin", "manager", "user")
client_user_required = require_roles("user")
