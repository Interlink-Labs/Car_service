"""cars_dir/schemas.py — Pydantic-схемы модуля «Автомобили»."""

from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")


class CarBase(BaseModel):
    client_id: Optional[int] = Field(None, description="Владелец (clients.id)")
    brand: str = Field(..., min_length=1, max_length=40)
    model: str = Field(..., min_length=1, max_length=60)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    plate: Optional[str] = Field(None, max_length=20, description="Госномер")
    vin: Optional[str] = Field(None, max_length=17, description="VIN, 17 символов")
    mileage: Optional[int] = Field(None, ge=0, le=3_000_000)
    color: Optional[str] = Field(None, max_length=30)
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("brand", "model")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Поле не может быть пустым")
        return cleaned

    @field_validator("vin")
    @classmethod
    def normalize_vin(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = re.sub(r"\s+", "", value).upper()
        if not cleaned:
            return None
        if not VIN_RE.match(cleaned):
            raise ValueError("VIN должен состоять из 17 символов (без I, O, Q)")
        return cleaned

    @field_validator("plate")
    @classmethod
    def normalize_plate(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = re.sub(r"\s+", "", value).upper()
        return cleaned or None

    @field_validator("color", "note")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CarCreate(CarBase):
    pass


class CarUpdate(CarBase):
    pass


class Car(CarBase):
    id: int
    client_name: Optional[str] = None
    client_phone: Optional[str] = None


class CarsStats(BaseModel):
    total: int = 0
    with_owner: int = 0
    without_owner: int = 0
    avg_age: int = 0