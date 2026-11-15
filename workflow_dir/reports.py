from pydantic import BaseModel

class ReportOverview(BaseModel):
    total_requests: int
    active_requests: int
    completed_requests: int
    cancelled_requests: int
    revenue: float
    total_estimate: float

class ReportStatus(BaseModel):
    status: str
    count: int

class ReportService(BaseModel):
    name: str
    code: str
    quantity: int
    revenue: float

class ReportLowStock(BaseModel):
    id: int
    name: str
    article: str
    stock_quantity: int
    min_stock: int

class ReportSummary(BaseModel):
    overview: ReportOverview
    statuses: list[ReportStatus]
    top_services: list[ReportService]
    low_stock: list[ReportLowStock]
