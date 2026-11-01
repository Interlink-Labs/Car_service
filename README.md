# Автосервис — внутренняя информационная система

FastAPI + SQLite + нативный ES-модульный фронтенд (без сборщика).
Курсовой проект, Interlink-Labs.

## Запуск

```bash
# 1. окружение (один раз)
python -m venv venv
venv\Scripts\pip.exe install -r requirements.txt

# 2. сервер
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Открыть http://127.0.0.1:8000 — тестовый вход `admin / admin`.
Документация API: http://127.0.0.1:8000/docs

БД создаётся автоматически при первом старте: `data/autoservice.db`
(миграции + демо-данные). Чтобы начать с чистой базы — удалить папку `data/`.

## Структура

```
main.py                      сборка: роутеры модулей + раздача static
requirements.txt
database/
├── connection.py            SQLite: WAL, foreign_keys, транзакции
├── migrations.py            реестр версий схемы (PRAGMA user_version)
├── migration_002_clients_cars.py
└── seed.py                  справочники, admin/admin, демо-данные

workers_dir/                 сотрудники, роли, авторизация
├── router.py                /workers/api/v1/*
├── repository.py            SQL
└── schemas.py               pydantic-валидация

clients_dir/                 клиенты             /clients/api/v1/*
cars_dir/                    автомобили          /cars/api/v1/*
                             (owner → clients.id, уникальный VIN)

static/
├── index.html               оболочка SPA
├── css/                     base → layout → components → pages/*
└── js/
    ├── main.js              точка входа, маршруты, авторизация
    ├── core/                api, router, dom, store, roles, icons
    ├── components/          sidebar, topbar, modal, toast, stat-card, auth
    └── pages/               dashboard, workers, clients, cars
```

## Как добавить модуль

1. Миграция в `database/migrations.py` (новый `Migration(N, ...)`).
2. Пакет `new_dir/` с `schemas.py`, `repository.py`, `router.py`
   (префикс `/new`, API внутри `/api/v1`).
3. `app.include_router(new_router)` в `main.py`.
4. Клиент в `static/js/core/api.js` (`createClient('new')`).
5. Страница в `static/js/pages/` + `registerRoute` в `main.js`
   + пункт в `components/sidebar.js`.

## Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/workers/api/v1/auth/login` | вход |
| POST | `/workers/api/v1/auth/register` | регистрация |
| GET/POST | `/workers/api/v1/worker` | список / создание сотрудника |
| PUT/DELETE | `/workers/api/v1/worker/{id}` | изменение / удаление |
| GET | `/workers/api/v1/worker/stats` | KPI по персоналу |
| GET/POST | `/workers/api/v1/roles`, `/role` | роли доступа |
| GET/POST | `/clients/api/v1/client` | клиенты |
| GET | `/clients/api/v1/client/stats` | KPI по клиентам |
| GET/POST | `/cars/api/v1/car` | автомобили |
| GET | `/cars/api/v1/car/stats` | KPI по автопарку |
| GET | `/health` | проверка живости |

Поиск: `?search=` (ФИО, VIN, госномер, телефон), фильтры: `?access_level=`, `?client_id=`.

## Что дальше по ТЗ

Заявки (приём → статусы → история работ), каталог деталей и услуг, склад, отчёты.
Стили и компоненты под них уже есть — добавляются миграцией и новым пакетом.