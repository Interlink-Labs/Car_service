from database.connection import get_connection, rows_to_dicts, row_to_dict


def _list(table, search=None):
    conn = get_connection()
    try:
        if search:
            value = f'%{search}%'
            if table == 'services':
                rows = conn.execute('SELECT * FROM services WHERE name LIKE ? OR code LIKE ? OR description LIKE ? ORDER BY id DESC', (value, value, value)).fetchall()
            else:
                rows = conn.execute('SELECT * FROM details WHERE name LIKE ? OR article LIKE ? OR description LIKE ? ORDER BY id DESC', (value, value, value)).fetchall()
        else:
            rows = conn.execute(f'SELECT * FROM {table} ORDER BY id DESC').fetchall()
        return rows_to_dicts(rows)
    finally:
        conn.close()


def list_services(search=None):
    return _list('services', search)


def list_details(search=None):
    return _list('details', search)


def get_service(item_id):
    conn = get_connection()
    try:
        return row_to_dict(conn.execute('SELECT * FROM services WHERE id=?', (item_id,)).fetchone())
    finally:
        conn.close()


def get_detail(item_id):
    conn = get_connection()
    try:
        return row_to_dict(conn.execute('SELECT * FROM details WHERE id=?', (item_id,)).fetchone())
    finally:
        conn.close()


def create_service(data):
    conn = get_connection()
    try:
        cur = conn.execute(
            'INSERT INTO services(name,code,description,price,duration_minutes,is_active) VALUES(?,?,?,?,?,?)',
            (data['name'], data['code'], data.get('description', ''), data['price'], data['duration_minutes'], int(data.get('is_active', True))),
        )
        return get_service(cur.lastrowid)
    finally:
        conn.close()


def update_service(item_id, data):
    conn = get_connection()
    try:
        current = conn.execute('SELECT * FROM services WHERE id=?', (item_id,)).fetchone()
        if not current:
            return None
        fields = {key: value for key, value in data.items() if value is not None}
        if fields:
            fields['updated_at'] = None
            assignments = ', '.join(f'{key}=?' for key in fields if key != 'updated_at')
            values = [int(value) if key == 'is_active' else value for key, value in fields.items() if key != 'updated_at']
            assignments += ", updated_at=datetime('now')"
            conn.execute(f'UPDATE services SET {assignments} WHERE id=?', (*values, item_id))
        return get_service(item_id)
    finally:
        conn.close()


def delete_service(item_id):
    conn = get_connection()
    try:
        current = get_service(item_id)
        if not current:
            return None
        conn.execute('DELETE FROM services WHERE id=?', (item_id,))
        return current
    finally:
        conn.close()


def create_detail(data):
    conn = get_connection()
    try:
        cur = conn.execute(
            'INSERT INTO details(name,article,description,price,stock_quantity,min_stock,is_active) VALUES(?,?,?,?,?,?,?)',
            (data['name'], data['article'], data.get('description', ''), data['price'], data['stock_quantity'], data['min_stock'], int(data.get('is_active', True))),
        )
        return get_detail(cur.lastrowid)
    finally:
        conn.close()


def update_detail(item_id, data):
    conn = get_connection()
    try:
        current = conn.execute('SELECT * FROM details WHERE id=?', (item_id,)).fetchone()
        if not current:
            return None
        fields = {key: value for key, value in data.items() if value is not None}
        if fields:
            assignments = ', '.join(f'{key}=?' for key in fields)
            values = [int(value) if key == 'is_active' else value for key, value in fields.items()]
            assignments += ", updated_at=datetime('now')"
            conn.execute(f'UPDATE details SET {assignments} WHERE id=?', (*values, item_id))
        return get_detail(item_id)
    finally:
        conn.close()


def delete_detail(item_id):
    conn = get_connection()
    try:
        current = get_detail(item_id)
        if not current:
            return None
        conn.execute('DELETE FROM details WHERE id=?', (item_id,))
        return current
    finally:
        conn.close()


def exists(conn, table, ident):
    return conn.execute(f'SELECT 1 FROM {table} WHERE id=?', (ident,)).fetchone() is not None


