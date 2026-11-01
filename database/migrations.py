"""
database/migrations.py — версионирование схемы БД.

Новая версия = новый элемент MIGRATIONS. Применённые версии пишутся
в PRAGMA user_version, поэтому повторный запуск безопасен.

Как добавить модуль (например, автомобили):
   1. дописать SQL в MIGRATIONS (следующий номер версии);
   2. вызвать init_db() при старте приложения — он применит только новое.
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass
from typing import Callable

from .connection import get_connection
from .migration_002_clients_cars import _migration_002_clients_cars
from .migration_003_accounts import _migration_003_accounts

log = logging.getLogger("autoservice.db")


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    apply: Callable[[sqlite3.Connection], None]


# ---------------------------------------------------------------- helpers ----

def _exec(conn: sqlite3.Connection, *statements: str) -> None:
    for statement in statements:
        conn.execute(statement)


# ------------------------------------------------------------- миграции ----

def _migration_001_workers(conn: sqlite3.Connection) -> None:
    """Роли, пользователи и сотрудники (модуль worker_dir)."""
    _exec(
        conn,
        """
        CREATE TABLE IF NOT EXISTS roles (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            code       TEXT NOT NULL UNIQUE,
            label      TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name          TEXT NOT NULL DEFAULT '',
            role_code     TEXT NOT NULL DEFAULT 'manager',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS workers (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL,
            role         TEXT NOT NULL,
            access_level TEXT NOT NULL DEFAULT 'mechanic',
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_workers_access ON workers(access_level)",
        "CREATE INDEX IF NOT EXISTS idx_workers_name   ON workers(name)",
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
    )


MIGRATIONS: tuple[Migration, ...] = (
    Migration(1, "workers: roles, users, workers", _migration_001_workers),
    Migration(2, "clients + cars", _migration_002_clients_cars),
    Migration(3, "accounts: is_active", _migration_003_accounts),
    # Migration(3, "requests: заявки и история работ", _migration_003_requests),
    # Migration(4, "catalog: детали, услуги, склад", _migration_004_catalog),
)


# ------------------------------------------------------------------- API ----

def current_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


def init_db() -> int:
    """Применить недостающие миграции и заполнить справочники. Возвращает версию схемы."""
    conn = get_connection()
    try:
        version = current_version(conn)

        for migration in MIGRATIONS:
            if migration.version <= version:
                continue

            log.info("Применяю миграцию %s: %s", migration.version, migration.name)
            conn.execute("BEGIN IMMEDIATE")
            try:
                migration.apply(conn)
                conn.execute(f"PRAGMA user_version = {migration.version}")
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise

            version = migration.version

        from .seed import seed  # локальный импорт: избегаем цикла модулей
        seed(conn)

        return version
    finally:
        conn.close()