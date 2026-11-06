"""
clients_dir/router.py — API модуля «Клиенты».

Ручки живут под /clients/api/v1 (единый стиль с workers_dir).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from . import repository as repo
from .schemas import Client, ClientCreate, ClientsStats, ClientUpdate

router = APIRouter(prefix="/clients", tags=["Клиенты"])

API = "/api/v1"


@router.get(f"{API}/client", response_model=list[Client], summary="Список клиентов")
def list_clients(
    search: str | None = Query(None, description="Поиск по ФИО, телефону, e-mail"),
) -> list[Client]:
    return [Client(**row) for row in repo.list_clients(search)]


@router.get(f"{API}/client/stats", response_model=ClientsStats, summary="Сводка по клиентам")
def clients_stats() -> ClientsStats:
    return ClientsStats(**repo.clients_stats())


@router.get(f"{API}/client/{{client_id}}", response_model=Client, summary="Карточка клиента")
def get_client(client_id: int) -> Client:
    client = repo.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return Client(**client)


@router.post(f"{API}/client", response_model=Client, status_code=status.HTTP_201_CREATED,
             summary="Добавить клиента")
def create_client(payload: ClientCreate) -> Client:
    existing = repo.find_by_phone(payload.phone)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Клиент с телефоном {payload.phone} уже существует: {existing['full_name']}",
        )
    return Client(**repo.create_client(payload.model_dump()))


@router.put(f"{API}/client/{{client_id}}", response_model=Client, summary="Изменить клиента")
def update_client(client_id: int, payload: ClientUpdate) -> Client:
    client = repo.update_client(client_id, payload.model_dump())
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return Client(**client)


@router.delete(f"{API}/client/{{client_id}}", response_model=Client, summary="Удалить клиента")
def delete_client(client_id: int) -> Client:
    client = repo.delete_client(client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return Client(**client)