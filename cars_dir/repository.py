"""cars_dir/repository.py — SQL-доступ к таблице cars (+ владелец из clients)."""

from __future__ import annotations

from datetime import date
from typing import Any

from database import connect, transaction

SELECT_WITH_OWNER = """
    SELECT cars.id, cars.client_id, cars.brand, cars.model, cars.year,
           cars.plate, cars.vin, cars.mileage, cars.color, cars.note,
           clients.full_name AS client_name,
           clients.phone     AS client_phone
      FROM cars
      LEFT JOIN clients ON clients.id = cars.client_id
"""

FIELDS = ("client_id", "brand", "model", "year", "plate", "vin", "mileage", "color", "note")


def list_cars(search: str | None = None, client_id: int | None = None) -> list[dict[str, Any]]:
    sql = [SELECT_WITH_OWNER]
    clauses: list[str] = []
    params: list[Any] = []

    if search:
        pattern = f"%{search.strip()}%"
        clauses.append(
            "(cars.brand LIKE ? OR cars.model LIKE ? OR cars.plate LIKE ?"
            " OR cars.vin LIKE ? OR clients.full_name LIKE ?)"
        )
        params.extend([pattern] * 5)

    if client_id is not None:
        clauses.append("cars.client_id = ?")
        params.append(client_id)

    if clauses:
        sql.append("WHERE " + " AND ".join(clauses))

    sql.append("ORDER BY cars.id DESC")

    with connect() as conn:
        rows = conn.execute(" ".join(sql), params).fetchall()
    return [dict(row) for row in rows]


def get_car(car_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(f"{SELECT_WITH_OWNER} WHERE cars.id = ?", (car_id,)).fetchone()
    return dict(row) if row else None


def find_by_vin(vin: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(f"{SELECT_WITH_OWNER} WHERE cars.vin = ?", (vin,)).fetchone()
    return dict(row) if row else None


def create_car(data: dict[str, Any]) -> dict[str, Any]:
    with transaction() as conn:
        cursor = conn.execute(
            f"INSERT INTO cars ({', '.join(FIELDS)}) VALUES ({', '.join('?' * len(FIELDS))})",
            tuple(data.get(field) for field in FIELDS),
        )
        car_id = cursor.lastrowid
    return get_car(car_id)  # type: ignore[return-value]


def update_car(car_id: int, data: dict[str, Any]) -> dict[str, Any] | None:
    assignments = ", ".join(f"{field} = ?" for field in FIELDS)
    with transaction() as conn:
        conn.execute(
            f"UPDATE cars SET {assignments}, updated_at = datetime('now') WHERE id = ?",
            (*(data.get(field) for field in FIELDS), car_id),
        )
        exists = conn.execute("SELECT 1 FROM cars WHERE id = ?", (car_id,)).fetchone()
    return get_car(car_id) if exists else None


def delete_car(car_id: int) -> dict[str, Any] | None:
    car = get_car(car_id)
    if car is None:
        return None
    with transaction() as conn:
        conn.execute("DELETE FROM cars WHERE id = ?", (car_id,))
    return car


def cars_stats() -> dict[str, int]:
    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM cars").fetchone()[0]
        with_owner = conn.execute(
            "SELECT COUNT(*) FROM cars WHERE client_id IS NOT NULL"
        ).fetchone()[0]
        avg_year = conn.execute(
            "SELECT AVG(year) FROM cars WHERE year IS NOT NULL"
        ).fetchone()[0]

    # Средний возраст автопарка — понятнее, чем средний год выпуска
    avg_age = max(date.today().year - int(avg_year), 0) if avg_year else 0

    return {
        "total": total,
        "with_owner": with_owner,
        "without_owner": max(total - with_owner, 0),
        "avg_age": avg_age,
    }