"""API отчётности автосервиса."""

from fastapi import APIRouter, Depends

from workers_dir.auth import admin_required
from . import repository as repo
from .schemas import ReportSummary

router = APIRouter(prefix="/reports", tags=["Отчёты"])


@router.get("/api/v1/summary", response_model=ReportSummary, summary="Сводный отчёт")
def summary(_user: dict = Depends(admin_required)) -> ReportSummary:
    return ReportSummary(**repo.report_summary())
