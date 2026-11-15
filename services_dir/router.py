"""API модуля «Услуги».

Единый префикс каталога: /services/api/v1.
Рабочая заявка использует те же записи через workflow-слой.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from workers_dir.auth import manager_required, read_required

from . import repository as repo
from .schemas import Service, ServiceCreate

router = APIRouter(prefix="/services", tags=["Услуги"])
API = "/api/v1"


@router.get(f"{API}/service", response_model=list[Service], summary="Список услуг")
def list_service_items(search: str | None = Query(None), _user: dict = Depends(read_required)) -> list[Service]:
    return [Service(**row) for row in repo.list_services(search)]


@router.get(f"{API}/service/{{service_id}}", response_model=Service, summary="Карточка услуги")
def get_service_item(service_id: int, _user: dict = Depends(read_required)) -> Service:
    row = repo.get_service(service_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    return Service(**row)


@router.post(f"{API}/service", response_model=Service, status_code=status.HTTP_201_CREATED, summary="Добавить услугу")
def create_service_item(payload: ServiceCreate, _user: dict = Depends(manager_required)) -> Service:
    try:
        return Service(**repo.create_service(payload.model_dump()))
    except Exception as error:
        if "UNIQUE" in str(error):
            raise HTTPException(status_code=409, detail="Код услуги уже существует") from error
        raise


@router.put(f"{API}/service/{{service_id}}", response_model=Service, summary="Изменить услугу")
def update_service_item(service_id: int, payload: ServiceCreate, _user: dict = Depends(manager_required)) -> Service:
    try:
        row = repo.update_service(service_id, payload.model_dump())
    except Exception as error:
        if "UNIQUE" in str(error):
            raise HTTPException(status_code=409, detail="Код услуги уже существует") from error
        raise
    if row is None:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    return Service(**row)


@router.delete(f"{API}/service/{{service_id}}", response_model=Service, summary="Удалить услугу")
def delete_service_item(service_id: int, _user: dict = Depends(manager_required)) -> Service:
    try:
        row = repo.delete_service(service_id)
    except Exception as error:
        raise HTTPException(status_code=409, detail="Услуга используется в заявках и не может быть удалена") from error
    if row is None:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    return Service(**row)
