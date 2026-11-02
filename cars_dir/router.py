"""cars_dir/router.py — API модуля «Автомобили».

Ручки живут под /cars/api/v1 (единый стиль с workers_dir и clients_dir).

Раньше модуль отдавал данные из списка в памяти и монтировался не на тот
префикс (/api/v1 вместо /cars/api/v1), поэтому фронтенд получал 404.
Сейчас это обычный CRUD поверх таблицы cars.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from . import repository as repo
from .schemas import Car, CarCreate, CarsStats, CarUpdate

router = APIRouter(prefix="/cars", tags=["Автомобили"])

API = "/api/v1"


@router.get(f"{API}/car", response_model=list[Car], summary="Список автомобилей")
def list_cars(
    search: str | None = Query(None, description="Поиск по VIN, госномеру, марке, модели, владельцу"),
    client_id: int | None = Query(None, description="Только авто конкретного клиента"),
) -> list[Car]:
    return [Car(**row) for row in repo.list_cars(search, client_id)]


@router.get(f"{API}/car/stats", response_model=CarsStats, summary="Сводка по автопарку")
def cars_stats() -> CarsStats:
    return CarsStats(**repo.cars_stats())


@router.get(f"{API}/car/{{car_id}}", response_model=Car, summary="Карточка автомобиля")
def get_car(car_id: int) -> Car:
    car = repo.get_car(car_id)
    if car is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Автомобиль не найден")
    return Car(**car)


def _check_owner(client_id: int | None) -> None:
    """client_id должен ссылаться на существующего клиента.

    Важно проверять заранее: при выключенных внешних ключах SQLite
    молча сохранит «висячую» ссылку и владелец в карточке окажется пустым.
    """
    if client_id is not None and not repo.client_exists(client_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Клиент с ID {client_id} не найден",
        )


def _check_vin_conflict(vin: str | None, exclude_id: int | None = None) -> None:
    """VIN уникален: одинаковый VIN у двух карточек — это ошибка оператора."""
    if not vin:
        return
    existing = repo.find_by_vin(vin)
    if existing is not None and existing["id"] != exclude_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Автомобиль с VIN {vin} уже есть в базе (ID {existing['id']})",
        )


def _check_plate_conflict(plate: str | None, exclude_id: int | None = None) -> None:
    if not plate:
        return
    existing = repo.find_by_plate(plate)
    if existing is not None and existing["id"] != exclude_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Госномер {plate} уже занят (ID {existing['id']})",
        )


@router.post(f"{API}/car", response_model=Car, status_code=status.HTTP_201_CREATED,
             summary="Добавить автомобиль")
def create_car(payload: CarCreate) -> Car:
    _check_owner(payload.client_id)
    _check_vin_conflict(payload.vin)
    _check_plate_conflict(payload.plate)
    return Car(**repo.create_car(payload.model_dump()))


@router.put(f"{API}/car/{{car_id}}", response_model=Car, summary="Изменить автомобиль")
def update_car(car_id: int, payload: CarUpdate) -> Car:
    _check_owner(payload.client_id)
    _check_vin_conflict(payload.vin, exclude_id=car_id)
    _check_plate_conflict(payload.plate, exclude_id=car_id)

    car = repo.update_car(car_id, payload.model_dump())
    if car is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Автомобиль не найден")
    return Car(**car)


@router.delete(f"{API}/car/{{car_id}}", response_model=Car, summary="Удалить автомобиль")
def delete_car(car_id: int) -> Car:
    car = repo.delete_car(car_id)
    if car is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Автомобиль не найден")
    return Car(**car)
