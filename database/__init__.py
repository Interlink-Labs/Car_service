"""
database/__init__.py — публичный интерфейс слоя данных.

    from database import connect, transaction, init_db

Все модули (workers_dir, cars_dir, ...) работают с одной БД,
поэтому соединение и схема живут здесь, а SQL-запросы — в репозиториях модулей.
"""

from .connection import DB_PATH, connect, get_connection, transaction
from .migrations import init_db

__all__ = ["DB_PATH", "connect", "get_connection", "transaction", "init_db"]