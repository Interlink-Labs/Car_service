"""
clients_dir/router.py — API модуля «Клиенты».

Ручки живут под /clients/api/v1 (единый стиль с workers_dir).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from workers_dir.auth import client_user_required, manager_required, read_required

from . import repository as repo
from .schemas import Client, ClientBooking, ClientCreate, ClientsStats, ClientUpdate

router = APIRouter(prefix="/clients", tags=["Клиенты"])

API = "/api/v1"


@router.get(f"{API}/client", response_model=list[Client], summary="Список клиентов")
def list_clients(
    search: str | None = Query(None, description="Поиск по ФИО, телефону, e-mail"),
    _user: dict = Depends(read_required),
) -> list[Client]:
    if _user['role_code'] == 'user':
        row = repo.get_client(_user.get('client_id')) if _user.get('client_id') else None
        return [Client(**row)] if row else []
    return [Client(**row) for row in repo.list_clients(search)]


@router.get(f"{API}/client/stats", response_model=ClientsStats, summary="Сводка по клиентам")
def clients_stats(_user: dict = Depends(read_required)) -> ClientsStats:
    if _user['role_code'] == 'user':
        row = repo.get_client(_user.get('client_id')) if _user.get('client_id') else None
        return ClientsStats(total=1 if row else 0, with_cars=row['cars_count'] > 0 if row else 0, without_cars=row['cars_count'] == 0 if row else 0)
    return ClientsStats(**repo.clients_stats())


@router.get(f"{API}/client/{{client_id}}", response_model=Client, summary="Карточка клиента")
def get_client(client_id: int, _user: dict = Depends(read_required)) -> Client:
    if _user['role_code'] == 'user' and client_id != _user.get('client_id'):
        raise HTTPException(status_code=403, detail='Нет доступа к этой карточке клиента')
    client = repo.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return Client(**client)


@router.post(f"{API}/client/booking", status_code=status.HTTP_201_CREATED, summary="Записаться на ремонт")
def create_booking(payload: ClientBooking, _user: dict = Depends(client_user_required)):
    if not _user.get('client_id'):
        raise HTTPException(status_code=422, detail='К аккаунту не привязана карточка клиента')
    from workflow_dir import repository as workflow_repo
    car = __import__('cars_dir.repository', fromlist=['get_car']).get_car(payload.car_id)
    if not car or car.get('client_id') != _user['client_id']:
        raise HTTPException(status_code=403, detail='Автомобиль не принадлежит вашему аккаунту')
    row = workflow_repo.create_request({'client_id': _user['client_id'], 'car_id': payload.car_id, 'complaint': payload.complaint, 'planned_at': payload.planned_at, 'mileage': None, 'manager_id': None})
    return row

@router.post(f"{API}/client", response_model=Client, status_code=status.HTTP_201_CREATED,
             summary="Добавить клиента")
def create_client(payload: ClientCreate, _user: dict = Depends(manager_required)) -> Client:
    existing = repo.find_by_phone(payload.phone)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Клиент с телефоном {payload.phone} уже существует: {existing['full_name']}",
        )
    return Client(**repo.create_client(payload.model_dump()))


@router.put(f"{API}/client/{{client_id}}", response_model=Client, summary="Изменить клиента")
def update_client(client_id: int, payload: ClientUpdate, _user: dict = Depends(manager_required)) -> Client:
    client = repo.update_client(client_id, payload.model_dump())
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return Client(**client)


@router.delete(f"{API}/client/{{client_id}}", response_model=Client, summary="Удалить клиента")
def delete_client(client_id: int, _user: dict = Depends(manager_required)) -> Client:
    client = repo.delete_client(client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return Client(**client)