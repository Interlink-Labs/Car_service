from __future__ import annotations

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

RequestStatus = Literal['new', 'diagnostics', 'approved', 'in_progress', 'waiting_parts', 'completed', 'cancelled']

class ServiceBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str = Field(min_length=2, max_length=40)
    description: str = Field(default='', max_length=2000)
    price: float = Field(default=0, ge=0)
    duration_minutes: int = Field(default=60, gt=0, le=1440)
    is_active: bool = True

class ServiceCreate(ServiceBase): pass
class Service(ServiceBase):
    id: int
    created_at: datetime | str
    updated_at: datetime | str

class DetailBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    article: str = Field(min_length=2, max_length=80)
    description: str = Field(default='', max_length=2000)
    price: float = Field(default=0, ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    min_stock: int = Field(default=0, ge=0)
    is_active: bool = True

class DetailCreate(DetailBase): pass
class Detail(DetailBase):
    id: int
    created_at: datetime | str
    updated_at: datetime | str

class RequestCreate(BaseModel):
    client_id: int = Field(gt=0)
    car_id: int = Field(gt=0)
    manager_id: int | None = Field(default=None, gt=0)
    complaint: str = Field(default='', max_length=4000)
    mileage: int | None = Field(default=None, ge=0)
    planned_at: str | None = None

class RequestUpdate(BaseModel):
    status: RequestStatus | None = None
    manager_id: int | None = Field(default=None, gt=0)
    complaint: str | None = Field(default=None, max_length=4000)
    diagnosis: str | None = Field(default=None, max_length=4000)
    estimate: float | None = Field(default=None, ge=0)
    mileage: int | None = Field(default=None, ge=0)
    planned_at: str | None = None

class RequestItemCreate(BaseModel):
    service_id: int | None = Field(default=None, gt=0)
    detail_id: int | None = Field(default=None, gt=0)
    quantity: int = Field(default=1, gt=0, le=1000)

class RequestItem(BaseModel):
    id: int
    kind: Literal['service', 'detail']
    item_id: int
    name: str
    code: str
    quantity: int
    price: float
    total: float

class WorkCreate(BaseModel):
    mechanic_id: int | None = Field(default=None, gt=0)
    description: str = Field(min_length=2, max_length=2000)
    hours: float = Field(default=1, gt=0, le=1000)
    price: float = Field(default=0, ge=0)
    status: Literal['planned', 'in_progress', 'done'] = 'planned'

class Request(RequestCreate):
    id: int
    status: RequestStatus
    diagnosis: str
    estimate: float
    completed_at: str | None
    created_at: str
    updated_at: str
    client_name: str | None = None
    car_label: str | None = None

class WorkLog(WorkCreate):
    id: int
    request_id: int
    mechanic_name: str | None = None
    created_at: str
    updated_at: str

class RequestDetails(BaseModel):
    request: Request
    services: list[RequestItem]
    details: list[RequestItem]
    works: list[WorkLog]

