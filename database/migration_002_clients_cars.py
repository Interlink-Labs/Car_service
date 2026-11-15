"""
database/migrations/002 — клиенты и автомобили.

cars.client_id → clients.id: у каждого авто есть владелец.
VIN уникален в пределах базы (ТЗ: поиск по VIN и госномеру).
"""

from __future__ import annotations

import sqlite3


def _exec(conn: sqlite3.Connection, *statements: str) -> None:
    for statement in statements:
        conn.execute(statement)


def _migration_002_clients_cars(conn: sqlite3.Connection) -> None:
    _exec(
        conn,
        """
        CREATE TABLE IF NOT EXISTS clients (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name    TEXT NOT NULL,
            phone        TEXT NOT NULL,
            email        TEXT,
            address      TEXT,
            note         TEXT,
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS cars (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
            brand       TEXT NOT NULL,
            model       TEXT NOT NULL,
            year        INTEGER,
            plate       TEXT,
            vin         TEXT,
            mileage     INTEGER,
            color       TEXT,
            note        TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_clients_name  ON clients(full_name)",
        "CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)",
        "CREATE INDEX IF NOT EXISTS idx_cars_client   ON cars(client_id)",
        "CREATE INDEX IF NOT EXISTS idx_cars_plate    ON cars(plate)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_cars_vin ON cars(vin) WHERE vin IS NOT NULL AND vin <> ''",
    )