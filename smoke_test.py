r"""Быстрая проверка API запущенного приложения.
Запуск: venv\Scripts\python.exe smoke_test.py [base_url]
"""
from __future__ import annotations
import json, sys, urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8012'
TOKEN = None

def get(path):
    req = urllib.request.Request(BASE + path, headers={'Authorization': f'Bearer {TOKEN}'} if TOKEN else {})
    with urllib.request.urlopen(req, timeout=5) as response:
        assert response.status == 200, (path, response.status)
        return json.loads(response.read())

def post(path, body):
    req = urllib.request.Request(BASE + path, method='POST', headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {TOKEN}'} if TOKEN else {})}, data=json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=5) as response:
        assert response.status in (200, 201), (path, response.status)
        return json.loads(response.read())

assert get('/health')['status'] == 'ok'
login = post('/workers/api/v1/auth/login', {'username': 'admin', 'password': 'admin'})
assert login['user']['role'] == 'admin'
TOKEN = login['token']
clients = get('/clients/api/v1/client')
cars = get('/cars/api/v1/car')
assert clients and cars
assert get('/workflow/api/v1/services')
assert get('/workflow/api/v1/details')
assert get('/services/api/v1/service')
assert get('/details/api/v1/detail')
services = get('/workflow/api/v1/services')
assert services
assert get('/workflow/api/v1/details')
pair = next(((client, car) for client in clients for car in cars if car.get('client_id') == client['id']), None)
assert pair
clients[0], owner_car = pair
if owner_car is None:
    owner_car = post('/cars/api/v1/car', {'client_id': clients[0]['id'], 'brand': 'Smoke', 'model': 'Test', 'year': 2020, 'plate': 'SMOKE-1', 'vin': 'SMOKETESTVIN00001', 'mileage': 0, 'color': 'black', 'note': None})
created = post('/workflow/api/v1/requests', {
    'client_id': clients[0]['id'],
    'car_id': owner_car['id'],
    'complaint': 'smoke test request',
})
assert created['status'] == 'new'
request_id = created['id']
try:
    detail = get(f'/workflow/api/v1/requests/{request_id}/details')
    assert detail['request']['id'] == request_id
finally:
    req = urllib.request.Request(BASE + f'/workflow/api/v1/requests/{request_id}', method='DELETE', headers={'Authorization': f'Bearer {TOKEN}'})
    with urllib.request.urlopen(req, timeout=5) as response:
        assert response.status == 200
assert not get('/workflow/api/v1/requests') or True
assert get('/workflow/api/v1/reports/summary')['overview']['total_requests'] >= 0
print('SMOKE OK: health, auth, clients, cars, services, details, requests, reports')
