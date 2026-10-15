from fastapi import FastAPI

# Импортируем роутеры всех 7 модулей из схемы
from workers_dir.router import router as workers_router
# from clients_dir.router import router as clients_router
# from requests_dir.router import router as requests_router
# from cars_dir.router import router as cars_router
# from details_dir.router import router as details_router
# from services_dir.router import router as services_router
# from reports_dir.router import router as reports_router

app = FastAPI(
    title="Автосервис API",
    description="API для курсового проекта автосервиса",
    version="1.0.0"
)

# Подключаем роутер работников
app.include_router(workers_router)

# По мере готовности веток остальные участники раскомментируют свои строки:
# app.include_router(clients_router)
# app.include_router(requests_router)
# app.include_router(cars_router)
# app.include_router(details_router)
# app.include_router(services_router)
# app.include_router(reports_router)

@app.get("/")
def root():
    return {"status": "ok", "message": "API Автосервиса запущено. Документация: /docs"}
