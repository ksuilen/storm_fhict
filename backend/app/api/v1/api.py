from fastapi import APIRouter

from app.api.v1.endpoints import login, users, storm, vouchers # Nieuwe import

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(storm.router, prefix="/storm", tags=["storm"])
api_router.include_router(vouchers.router, prefix="/vouchers", tags=["vouchers"]) # Nieuwe router 