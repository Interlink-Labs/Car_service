"""
main.py — точка сборки backend.

Подключённые модули: workers_dir (сотрудники + авторизация).
Слой данных: SQLite (./data/autoservice.db), миграции — database/migrations.py.

Новый модуль подключается тремя строками:
    1. импорт роутера;
    2. app.include_router(...);
    3. миграция схемы в database/migrations.py.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from database import init_db
from workers_dir.router import router as workers_router
from clients_dir.router import router as clients_router
from cars_dir.router import router as cars_router

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
log = logging.getLogger("autoservice")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация БД до приёма запросов: миграции + справочники."""
    version = init_db()
    log.info("Схема БД готова, версия %s", version)
    yield


app = FastAPI(
    title="Автосервис API",
    description="Внутренняя информационная система автосервиса (курсовой проект, Interlink-Labs)",
    version="1.3.0",
    lifespan=lifespan,
)

# ------------------------------------------------------------- МОДУЛИ ----

app.include_router(workers_router)
app.include_router(clients_router)
app.include_router(cars_router)
# app.include_router(details_router)   # когда details_dir/router.py будет готов

# ------------------------------------------------------------ FRONTEND ----


class NoCacheStaticFiles(StaticFiles):
    """Отдаём статику без кеша.

    ES-модули браузер кеширует по эвристике (нет заголовков → срок жизни
    вычисляется из Last-Modified), из-за чего после правки JS продолжает
    работать старая версия. no-store полностью отключает кеширование:
    для локального проекта это дешевле, чем ловить «невидимые» баги.
    В продакшене сюда ставится хеш в имени файла + immutable.
    """

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-store, must-revalidate"
        return response


app.mount("/static", NoCacheStaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    """Оболочка SPA. Навигация внутри — по hash (#/dashboard, #/workers)."""
    return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)


@app.get("/health", tags=["Служебные"], summary="Проверка живости сервиса")
def health() -> dict[str, str]:
    return {"status": "ok", "version": app.version}