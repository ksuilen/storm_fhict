from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from .core.config import settings
from .database import get_db # Need get_db for dependency
from . import crud, models, schemas # Need crud, models, schemas


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.ALGORITHM
# Haal de daadwerkelijke string waarde op uit SecretStr
SECRET_KEY = settings.SECRET_KEY.get_secret_value()
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Dit definieert het "pad" naar de endpoint die het token uitgeeft
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token") # Pad aangepast naar de waarschijnlijke locatie

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # data zou moeten bevatten: {"sub": username, "role": user_role}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_role: str = payload.get("role") # Haal rol op uit token
        if email is None:
            raise credentials_exception
        # TokenData kan nu ook de rol bevatten, hoewel we de rol van het user object uit DB gebruiken
        token_data = schemas.TokenData(email=email, role=user_role) 
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    # Optioneel: Vergelijk user.role met token_data.role als extra veiligheidscheck
    # if user_role is not None and user.role != user_role:
    #     # Rol in token komt niet overeen met DB; kan duiden op een verouderde token na rolwijziging
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="User role mismatch; please re-authenticate."
    #     )
    return user

def get_current_active_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_DETAIL_BAD_REQUEST, detail="Inactive user") # Corrected status code
    return current_user

def get_current_active_admin(current_user: models.User = Depends(get_current_active_user)) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The user doesn't have enough privileges"
        )
    return current_user 