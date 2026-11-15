"""clients_dir/repository.py — SQL-доступ к таблице clients."""

from __future__ import annotations

from typing import Any

from database import connect, transaction

CLIENT_COLUMNS = "c.id, c.full_name, c.phone, c.email, c.address, c.note"

SELECT_WITH_COUNT = f"""
    SELECT {CLIENT_COLUMNS},
           (SELECT COUNT(*) FROM cars WHERE cars.client_id = c.id) AS cars_count
      FROM clients c
"""


def list_clients(search: str | None = None) -> list[dict[str, Any]]:
    sql = [SELECT_WITH_COUNT]
    params: list[Any] = []

    if search:
        sql.append("WHERE (c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)")
        pattern = f"%{search.strip()}%"
        params.extend([pattern, pattern, pattern])

    sql.append("ORDER BY c.full_name")

    with connect() as conn:
        rows = conn.execute(" ".join(sql), params).fetchall()
    return [dict(row) for row in rows]


def get_client(client_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(f"{SELECT_WITH_COUNT} WHERE c.id = ?", (client_id,)).fetchone()
    return dict(row) if row else None


def find_by_phone(phone: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            f"{SELECT_WITH_COUNT} WHERE c.phone = ?", (phone.strip(),)
        ).fetchone()
    return dict(row) if row else None


def create_client(data: dict[str, Any]) -> dict[str, Any]:
    with transaction() as conn:
        cursor = conn.execute(
            """
            INSERT INTO clients (full_name, phone, email, address, note)
            VALUES (?, ?, ?, ?, ?)
            """,
            (data["full_name"], data["phone"], data.get("email"),
             data.get("address"), data.get("note")),
        )
        client_id = cursor.lastrowid
    return get_client(client_id)  # type: ignore[return-value]


def update_client(client_id: int, data: dict[str, Any]) -> dict[str, Any] | None:
    with transaction() as conn:
        conn.execute(
            """
            UPDATE clients
               SET full_name = ?, phone = ?, email = ?, address = ?, note = ?,
                   updated_at = datetime('now')
             WHERE id = ?
            """,
            (data["full_name"], data["phone"], data.get("email"),
             data.get("address"), data.get("note"), client_id),
        )
        exists = conn.execute("SELECT 1 FROM clients WHERE id = ?", (client_id,)).fetchone()
    return get_client(client_id) if exists else None


def delete_client(client_id: int) -> dict[str, Any] | None:
    client = get_client(client_id)
    if client is None:
        return None
    with transaction() as conn:
        conn.execute("DELETE FROM clients WHERE id = ?", (client_id,))
    return client


def clients_stats() -> dict[str, int]:
    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]
        with_cars = conn.execute(
            "SELECT COUNT(DISTINCT client_id) FROM cars WHERE client_id IS NOT NULL"
        ).fetchone()[0]
        new_this_month = conn.execute(
            "SELECT COUNT(*) FROM clients WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
        ).fetchone()[0]

    return {
        "total": total,
        "with_cars": with_cars,
        "without_cars": max(total - with_cars, 0),
        "new_this_month": new_this_month,
    }