def list_requests(status=None, search=None):
    conn = get_connection()
    try:
        sql = '''SELECT r.*, c.full_name AS client_name,
                 (cars.brand || ' ' || cars.model || COALESCE(' · ' || cars.plate,'')) AS car_label,
                 (SELECT COUNT(*) FROM work_logs w WHERE w.request_id=r.id) AS works_count
                 FROM requests r JOIN clients c ON c.id=r.client_id JOIN cars ON cars.id=r.car_id'''
        conditions, args = [], []
        if status:
            conditions.append('r.status=?')
            args.append(status)
        if search:
            value = f'%{search}%'
            conditions.append("(c.full_name LIKE ? OR cars.brand LIKE ? OR cars.model LIKE ? OR cars.plate LIKE ? OR CAST(r.id AS TEXT) LIKE ?)")
            args.extend([value] * 5)
        if conditions:
            sql += ' WHERE ' + ' AND '.join(conditions)
        sql += ' ORDER BY r.id DESC'
        return rows_to_dicts(conn.execute(sql, args).fetchall())
    finally:
        conn.close()


def get_request(request_id):
    conn = get_connection()
    try:
        return row_to_dict(conn.execute('''SELECT r.*, c.full_name AS client_name,
            (cars.brand || ' ' || cars.model || COALESCE(' · ' || cars.plate,'')) AS car_label,
            (SELECT COUNT(*) FROM work_logs w WHERE w.request_id=r.id) AS works_count
            FROM requests r JOIN clients c ON c.id=r.client_id JOIN cars ON cars.id=r.car_id WHERE r.id=?''', (request_id,)).fetchone())
    finally:
        conn.close()


def request_items(request_id):
    conn = get_connection()
    try:
        services = rows_to_dicts(conn.execute('''SELECT rs.id, 'service' AS kind, s.id AS item_id,
            s.name, s.code, rs.quantity, rs.price, rs.quantity * rs.price AS total
            FROM request_services rs JOIN services s ON s.id=rs.service_id WHERE rs.request_id=? ORDER BY rs.id''', (request_id,)).fetchall())
        details = rows_to_dicts(conn.execute('''SELECT rd.id, 'detail' AS kind, d.id AS item_id,
            d.name, d.article AS code, rd.quantity, rd.price, rd.quantity * rd.price AS total
            FROM request_details rd JOIN details d ON d.id=rd.detail_id WHERE rd.request_id=? ORDER BY rd.id''', (request_id,)).fetchall())
        return services, details
    finally:
        conn.close()


def list_works(request_id):
    conn = get_connection()
    try:
        return rows_to_dicts(conn.execute('''SELECT w.*, u.name AS mechanic_name
            FROM work_logs w LEFT JOIN users u ON u.id=w.mechanic_id
            WHERE w.request_id=? ORDER BY w.id DESC''', (request_id,)).fetchall())
    finally:
        conn.close()


def create_request(data):
    conn = get_connection()
    try:
        if not exists(conn, 'clients', data['client_id']) or not exists(conn, 'cars', data['car_id']):
            return None
        owner = conn.execute('SELECT client_id FROM cars WHERE id=?', (data['car_id'],)).fetchone()
        if owner is None or owner[0] != data['client_id']:
            raise ValueError('Автомобиль не принадлежит выбранному клиенту')
        cur = conn.execute('''INSERT INTO requests(client_id,car_id,manager_id,complaint,mileage,planned_at)
            VALUES(?,?,?,?,?,?)''', (data['client_id'], data['car_id'], data.get('manager_id'), data.get('complaint', ''), data.get('mileage'), data.get('planned_at')))
        return get_request(cur.lastrowid)
    finally:
        conn.close()


def update_request(request_id, data):
    conn = get_connection()
    try:
        if not conn.execute('SELECT 1 FROM requests WHERE id=?', (request_id,)).fetchone():
            return None
        fields = {key: value for key, value in data.items() if value is not None}
        if not fields:
            return get_request(request_id)
        fields.pop('completed_at', None)
        assignments = ', '.join(f'{key}=?' for key in fields)
        values = list(fields.values())
        if data.get('status') == 'completed':
            assignments += ", completed_at=datetime('now')"
        elif data.get('status') in {'new', 'diagnostics', 'approved', 'in_progress', 'waiting_parts'}:
            assignments += ', completed_at=NULL'
        assignments += ", updated_at=datetime('now')"
        conn.execute(f'UPDATE requests SET {assignments} WHERE id=?', (*values, request_id))
        return get_request(request_id)
    finally:
        conn.close()


