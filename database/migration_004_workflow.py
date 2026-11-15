"""Схема рабочего процесса автосервиса: заявки, услуги, детали и работы."""


def _migration_004_workflow(conn):
    statements = (
        """
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
            duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK(duration_minutes > 0),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            article TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
            stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
            min_stock INTEGER NOT NULL DEFAULT 0 CHECK(min_stock >= 0),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
            car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
            manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','diagnostics','approved','in_progress','waiting_parts','completed','cancelled')),
            complaint TEXT NOT NULL DEFAULT '',
            diagnosis TEXT NOT NULL DEFAULT '',
            estimate REAL NOT NULL DEFAULT 0 CHECK(estimate >= 0),
            mileage INTEGER CHECK(mileage >= 0),
            planned_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS request_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
            quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
            price REAL NOT NULL CHECK(price >= 0),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(request_id, service_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS request_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
            detail_id INTEGER NOT NULL REFERENCES details(id) ON DELETE RESTRICT,
            quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
            price REAL NOT NULL CHECK(price >= 0),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(request_id, detail_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS work_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
            mechanic_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            description TEXT NOT NULL,
            hours REAL NOT NULL DEFAULT 1 CHECK(hours > 0),
            price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
            status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','done')),
            started_at TEXT,
            finished_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)",
        "CREATE INDEX IF NOT EXISTS idx_requests_client ON requests(client_id)",
        "CREATE INDEX IF NOT EXISTS idx_requests_car ON requests(car_id)",
        "CREATE INDEX IF NOT EXISTS idx_work_logs_request ON work_logs(request_id)",
        "CREATE INDEX IF NOT EXISTS idx_details_article ON details(article)",
    )
    for statement in statements:
        conn.execute(statement)
