"""clients_dir/schemas.py — Pydantic-схемы модуля «Клиенты»."""

from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

PHONE_RE = re.compile(r"^\+?[0-9()\-\s]{7,20}$")


class ClientBase(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=120, description="ФИО клиента")
    phone: str = Field(..., min_length=7, max_length=20, description="Телефон")
    email: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = Field(None, max_length=200)
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 3:
            raise ValueError("ФИО должно содержать минимум 3 символа")
        return cleaned

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        cleaned = value.strip()
        if not PHONE_RE.match(cleaned):
            raise ValueError("Телефон должен содержать только цифры, пробелы, скобки, «+» и «-»")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if not cleaned:
            return None
        if "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("Некорректный e-mail")
        return cleaned

    @field_validator("address", "note")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    pass


class Client(ClientBase):
    id: int
    cars_count: int = 0


class ClientsStats(BaseModel):
    total: int = 0
    with_cars: int = 0
    without_cars: int = 0
    new_this_month: int = 0