def delete_request(request_id):
    conn = get_connection()
    try:
        current = get_request(request_id)
        if current:
            conn.execute('DELETE FROM requests WHERE id=?', (request_id,))
        return current
    finally:
        conn.close()


def add_item(request_id, data):
    conn = get_connection()
    try:
        if not exists(conn, 'requests', request_id):
            return None
        if bool(data.get('service_id')) == bool(data.get('detail_id')):
            raise ValueError('Выберите одну услугу или одну деталь')
        if data.get('service_id'):
            row = conn.execute('SELECT price FROM services WHERE id=? AND is_active=1', (data['service_id'],)).fetchone()
            if not row:
                raise ValueError('Услуга не найдена или отключена')
            conn.execute('INSERT INTO request_services(request_id,service_id,quantity,price) VALUES(?,?,?,?)', (request_id, data['service_id'], data['quantity'], row[0]))
        else:
            row = conn.execute('SELECT price,stock_quantity FROM details WHERE id=? AND is_active=1', (data['detail_id'],)).fetchone()
            if not row:
                raise ValueError('Деталь не найдена или отключена')
            if row[1] < data['quantity']:
                raise ValueError('Недостаточно деталей на складе')
            conn.execute('INSERT INTO request_details(request_id,detail_id,quantity,price) VALUES(?,?,?,?)', (request_id, data['detail_id'], data['quantity'], row[0]))
            conn.execute("UPDATE details SET stock_quantity=stock_quantity-?, updated_at=datetime('now') WHERE id=?", (data['quantity'], data['detail_id']))
        conn.execute('''UPDATE requests SET estimate=COALESCE((SELECT SUM(quantity*price) FROM request_services WHERE request_id=?),0)+COALESCE((SELECT SUM(quantity*price) FROM request_details WHERE request_id=?),0), updated_at=datetime('now') WHERE id=?''', (request_id, request_id, request_id))
        return get_request(request_id)
    finally:
        conn.close()


def add_work(request_id, data):
    conn = get_connection()
    try:
        if not exists(conn, 'requests', request_id):
            return None
        cur = conn.execute('''INSERT INTO work_logs(request_id,mechanic_id,description,hours,price,status)
            VALUES(?,?,?,?,?,?)''', (request_id, data.get('mechanic_id'), data['description'], data['hours'], data['price'], data['status']))
        return row_to_dict(conn.execute('''SELECT w.*, u.name AS mechanic_name FROM work_logs w
            LEFT JOIN users u ON u.id=w.mechanic_id WHERE w.id=?''', (cur.lastrowid,)).fetchone())
    finally:
        conn.close()


def report_summary():
    conn = get_connection()
    try:
        overview = row_to_dict(conn.execute('''SELECT COUNT(*) AS total_requests,
            COALESCE(SUM(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END),0) AS active_requests,
            COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) AS completed_requests,
            COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END),0) AS cancelled_requests,
            COALESCE(SUM(CASE WHEN status='completed' THEN estimate ELSE 0 END),0) AS revenue,
            COALESCE(SUM(estimate),0) AS total_estimate
            FROM requests''').fetchone())
        statuses = rows_to_dicts(conn.execute("SELECT status, COUNT(*) AS count FROM requests GROUP BY status ORDER BY count DESC").fetchall())
        top_services = rows_to_dicts(conn.execute('''SELECT s.name, s.code, SUM(rs.quantity) AS quantity,
            SUM(rs.quantity * rs.price) AS revenue FROM request_services rs JOIN services s ON s.id=rs.service_id
            GROUP BY s.id ORDER BY revenue DESC LIMIT 8''').fetchall())
        low_stock = rows_to_dicts(conn.execute('''SELECT id, name, article, stock_quantity, min_stock
            FROM details WHERE is_active=1 AND stock_quantity <= min_stock ORDER BY stock_quantity, name''').fetchall())
        return {'overview': overview, 'statuses': statuses, 'top_services': top_services, 'low_stock': low_stock}
    finally:
        conn.close()
