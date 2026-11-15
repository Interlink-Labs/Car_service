"""Связь клиентской учётной записи с карточкой клиента."""


def _migration_005_user_clients(conn):
    conn.execute("ALTER TABLE users ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_client ON users(client_id)")
