"""
database/seed.py — базовые справочники и тестовые данные.

Идемпотентно: INSERT OR IGNORE + проверка на существование.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import sqlite3

PBKDF2_ROUNDS = 200_000


def hash_password(password: str, *, rounds: int = PBKDF2_ROUNDS) -> str:
    """Формат: pbkdf2_sha256$<rounds>$<salt_hex>$<hash_hex>."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return f"pbkdf2_sha256${rounds}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Сравнение с постоянным временем — защита от timing-атак."""
    try:
        algorithm, rounds, salt_hex, hash_hex = stored.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(rounds)
    )
    return hmac.compare_digest(digest.hex(), hash_hex)


DEFAULT_ROLES = (
    ("mechanic", "Механик"),
    ("manager", "Менеджер"),
    ("admin", "Администратор"),
)


def seed(conn: sqlite3.Connection) -> None:
    # --- роли доступа ---
    conn.executemany(
        "INSERT OR IGNORE INTO roles (code, label) VALUES (?, ?)",
        DEFAULT_ROLES,
    )

    # --- учётная запись администратора (admin / admin) ---
    exists = conn.execute(
        "SELECT 1 FROM users WHERE username = ?", ("admin",)
    ).fetchone()

    if not exists:
        conn.execute(
            "INSERT INTO users (username, password_hash, name, role_code) VALUES (?, ?, ?, ?)",
            ("admin", hash_password("admin"), "Администратор", "admin"),
        )

    # --- демонстрационные сотрудники ---
    workers_count = conn.execute("SELECT COUNT(*) FROM workers").fetchone()[0]
    if workers_count == 0:
        conn.executemany(
            "INSERT INTO workers (name, role, access_level) VALUES (?, ?, ?)",
            [
                ("Иванов Иван Иванович", "Механик по двигателям", "mechanic"),
                ("Петров Пётр Сергеевич", "Мастер-приёмщик", "manager"),
                ("Сидорова Анна Викторовна", "Администратор сервиса", "admin"),
            ],
        )

    _seed_clients_and_cars(conn)


def _seed_clients_and_cars(conn: sqlite3.Connection) -> None:
    """Демо-клиенты и их автомобили (только на пустой базе)."""
    if conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]:
        return

    conn.executemany(
        "INSERT INTO clients (full_name, phone, email, address, note) VALUES (?, ?, ?, ?, ?)",
        [
            ("Смирнов Алексей Петрович", "+7 916 240-18-32", "smirnov@mail.ru",
             "ул. Гагарина, 12", "Постоянный клиент, ТО каждые 10 тыс. км"),
            ("Кузнецова Мария Игоревна", "+7 903 771-05-44", "kuznetsova@yandex.ru",
             "пр-т Мира, 88, кв. 15", None),
            ("Волков Дмитрий Сергеевич", "+7 985 512-77-90", None,
             "ул. Ленина, 4", "Корпоративный клиент (таксопарк)"),
            ("Морозова Ольга Андреевна", "+7 926 330-62-11", "morozova@mail.ru",
             None, None),
        ],
    )

    clients = {row["full_name"]: row["id"] for row in conn.execute("SELECT id, full_name FROM clients")}

    cars = [
        (clients.get("Смирнов Алексей Петрович"), "Toyota", "Camry", 2019, "А 142 СВ 77",
         "XW7BF4FK0K0012345", 84500, "Чёрный", "Датчик давления в шинах требует замены"),
        (clients.get("Смирнов Алексей Петрович"), "Lada", "Vesta", 2016, "В 903 КМ 50",
         "XTAGFL110JY123456", 152300, "Серебристый", None),
        (clients.get("Кузнецова Мария Игоревна"), "Kia", "Rio", 2021, "Е 771 ОР 99",
         "Z94C241BBLR654321", 31800, "Белый", None),
        (clients.get("Волков Дмитрий Сергеевич"), "Hyundai", "Solaris", 2018, "К 512 ТХ 199",
         "Z94K241BBJR321654", 210400, "Синий", "Автопарк: ТО по графику"),
        (clients.get("Волков Дмитрий Сергеевич"), "Skoda", "Octavia", 2020, "К 771 НВ 199",
         "XW8AJ6NE0LK987654", 98700, "Серый", None),
        (clients.get("Морозова Ольга Андреевна"), "Renault", "Logan", 2015, "М 330 УК 77",
         "VF1LZBR0H56789012", 178900, "Красный", "Скрип в передней подвеске"),
    ]

    conn.executemany(
        """
        INSERT INTO cars (client_id, brand, model, year, plate, vin, mileage, color, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        cars,
    )