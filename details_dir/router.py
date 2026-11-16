"""API модуля «Детали».

Единый префикс склада: /details/api/v1.
Остатки списываются в общем workflow-репозитории при добавлении детали в заявку.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from workers_dir.auth import manager_required, read_required

from . import repository as repo
from .schemas import Detail, DetailCreate

router = APIRouter(prefix="/details", tags=["Детали"])
API = "/api/v1"


@router.get(f"{API}/detail", response_model=list[Detail], summary="Список деталей")
def list_detail_items(search: str | None = Query(None), _user: dict = Depends(read_required)) -> list[Detail]:
    return [Detail(**row) for row in repo.list_details(search)]


@router.get(f"{API}/detail/{{detail_id}}", response_model=Detail, summary="Карточка детали")
def get_detail_item(detail_id: int, _user: dict = Depends(read_required)) -> Detail:
    row = repo.get_detail(detail_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Деталь не найдена")
    return Detail(**row)


@router.post(f"{API}/detail", response_model=Detail, status_code=status.HTTP_201_CREATED, summary="Добавить деталь")
def create_detail_item(payload: DetailCreate, _user: dict = Depends(manager_required)) -> Detail:
    try:
        return Detail(**repo.create_detail(payload.model_dump()))
    except Exception as error:
        if "UNIQUE" in str(error):
            raise HTTPException(status_code=409, detail="Артикул уже существует") from error
        raise


@router.put(f"{API}/detail/{{detail_id}}", response_model=Detail, summary="Изменить деталь")
def update_detail_item(detail_id: int, payload: DetailCreate, _user: dict = Depends(manager_required)) -> Detail:
    try:
        row = repo.update_detail(detail_id, payload.model_dump())
    except Exception as error:
        if "UNIQUE" in str(error):
            raise HTTPException(status_code=409, detail="Артикул уже существует") from error
        raise
    if row is None:
        raise HTTPException(status_code=404, detail="Деталь не найдена")
    return Detail(**row)


@router.delete(f"{API}/detail/{{detail_id}}", response_model=Detail, summary="Удалить деталь")
def delete_detail_item(detail_id: int, _user: dict = Depends(manager_required)) -> Detail:
    try:
        row = repo.delete_detail(detail_id)
    except Exception as error:
        raise HTTPException(status_code=409, detail="Деталь используется в заявках и не может быть удалена") from error
    if row is None:
        raise HTTPException(status_code=404, detail="Деталь не найдена")
    return Detail(**row)
