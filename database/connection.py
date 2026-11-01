"""
database/connection.py — соединение с SQLite.

Особенности:
* один файл БД в ./data/autoservice.db (по ТЗ данные должны переживать перезапуск);
* WAL-режим: чтение не блокируется записью;
* connection-per-request через contextmanager: sqlite3 не потокобезопасен,
  а uvicorn выполняет sync-хендлеры в пуле потоков.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "autoservice.db"


def get_connection() -> sqlite3.Connection:
    """Открыть новое соединение с нужными PRAGMA."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH, timeout=10.0, isolation_level=None,
                           check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # Внешние ключи в SQLite выключены по умолчанию — включаем на каждом соединении
    conn.execute("PRAGMA foreign_keys = ON")
    # WAL: параллельные чтения при активной записи
    conn.execute("PRAGMA journal_mode = WAL")
    # FULL даёт сохранность данных при внезапном отключении питания (требование ТЗ)
    conn.execute("PRAGMA synchronous = FULL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Соединение только для чтения (без транзакции записи)."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """Явная транзакция: COMMIT при успехе, ROLLBACK при исключении."""
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]