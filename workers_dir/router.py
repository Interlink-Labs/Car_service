"""
workers_dir/router.py — API модуля «Сотрудники» и авторизация.

Все ручки живут под /workers/api/v1.
Данные — в SQLite через workers_dir/repository.py.
"""

from __future__ import annotations

import re
import unicodedata

from fastapi import APIRouter, HTTPException, Query, status

from database.seed import hash_password, verify_password
from .schemas import (
    Account,
    AccountCreate,
    AccountUpdate,
    AccountsStats,
    AuthResponse,
    RegisterRequest,
    RoleCreate,
    RoleSchema,
    UserCredentials,
    UserSession,
    Worker,
    WorkerCreate,
    WorkerUpdate,
    WorkersStats,
)
from . import repository as repo

router = APIRouter(prefix="/workers", tags=["Сотрудники"])

API = "/api/v1"


# ---------------------------------------------------------------- helpers ----

def _slugify(label: str) -> str:
    """«Директор сервиса» → «direktor_servisa» (транслитерация для кода роли)."""
    table = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
        "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "",
        "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    }
    text = unicodedata.normalize("NFKC", label).lower()
    slug = "".join(table.get(ch, ch) for ch in text)
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return slug[:40] or "role"


# ------------------------------------------------------------ авторизация ----

@router.post(f"{API}/auth/login", response_model=AuthResponse, summary="Вход в систему")
def login(credentials: UserCredentials) -> AuthResponse:
    user = repo.find_user(credentials.username)

    # Сообщение одинаковое для «нет пользователя» и «неверный пароль»:
    # не раскрываем существование логина
    if user is None or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ к учётной записи отключён администратором",
        )

    return AuthResponse(
        status="authenticated",
        user=UserSession(
            username=user["username"],
            name=user["name"] or user["username"],
            role=user["role_code"],
        ),
    )


@router.post(f"{API}/auth/register", response_model=AuthResponse,
             status_code=status.HTTP_201_CREATED, summary="Самостоятельная регистрация")
def register(payload: RegisterRequest) -> AuthResponse:
    """Самозапись сотрудника: роль ограничена mechanic/manager.

    Администраторов заводит только администратор через POST /user,
    иначе любой посетитель мог бы выдать себе полный доступ.
    """
    if repo.find_user(payload.username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким логином уже существует",
        )

    display_name = payload.name or payload.username.capitalize()
    repo.create_user(
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=display_name,
        role_code=payload.role,
    )

    return AuthResponse(
        status="registered",
        user=UserSession(username=payload.username, name=display_name, role=payload.role),
    )


# ------------------------------------------------------- учётные записи ----

def _ensure_role(role_code: str) -> None:
    if not repo.role_exists(role_code):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Неизвестная роль «{role_code}»",
        )


@router.get(f"{API}/user", response_model=list[Account], summary="Учётные записи (доступы)")
def list_accounts(
    search: str | None = Query(None, description="Поиск по логину или имени"),
    role: str | None = Query(None, description="Фильтр по роли"),
) -> list[Account]:
    return [Account(**_account(row)) for row in repo.list_users(search, role)]


@router.get(f"{API}/user/stats", response_model=AccountsStats, summary="Сводка по доступам")
def accounts_stats() -> AccountsStats:
    return AccountsStats(**repo.accounts_stats())


@router.post(f"{API}/user", response_model=Account, status_code=status.HTTP_201_CREATED,
             summary="Создать доступ (администратор)")
def create_account(payload: AccountCreate) -> Account:
    if repo.find_user(payload.username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким логином уже существует",
        )
    _ensure_role(payload.role)

    created = repo.create_user(
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=payload.name or payload.username.capitalize(),
        role_code=payload.role,
    )
    return Account(**_account(created))


