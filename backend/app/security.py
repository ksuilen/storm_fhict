from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.config import settings
from app.models.user import User as DBUser # Correcte import
from app.database import get_db # CORRECTED IMPORT
from app import crud # Alleen crud hier, models en schemas niet direct nodig


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Dit definieert het "pad" naar de endpoint die het token uitgeeft
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY.get_secret_value(), algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_active_user_dependency(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> DBUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials for user dependency", # Aangepast detail
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY.get_secret_value(), algorithms=[ALGORITHM])
        
        # Probeer eerst actor_email (van nieuwe TokenData structuur)
        email: Optional[str] = payload.get("actor_email")
        actor_type: Optional[str] = payload.get("actor_type")

        if actor_type == "admin" and email:
            pass # We hebben een admin email
        elif payload.get("sub") and not actor_type: # Fallback naar oude 'sub' als email voor oudere tokens (indien nodig)
            email = payload.get("sub")
        else: # Geen geschikte identifier gevonden
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    user = crud.get_user_by_email(db, email=email)
    
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if user.role != "admin": # Deze dependency is specifiek voor active *admin* users
        raise HTTPException(status_code=403, detail="User does not have admin privileges")
    return user

# Deze functie was de bron van de AttributeError.
# Het is beter om de meer specifieke dependencies uit auth.py te gebruiken (get_current_actor, get_current_active_admin).
# Als deze functie toch nodig is, moet het duidelijk zijn welk type gebruiker het retourneert.
# Voor nu, als het een generieke "user" betreft die via token komt, moet het een token zijn
# die geen admin-specifieke velden zoals 'role' vereist, tenzij de logica hier dat afdwingt.
# De implementatie hieronder is een simpele JWT check op 'sub' of 'actor_email' voor een actieve user.
def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> DBUser: # Type hint is DBUser
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials (get_current_user)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY.get_secret_value(), algorithms=[ALGORITHM])
        identifier: Optional[str] = payload.get("actor_email") or payload.get("sub") # probeer actor_email, dan sub

        if identifier is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = crud.get_user_by_email(db, email=identifier) # Aanname: identifier is email
    
    if user is None:
        raise credentials_exception
    # Geen check op is_active hier, tenzij expliciet gewenst voor "current_user" vs "current_active_user"
    # Voor consistentie is een check op is_active meestal goed.
    # if not user.is_active:
    #     raise HTTPException(status_code=400, detail="Inactive user (get_current_user)")
    return user

def get_current_active_user(current_user: DBUser = Depends(get_current_user)) -> DBUser:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user") # Corrected status code
    return current_user

def get_current_active_admin(current_user: DBUser = Depends(get_current_active_user)) -> DBUser:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The user doesn't have enough privileges"
        )
    return current_user 