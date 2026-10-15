from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Префикс задает общую часть пути для всех ручек этого файла
router = APIRouter(prefix="/api/v1", tags=["Работники"])

# Схема данных работника
class WorkerSchema(BaseModel):
    name: str
    role: str

# Схема для изменения прав (ручка rights)
class RightsSchema(BaseModel):
    worker_id: int
    access_level: str  # например: "admin", "mechanic", "manager"

# Тестовая база данных
workers_db = []


# 1. Добавить: POST /api/v1/worker
@router.post("/worker")
def add_worker(worker: WorkerSchema):
    new_worker = {"id": len(workers_db) + 1, **worker.dict()}
    workers_db.append(new_worker)
    return {"status": "success", "worker": new_worker}


# 2. Читать: GET /api/v1/worker
@router.get("/worker")
def get_workers():
    return workers_db


# 3. Обновить: PUT /api/v1/worker/{id}
@router.put("/worker/{worker_id}")
def update_worker(worker_id: int, worker: WorkerSchema):
    for item in workers_db:
        if item["id"] == worker_id:
            item.update(worker.dict())
            return {"status": "updated", "worker": item}
    raise HTTPException(status_code=404, detail="Работник не найден")


# 4. Удалить: DELETE /api/v1/worker/{id}
@router.delete("/worker/{worker_id}")
def delete_worker(worker_id: int):
    for index, item in enumerate(workers_db):
        if item["id"] == worker_id:
            deleted = workers_db.pop(index)
            return {"status": "deleted", "worker": deleted}
    raise HTTPException(status_code=404, detail="Работник не найден")


# 5. Разграничить права: PUT /api/v1/rights
@router.put("/rights")
def change_rights(rights: RightsSchema):
    for item in workers_db:
        if item["id"] == rights.worker_id:
            item["access_level"] = rights.access_level
            return {"status": "rights updated", "worker": item}
    raise HTTPException(status_code=404, detail="Работник не найден")