@router.put(f"{API}/user/{{user_id}}", response_model=Account, summary="Изменить доступ")
def update_account(user_id: int, payload: AccountUpdate) -> Account:
    current = repo.get_user(user_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Учётная запись не найдена")

    if payload.role is not None:
        _ensure_role(payload.role)

    # Нельзя разжаловать или заблокировать последнего администратора
    loses_admin = current["role_code"] == "admin" and current["is_active"] and (
        (payload.role is not None and payload.role != "admin") or payload.is_active is False
    )
    if loses_admin and repo.count_active_admins(exclude_id=user_id) == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="В системе должен остаться хотя бы один активный администратор",
        )

    updated = repo.update_user(
        user_id,
        name=payload.name,
        role_code=payload.role,
        password_hash=hash_password(payload.password) if payload.password else None,
        is_active=None if payload.is_active is None else int(payload.is_active),
    )
    return Account(**_account(updated))


@router.delete(f"{API}/user/{{user_id}}", response_model=Account, summary="Удалить доступ")
def delete_account(user_id: int) -> Account:
    current = repo.get_user(user_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Учётная запись не найдена")

    if current["role_code"] == "admin" and current["is_active"] and repo.count_active_admins(exclude_id=user_id) == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить последнего администратора",
        )

    deleted = repo.delete_user(user_id)
    if deleted is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Учётная запись не найдена")
    return Account(**_account(deleted))


def _account(row: dict) -> dict:
    """Привести запись БД к схеме Account (is_active хранится как 0/1)."""
    return {
        "id": row["id"],
        "username": row["username"],
        "name": row["name"] or row["username"],
        "role": row["role_code"],
        "is_active": bool(row.get("is_active", 1)),
    }


# ------------------------------------------------------------------ роли ----

@router.get(f"{API}/roles", response_model=list[RoleSchema], summary="Список ролей доступа")
def list_roles() -> list[RoleSchema]:
    return [RoleSchema(**role) for role in repo.list_roles()]


@router.post(f"{API}/role", response_model=RoleSchema, status_code=status.HTTP_201_CREATED,
             summary="Создать роль (администратор)")
def create_role(payload: RoleCreate) -> RoleSchema:
    code = (payload.value or _slugify(payload.label)).strip().lower()

    if repo.role_exists(code):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Роль с кодом «{code}» уже существует",
        )

    return RoleSchema(**repo.create_role(code, payload.label))


# ------------------------------------------------------------- сотрудники ----

@router.get(f"{API}/worker", response_model=list[Worker], summary="Список сотрудников")
def list_workers(
    search: str | None = Query(None, description="Поиск по ФИО, специализации, роли"),
    access_level: str | None = Query(None, description="Фильтр по коду роли"),
) -> list[Worker]:
    return [Worker(**worker) for worker in repo.list_workers(search, access_level)]


@router.get(f"{API}/worker/stats", response_model=WorkersStats, summary="Сводка по сотрудникам")
def workers_stats() -> WorkersStats:
    return WorkersStats(**repo.workers_stats())


@router.get(f"{API}/worker/{{worker_id}}", response_model=Worker, summary="Карточка сотрудника")
def get_worker(worker_id: int) -> Worker:
    worker = repo.get_worker(worker_id)
    if worker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    return Worker(**worker)


@router.post(f"{API}/worker", response_model=Worker, status_code=status.HTTP_201_CREATED,
             summary="Добавить сотрудника")
def create_worker(payload: WorkerCreate) -> Worker:
    return Worker(**repo.create_worker(payload.name, payload.role, payload.access_level))


@router.put(f"{API}/worker/{{worker_id}}", response_model=Worker, summary="Изменить сотрудника")
def update_worker(worker_id: int, payload: WorkerUpdate) -> Worker:
    worker = repo.update_worker(worker_id, payload.name, payload.role, payload.access_level)
    if worker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    return Worker(**worker)


@router.delete(f"{API}/worker/{{worker_id}}", response_model=Worker, summary="Удалить сотрудника")
def delete_worker(worker_id: int) -> Worker:
    worker = repo.delete_worker(worker_id)
    if worker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    return Worker(**worker)