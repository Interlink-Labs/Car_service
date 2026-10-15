from fastapi import FastAPI, APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="API Клиенты")

# Префикс задает общую часть пути для всех ручек этого файла
router = APIRouter(prefix="/api/v1", tags=["Клиенты"])

# Схема данных клиента (для создания и обновления)
class ClientSchema(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None  # Необязательное поле

# Схема для обновления (все поля опциональны, чтобы можно было менять частично)
class ClientUpdateSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

# Тестовая база данных (в памяти)
clients_db = []


# 1. Добавить: POST /api/v1/user
@router.post("/user")
def add_client(client: ClientSchema):
    # Генерируем ID как длину списка + 1 (как в вашем примере)
    new_client = {"id": len(clients_db) + 1, **client.dict()}
    clients_db.append(new_client)
    return {"status": "success", "client": new_client}


# 2. Читать: GET /api/v1/user
@router.get("/user")
def get_clients():
    return clients_db


# 3. Обновить: PUT /api/v1/user/{client_id}
# Примечание: В вашей схеме путь указан без ID, но для корректной работы REST API
# и как в вашем примере с worker, я добавил {client_id} в путь.
@router.put("/user/{client_id}")
def update_client(client_id: int, client: ClientUpdateSchema):
    for item in clients_db:
        if item["id"] == client_id:
            # exclude_unset=True позволяет обновлять только переданные поля
            update_data = client.dict(exclude_unset=True)
            item.update(update_data)
            return {"status": "updated", "client": item}
    raise HTTPException(status_code=404, detail="Клиент не найден")


# 4. Удалить: DELETE /api/v1/user/{client_id}
# Аналогично добавил ID в путь, так как без него невозможно понять, кого удалять.
@router.delete("/user/{client_id}")
def delete_client(client_id: int):
    for index, item in enumerate(clients_db):
        if item["id"] == client_id:
            deleted = clients_db.pop(index)
            return {"status": "deleted", "client": deleted}
    raise HTTPException(status_code=404, detail="Клиент не найден")


# Подключаем роутер к основному приложению
app.include_router(router)