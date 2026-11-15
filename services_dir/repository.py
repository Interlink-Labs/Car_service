"""Репозиторий модуля «Услуги»."""

from workflow_dir.repository import (
    create_service,
    delete_service,
    get_service,
    list_services,
    update_service,
)

__all__ = [
    "create_service",
    "delete_service",
    "get_service",
    "list_services",
    "update_service",
]
