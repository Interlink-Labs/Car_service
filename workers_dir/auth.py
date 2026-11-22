"""Подписанные токены и серверные проверки ролей."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import repository as repo

_SECRET = os.environ.get("AUTOSERVICE_SECRET", "local-development-only-secret-change-before-deploy-2026")
if len(_SECRET.encode("utf-8")) < 32:
    raise RuntimeError("AUTOSERVICE_SECRET должен содержать не менее 32 байт")
_ALGORITHM = "HS256"
_TOKEN_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "720"))
_bearer = HTTPBearer(auto_error=False)


def create_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(int(user["id"])),
        "username": user["username"],
        "role": user["role_code"],
        "iat": now,
        "exp": now + timedelta(minutes=_TOKEN_MINUTES),
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)


def _decode(token: str) -> dict | None:
    try:
        return jwt.decode(token, _SECRET, algorithms=[_ALGORITHM], options={"require": ["sub", "iat", "exp"]})
    except (jwt.InvalidTokenError, TypeError, ValueError):
        return None


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")
    payload = _decode(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла, войдите снова")
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный JWT")
    user = repo.get_user(user_id)
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
