"""
database/migration_003 — управление учётными записями.

users.is_active: блокировка доступа без удаления истории (учётку можно
«отключить», когда сотрудник уволился, — в отличие от DELETE).
"""

from __future__ import annotations

import sqlite3


def _migration_003_accounts(conn: sqlite3.Connection) -> None:
    conn.execute(
        "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_code)"
    )