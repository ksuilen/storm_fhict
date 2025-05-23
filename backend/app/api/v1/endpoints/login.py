from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.core.auth import authenticate_user, create_access_token, authenticate_voucher
from app.schemas.token import Token, TokenData # TokenData is nu aangepast
from app.schemas.user import User # Om admin user info te gebruiken
from app.models.user import User as DBUser # Database model voor admin
from app.models.voucher import Voucher as DBVoucher # Database model voor voucher
from app import crud # Niet langer app.crud.crud_user, app.crud.crud_voucher
from app.database import get_db
from app.core.config import settings
from datetime import timedelta
from pydantic import BaseModel

router = APIRouter()

class AdminLogin(BaseModel):
    username: str # email
    password: str

class VoucherLogin(BaseModel):
    voucher_code: str

class LoginRequest(BaseModel):
    admin_credentials: Optional[AdminLogin] = None
    voucher_login: Optional[VoucherLogin] = None

@router.post("/login/access-token", response_model=Token)
async def login_for_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    Dit endpoint ondersteunt traditionele username/password login voor admins.
    Voor voucher login, zie /login/voucher.
    """
    user = authenticate_user(db, email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    token_data = TokenData(
        actor_id=user.id,
        actor_email=user.email,
        actor_type="admin" 
        # max_runs and used_runs zijn niet van toepassing voor admin
    )
    access_token = create_access_token(
        data=token_data.model_dump(), expires_delta=access_token_expires # Pydantic v2
        # data=token_data.dict(), expires_delta=access_token_expires # Pydantic v1
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login/voucher", response_model=Token)
async def login_voucher_for_access_token(
    voucher_data: VoucherLogin, # Body parameter
    db: Session = Depends(get_db) 
) -> Any:
    """
    Log in met een voucher code om een access token te krijgen.
    """
    voucher = authenticate_voucher(db, voucher_code=voucher_data.voucher_code)
    if not voucher:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid voucher code or voucher is not active",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES) # Kan korter zijn voor vouchers
    
    token_data_for_jwt = TokenData(
        actor_id=voucher.id, 
        actor_voucher_code=voucher.code,
        actor_type="voucher",
        max_runs=voucher.max_runs,
        used_runs=voucher.used_runs
    )
    access_token = create_access_token(
        data=token_data_for_jwt.model_dump(), expires_delta=access_token_expires # Pydantic v2
        # data=token_data_for_jwt.dict(), expires_delta=access_token_expires # Pydantic v1
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Overweeg of de LoginRequest structuur nog nodig is, of dat aparte endpoints duidelijker zijn.
# Aparte endpoints lijken hier beter, dus ik heb bovenstaande /login/access-token (voor admin) 
# en /login/voucher (voor voucher) gemaakt. 
# De OAuth2PasswordRequestForm is standaard voor username/password flow. 
# Voor voucher code is een simpele Pydantic model body beter. 