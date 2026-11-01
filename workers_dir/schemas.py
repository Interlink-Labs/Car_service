"""workers_dir/schemas.py — Pydantic-схемы модуля сотрудников."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

AccessLevel = str  # роль приходит строкой: базовые + созданные администратором


class WorkerBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=120, description="ФИО сотрудника")
    role: str = Field(..., min_length=2, max_length=80, description="Специализация")
    access_level: AccessLevel = Field("mechanic", description="Код роли доступа")

    @field_validator("name", "role")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Поле не может быть пустым")
        return cleaned

    @field_validator("access_level")
    @classmethod
    def normalize_level(cls, value: str) -> str:
        return value.strip().lower()


class WorkerCreate(WorkerBase):
    pass


class WorkerUpdate(WorkerBase):
    pass


class Worker(WorkerBase):
    id: int


class WorkersStats(BaseModel):
    total: int = 0
    roles: int = 0
    mechanic: int = 0
    manager: int = 0
    admin: int = 0


class RoleSchema(BaseModel):
    value: str
    label: str


class RoleCreate(BaseModel):
    label: str = Field(..., min_length=2, max_length=40)
    value: Optional[str] = Field(None, description="Код роли; если не задан — сгенерируется из label")

    @field_validator("label")
    @classmethod
    def strip_label(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Название роли не может быть пустым")
        return cleaned


class UserCredentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=4, max_length=72)

    @field_validator("username")
    @classmethod
    def strip_username(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not cleaned.replace("_", "").replace(".", "").replace("-", "").isalnum():
            raise ValueError("Логин: только латиница, цифры, «_», «.» и «-»")
        return cleaned


class RegisterRequest(UserCredentials):
    """Самостоятельная регистрация: только «рядовые» роли.

    Администратора может создать только администратор через раздел «Доступы».
    """

    name: Optional[str] = Field(None, max_length=120, description="ФИО или отображаемое имя")
    role: Literal["mechanic", "manager"] = Field("mechanic", description="Роль при регистрации")

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        return cleaned or None


class UserSession(BaseModel):
    username: str
    name: str
    role: str


class AuthResponse(BaseModel):
    status: Literal["authenticated", "registered"]
    user: UserSession


# ------------------------------------------------------- учётные записи ----

class AccountBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    name: str = Field("", max_length=120)
    role: str = Field("mechanic", description="Код роли доступа")

    @field_validator("username")
    @classmethod
    def strip_account_username(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("name")
    @classmethod
    def strip_account_name(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("role")
    @classmethod
    def normalize_account_role(cls, value: str) -> str:
        return value.strip().lower()


class AccountCreate(AccountBase):
    password: str = Field(..., min_length=4, max_length=72)


class AccountUpdate(BaseModel):
    """Частичное обновление: меняем только переданные поля."""

    name: Optional[str] = Field(None, max_length=120)
    role: Optional[str] = None
    password: Optional[str] = Field(None, min_length=4, max_length=72)
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def strip_update_name(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else " ".join(value.split())

    @field_validator("role")
    @classmethod
    def normalize_update_role(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else value.strip().lower()


class Account(BaseModel):
    id: int
    username: str
    name: str
    role: str
    is_active: bool = True


class AccountsStats(BaseModel):
    total: int = 0
    admins: int = 0
    managers: int = 0
    mechanics: int = 0
    blocked: int = 0