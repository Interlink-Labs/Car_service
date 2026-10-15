from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/v1", tags=["Автомобили"])

# Схема для добавления и изменения автомобиля
class CarSchema(BaseModel):
    brand: str           # Марка (например, "Toyota")
    model: str           # Модель (например, "Camry")
    plate_number: str    # Госномер (например, "А123БВ77")
    vin: str             # VIN-код (17 символов)
    year: int            # Год выпуска

# Тестовая база данных
cars_db = [
    {
        "id": 1,
        "brand": "Toyota",
        "model": "Camry",
        "plate_number": "A123BC77",
        "vin": "JT1234567890ABCDE",
        "year": 2018
    },
    {
        "id": 2,
        "brand": "BMW",
        "model": "X5",
        "plate_number": "X777XX77",
        "vin": "WB1234567890BMW01",
        "year": 2021
    }
]


# 1. Список всех автомобилей: GET /api/v1/list_cars
@router.get("/list_cars")
def get_cars_list():
    return cars_db


# 2. Искать по госномеру и VIN: GET /api/v1/list_cars/search_VIN?query=...
# Клиент может передать либо VIN, либо госномер в параметре query
@router.get("/list_cars/search_VIN")
def search_car_by_vin_or_plate(
    query: str = Query(..., description="Введите VIN-номер или госномер для поиска")
):
    search_str = query.strip().upper()
    results = [
        car for car in cars_db 
        if search_str in car["vin"].upper() or search_str in car["plate_number"].upper()
    ]
    if not results:
        raise HTTPException(status_code=404, detail="Автомобиль по указанному VIN/госномеру не найден")
    return results


# 3. Читать конкретный автомобиль: GET /api/v1/car/{car_id}
@router.get("/car/{car_id}")
def get_car(car_id: int):
    for car in cars_db:
        if car["id"] == car_id:
            return car
    raise HTTPException(status_code=404, detail="Автомобиль не найден")


# 4. Добавить: POST /api/v1/car
@router.post("/car")
def add_car(car: CarSchema):
    new_car = {
        "id": len(cars_db) + 1,
        **car.dict()
    }
    cars_db.append(new_car)
    return {"status": "success", "car": new_car}


# 5. Обновить: PUT /api/v1/car/{car_id}
@router.put("/car/{car_id}")
def update_car(car_id: int, car_data: CarSchema):
    for car in cars_db:
        if car["id"] == car_id:
            car.update(car_data.dict())
            return {"status": "updated", "car": car}
    raise HTTPException(status_code=404, detail="Автомобиль не найден")


# 6. Удалить: DELETE /api/v1/car/{car_id}
@router.delete("/car/{car_id}")
def delete_car(car_id: int):
    for index, car in enumerate(cars_db):
        if car["id"] == car_id:
            deleted_car = cars_db.pop(index)
            return {"status": "deleted", "car": deleted_car}
    raise HTTPException(status_code=404, detail="Автомобиль не найден")