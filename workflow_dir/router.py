from fastapi import APIRouter, Depends, HTTPException, Query, status
from workers_dir.auth import admin_required, employee_required, manager_required, read_required, request_create_required, client_user_required
from . import repository as repo
from .schemas import *
from .reports import ReportSummary

router = APIRouter(prefix='/workflow', tags=['Заявки, услуги и работы'])
API='/api/v1'

def err(message, code=422): raise HTTPException(status_code=code, detail=message)

@router.get(f'{API}/services', response_model=list[Service])
def services(search: str|None=Query(None), _user: dict = Depends(read_required)): return [Service(**x) for x in repo.list_services(search)]

@router.post(f'{API}/services', response_model=Service, status_code=201)
def create_service(payload: ServiceCreate, _user: dict = Depends(manager_required)):
    try: return Service(**repo.create_service(payload.model_dump()))
    except Exception as e: err('Код услуги уже существует' if 'UNIQUE' in str(e) else str(e))

@router.get(f'{API}/services/{{item_id}}', response_model=Service)
def get_service(item_id: int, _user: dict = Depends(read_required)):
    row = repo.get_service(item_id)
    if not row: raise HTTPException(404, 'Услуга не найдена')
    return Service(**row)

@router.put(f'{API}/services/{{item_id}}', response_model=Service)
def update_service(item_id: int, payload: ServiceCreate, _user: dict = Depends(manager_required)):
    try:
        row = repo.update_service(item_id, payload.model_dump())
    except Exception as e: err('Код услуги уже существует' if 'UNIQUE' in str(e) else str(e), 409 if 'UNIQUE' in str(e) else 422)
    if not row: raise HTTPException(404, 'Услуга не найдена')
    return Service(**row)

@router.delete(f'{API}/services/{{item_id}}', response_model=Service)
def delete_service(item_id: int, _user: dict = Depends(manager_required)):
    try: row = repo.delete_service(item_id)
    except Exception as e: err('Услуга используется в заявках и не может быть удалена', 409)
    if not row: raise HTTPException(404, 'Услуга не найдена')
    return Service(**row)

@router.get(f'{API}/details', response_model=list[Detail])
def details(search: str|None=Query(None), _user: dict = Depends(read_required)): return [Detail(**x) for x in repo.list_details(search)]

@router.post(f'{API}/details', response_model=Detail, status_code=201)
def create_detail(payload: DetailCreate, _user: dict = Depends(manager_required)):
    try: return Detail(**repo.create_detail(payload.model_dump()))
    except Exception as e: err('Артикул уже существует' if 'UNIQUE' in str(e) else str(e))

@router.get(f'{API}/details/{{item_id}}', response_model=Detail)
def get_detail(item_id: int, _user: dict = Depends(read_required)):
    row = repo.get_detail(item_id)
    if not row: raise HTTPException(404, 'Деталь не найдена')
    return Detail(**row)

@router.put(f'{API}/details/{{item_id}}', response_model=Detail)
def update_detail(item_id: int, payload: DetailCreate, _user: dict = Depends(manager_required)):
    try:
        row = repo.update_detail(item_id, payload.model_dump())
    except Exception as e: err('Артикул уже существует' if 'UNIQUE' in str(e) else str(e), 409 if 'UNIQUE' in str(e) else 422)
    if not row: raise HTTPException(404, 'Деталь не найдена')
    return Detail(**row)

@router.delete(f'{API}/details/{{item_id}}', response_model=Detail)
def delete_detail(item_id: int, _user: dict = Depends(manager_required)):
    try: row = repo.delete_detail(item_id)
    except Exception: raise HTTPException(409, 'Деталь используется в заявках и не может быть удалена')
    if not row: raise HTTPException(404, 'Деталь не найдена')
    return Detail(**row)

@router.get(f'{API}/requests', response_model=list[Request])
def requests(status_filter: str|None=Query(None, alias='status'), search: str|None=Query(None), _user: dict = Depends(read_required)):
    rows = repo.list_requests(status_filter, search)
    if _user['role_code'] == 'user':
        rows = [row for row in rows if row['client_id'] == _user.get('client_id')]
    return [Request(**x) for x in rows]

@router.get(f'{API}/requests/{{request_id}}', response_model=Request)
def get_request(request_id: int, _user: dict = Depends(read_required)):
    row=repo.get_request(request_id)
    if _user['role_code'] == 'user' and (not row or row['client_id'] != _user.get('client_id')):
        raise HTTPException(403, 'Нет доступа к этой заявке')
    if not row: raise HTTPException(404,'Заявка не найдена')
    return Request(**row)

@router.get(f'{API}/requests/{{request_id}}/details', response_model=RequestDetails)
def request_details(request_id: int, _user: dict = Depends(read_required)):
    row = repo.get_request(request_id)
    if _user['role_code'] == 'user' and (not row or row['client_id'] != _user.get('client_id')):
        raise HTTPException(403, 'Нет доступа к этой заявке')
    if not row: raise HTTPException(404, 'Заявка не найдена')
    services, details = repo.request_items(request_id)
    return RequestDetails(request=Request(**row), services=services, details=details, works=repo.list_works(request_id))

@router.post(f'{API}/requests', response_model=Request, status_code=201)
def create_request(payload: RequestCreate, _user: dict = Depends(manager_required)):
    try:
        row=repo.create_request(payload.model_dump())
        if not row: raise HTTPException(422,'Клиент или автомобиль не найдены')
        return Request(**row)
    except ValueError as e: raise HTTPException(422,str(e))

@router.patch(f'{API}/requests/{{request_id}}', response_model=Request)
def update_request(request_id: int, payload: RequestUpdate, _user: dict = Depends(employee_required)):
    row=repo.update_request(request_id,payload.model_dump(exclude_unset=True))
    if not row: raise HTTPException(404,'Заявка не найдена')
    return Request(**row)

@router.post(f'{API}/requests/{{request_id}}/items', response_model=Request)
def add_item(request_id: int, payload: RequestItemCreate, _user: dict = Depends(manager_required)):
    try:
        row=repo.add_item(request_id,payload.model_dump())
        if not row: raise HTTPException(404,'Заявка не найдена')
        return Request(**row)
    except ValueError as e: raise HTTPException(422,str(e))

@router.get(f'{API}/requests/{{request_id}}/works', response_model=list[WorkLog])
def works(request_id: int, _user: dict = Depends(read_required)): return [WorkLog(**x) for x in repo.list_works(request_id)]

@router.post(f'{API}/requests/{{request_id}}/works', response_model=WorkLog, status_code=201)
def add_work(request_id: int, payload: WorkCreate, _user: dict = Depends(employee_required)):
    row=repo.add_work(request_id,payload.model_dump())
    if not row: raise HTTPException(404,'Заявка не найдена')
    return WorkLog(**row)

@router.delete(f'{API}/requests/{{request_id}}', response_model=Request)
def delete_request(request_id: int, _user: dict = Depends(manager_required)):
    row = repo.delete_request(request_id)
    if not row: raise HTTPException(404, 'Заявка не найдена')
    return Request(**row)

@router.get(f'{API}/reports/summary', response_model=ReportSummary)
def report_summary(_user: dict = Depends(admin_required)): 
    return ReportSummary(**repo.report_summary())
