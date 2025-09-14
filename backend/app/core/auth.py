from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.models.user import User as DBUser
from app.models.voucher import Voucher as DBVoucher
from app.schemas.token import TokenData
from app import crud
from app.database import get_db
import logging

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token")

ALGORITHM = "HS256"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES) # Use configurable value
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY.get_secret_value(), algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, email: str, password: str) -> Optional[DBUser]:
    user = crud.get_user_by_email(db, email=email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def authenticate_voucher(db: Session, voucher_code: str) -> Optional[DBVoucher]:
    voucher = crud.get_voucher_by_code(db, code=voucher_code)
    if not voucher:
        return None
    if not voucher.is_active:
        # Overweeg hier een specifiekere foutmelding of laat de login endpoint dit afhandelen
        return None 
    # Check voor used_runs >= max_runs wordt in het login endpoint afgehandeld voor een duidelijkere HTTP response
    return voucher

async def get_current_token_data(token: str = Depends(oauth2_scheme)) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY.get_secret_value(), algorithms=[ALGORITHM])
        # Hier parsen we de payload direct naar TokenData
        # Zorg ervoor dat de veldnamen in de JWT overeenkomen met TokenData of doe hier mapping
        # Bijvoorbeeld, als JWT 'sub' heeft voor email/voucher_code, map dat naar actor_email/actor_voucher_code
        
        # Aanname: de payload van create_access_token is al een dict van TokenData
        token_data = TokenData(**payload) 

        if token_data.actor_type is None: # Of een andere essentiële check
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    return token_data

async def get_current_actor(db: Session = Depends(get_db), token_payload: TokenData = Depends(get_current_token_data)) -> Union[DBUser, DBVoucher, None]:
    logger.debug("AUTH: Entered get_current_actor")
    if token_payload.actor_type == "admin":
        logger.debug(f"AUTH: get_current_actor - Type: admin, ID: {token_payload.actor_id}")
        if token_payload.actor_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin ID missing in token")
        user = crud.get_user(db, user_id=token_payload.actor_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin not found or inactive")
        return user
    elif token_payload.actor_type == "voucher":
        logger.debug(f"AUTH: get_current_actor - Type: voucher, ID: {token_payload.actor_id}")
        if token_payload.actor_id is None: # Dit is voucher.id
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voucher ID missing in token")
        voucher = crud.get_voucher(db, voucher_id=token_payload.actor_id)
        if not voucher: # Only check if voucher exists initially
            logger.warning(f"AUTH: get_current_actor - Voucher ID {token_payload.actor_id} not found.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voucher not found")
        
        logger.debug(f"AUTH: get_current_actor - Voucher {voucher.code}: is_active={voucher.is_active}, used_runs={voucher.used_runs}, max_runs={voucher.max_runs}")
        # Stricter checks for active operations (e.g. starting a run)
        if not voucher.is_active:
            logger.warning(f"AUTH: get_current_actor - Voucher {voucher.code} is INACTIVE.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voucher inactive")
        if voucher.used_runs >= voucher.max_runs:
            logger.warning(f"AUTH: get_current_actor - Voucher {voucher.code} has NO REMAINING RUNS.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voucher has no remaining runs")
        if getattr(voucher, 'expires_at', None) is not None and voucher.expires_at < datetime.now(timezone.utc):
            logger.warning(f"AUTH: get_current_actor - Voucher {voucher.code} is EXPIRED at {voucher.expires_at}.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voucher expired")
        logger.debug(f"AUTH: get_current_actor - Voucher {voucher.code} is VALID and ACTIVE for operations.")
        return voucher
    else:
        logger.error(f"AUTH: get_current_actor - Invalid actor type: {token_payload.actor_type}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid actor type in token")

async def get_current_actor_or_inactive_for_history(db: Session = Depends(get_db), token_payload: TokenData = Depends(get_current_token_data)) -> Union[DBUser, DBVoucher, None]:
    logger.debug("AUTH: Entered get_current_actor_or_inactive_for_history")
    """
    Retrieves the current actor (admin or voucher).
    For vouchers, this allows retrieval even if is_active is False or used_runs >= max_runs,
    as long as the voucher itself exists. This is intended for read-only access to history/results.
    """
    if token_payload.actor_type == "admin":
        logger.debug(f"AUTH: get_current_actor_or_inactive_for_history - Type: admin, ID: {token_payload.actor_id}")
        if token_payload.actor_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin ID missing in token for history access")
        user = crud.get_user(db, user_id=token_payload.actor_id)
        if not user: # Admin must exist and be active even for history
            logger.warning(f"AUTH: get_current_actor_or_inactive_for_history - Admin ID {token_payload.actor_id} not found.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin not found for history access")
        if not user.is_active: # Ensure admin is active
            logger.warning(f"AUTH: get_current_actor_or_inactive_for_history - Admin ID {token_payload.actor_id} is INACTIVE.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive admin cannot access history")
        logger.debug(f"AUTH: get_current_actor_or_inactive_for_history - Admin ID {token_payload.actor_id} is VALID for history.")
        return user
    elif token_payload.actor_type == "voucher":
        logger.debug(f"AUTH: get_current_actor_or_inactive_for_history - Type: voucher, ID: {token_payload.actor_id}")
        if token_payload.actor_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voucher ID missing in token for history access")
        voucher = crud.get_voucher(db, voucher_id=token_payload.actor_id)
        if not voucher:
            logger.warning(f"AUTH: get_current_actor_or_inactive_for_history - Voucher ID {token_payload.actor_id} not found.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voucher not found for history access")
        logger.debug(f"AUTH: get_current_actor_or_inactive_for_history - Voucher {voucher.code} (is_active={voucher.is_active}, used_runs={voucher.used_runs}) ALLOWED for history.")
        # No check on voucher.is_active or voucher.used_runs here for history purposes
        return voucher
    else:
        logger.error(f"AUTH: get_current_actor_or_inactive_for_history - Invalid actor type: {token_payload.actor_type}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid actor type in token for history access")

async def get_current_active_admin(current_actor: Union[DBUser, DBVoucher] = Depends(get_current_actor)) -> DBUser:
    logger.debug("AUTH: Entered get_current_active_admin")
    if not isinstance(current_actor, DBUser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Operation not permitted for this user type. Admin required."
        )
    if not current_actor.is_active:
        raise HTTPException(status_code=400, detail="Inactive admin user")
    # Extra check of de rol echt admin is, als het User model dat nog ondersteunt
    if hasattr(current_actor, 'role') and current_actor.role != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have admin privileges")
    return current_actor 