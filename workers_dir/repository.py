"""
workers_dir/repository.py — SQL-доступ к таблицам модуля сотрудников.

Слой репозитория отделён от роутера: HTTP-логика не знает про SQL,
а SQL сосредоточен в одном месте и переиспользуется другими модулями
(например, заявки будут ссылаться на сотрудника-исполнителя).
"""

from __future__ import annotations

from typing import Any

from database import connect, transaction

WORKER_COLUMNS = "id, name, role, access_level, created_at, updated_at"
USER_COLUMNS = "id, username, name, role_code, is_active, created_at"


# ------------------------------------------------------------- сотрудники ----

def list_workers(search: str | None = None, access_level: str | None = None) -> list[dict[str, Any]]:
    sql = [f"SELECT {WORKER_COLUMNS} FROM workers"]
    clauses: list[str] = []
    params: list[Any] = []

    if search:
        clauses.append("(name LIKE ? OR role LIKE ? OR access_level LIKE ?)")
        pattern = f"%{search.strip()}%"
        params.extend([pattern, pattern, pattern])

    if access_level:
        clauses.append("access_level = ?")
        params.append(access_level)

    if clauses:
        sql.append("WHERE " + " AND ".join(clauses))

    sql.append("ORDER BY id")

    with connect() as conn:
        rows = conn.execute(" ".join(sql), params).fetchall()
    return [dict(row) for row in rows]


def get_worker(worker_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            f"SELECT {WORKER_COLUMNS} FROM workers WHERE id = ?", (worker_id,)
        ).fetchone()
    return dict(row) if row else None


def create_worker(name: str, role: str, access_level: str) -> dict[str, Any]:
    with transaction() as conn:
        cursor = conn.execute(
            "INSERT INTO workers (name, role, access_level) VALUES (?, ?, ?)",
            (name, role, access_level),
        )
        worker_id = cursor.lastrowid
        row = conn.execute(
            f"SELECT {WORKER_COLUMNS} FROM workers WHERE id = ?", (worker_id,)
        ).fetchone()
    return dict(row)


def update_worker(worker_id: int, name: str, role: str, access_level: str) -> dict[str, Any] | None:
    with transaction() as conn:
        conn.execute(
            """
            UPDATE workers
               SET name = ?, role = ?, access_level = ?, updated_at = datetime('now')
             WHERE id = ?
            """,
            (name, role, access_level, worker_id),
        )
        row = conn.execute(
            f"SELECT {WORKER_COLUMNS} FROM workers WHERE id = ?", (worker_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_worker(worker_id: int) -> dict[str, Any] | None:
    with transaction() as conn:
        row = conn.execute(
            f"SELECT {WORKER_COLUMNS} FROM workers WHERE id = ?", (worker_id,)
        ).fetchone()
        if row is None:
            return None
        conn.execute("DELETE FROM workers WHERE id = ?", (worker_id,))
    return dict(row)


# ------------------------------------------------------------------ роли ----

def list_roles() -> list[dict[str, str]]:
    with connect() as conn:
        rows = conn.execute("SELECT code AS value, label FROM roles ORDER BY id").fetchall()
    return [dict(row) for row in rows]


def role_exists(code: str) -> bool:
    with connect() as conn:
        return (conn.execute("SELECT 1 FROM roles WHERE code = ?", (code,)).fetchone() is not None)


def create_role(code: str, label: str) -> dict[str, str]:
    with transaction() as conn:
        conn.execute("INSERT INTO roles (code, label) VALUES (?, ?)", (code, label))
    return {"value": code, "label": label}


# --------------------------------------------------------- пользователи ----

def find_user(username: str) -> dict[str, Any] | None:
    """Полная запись с хешем пароля — только для проверки входа."""
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, name, role_code, is_active"
            "  FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    return dict(row) if row else None


def get_user(user_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return dict(row) if row else None


def list_users(search: str | None = None, role: str | None = None) -> list[dict[str, Any]]:
    sql = [f"SELECT {USER_COLUMNS} FROM users"]
    clauses: list[str] = []
    params: list[Any] = []

    if search:
        pattern = f"%{search.strip()}%"
        clauses.append("(username LIKE ? OR name LIKE ?)")
        params.extend([pattern, pattern])

    if role:
        clauses.append("role_code = ?")
        params.append(role)

    if clauses:
        sql.append("WHERE " + " AND ".join(clauses))

    sql.append("ORDER BY id")

    with connect() as conn:
        rows = conn.execute(" ".join(sql), params).fetchall()
    return [dict(row) for row in rows]


def create_user(username: str, password_hash: str, name: str, role_code: str = "manager") -> dict[str, Any]:
    with transaction() as conn:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, name, role_code) VALUES (?, ?, ?, ?)",
            (username, password_hash, name, role_code),
        )
        row = conn.execute(
            f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return dict(row)


def update_user(user_id: int, **fields: Any) -> dict[str, Any] | None:
    """Обновить только переданные поля: name, role_code, password_hash, is_active."""
    allowed = {"name", "role_code", "password_hash", "is_active"}
    changes = {key: value for key, value in fields.items() if key in allowed and value is not None}
    if not changes:
        return get_user(user_id)

    assignments = ", ".join(f"{key} = ?" for key in changes)
    with transaction() as conn:
        conn.execute(
            f"UPDATE users SET {assignments} WHERE id = ?",
            (*changes.values(), user_id),
        )
        row = conn.execute(
            f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_user(user_id: int) -> dict[str, Any] | None:
    with transaction() as conn:
        row = conn.execute(
            f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if row is None:
            return None
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return dict(row)


def count_active_admins(exclude_id: int | None = None) -> int:
    """Страховка: нельзя оставить систему без активного администратора."""
    sql = "SELECT COUNT(*) FROM users WHERE role_code = 'admin' AND is_active = 1"
    params: tuple[Any, ...] = ()
    if exclude_id is not None:
        sql += " AND id <> ?"
        params = (exclude_id,)
    with connect() as conn:
        return int(conn.execute(sql, params).fetchone()[0])


def accounts_stats() -> dict[str, int]:
    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        blocked = conn.execute("SELECT COUNT(*) FROM users WHERE is_active = 0").fetchone()[0]
        rows = conn.execute(
            "SELECT role_code, COUNT(*) AS count FROM users GROUP BY role_code"
        ).fetchall()

    stats = {"total": total, "blocked": blocked}
    for row in rows:
        stats[row["role_code"]] = row["count"]
    return stats


# ------------------------------------------------------------- статистика ----

def workers_stats() -> dict[str, int]:
    """KPI для главного экрана за один запрос вместо перебора на клиенте."""
    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM workers").fetchone()[0]
        roles = conn.execute(
            "SELECT access_level, COUNT(*) AS count FROM workers GROUP BY access_level"
        ).fetchall()

    stats = {"total": total, "roles": len(roles)}
    for row in roles:
        stats[row["access_level"]] = row["count"]
    return stats