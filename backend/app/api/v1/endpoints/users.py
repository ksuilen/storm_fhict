from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any

from app import crud, schemas, models # models.User is DBUser
from app.db.session import get_db
# Vervang get_current_active_user met get_current_active_admin
from app.core.auth import get_current_active_admin 

router = APIRouter()

@router.post("/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user_admin(
    *, 
    db: Session = Depends(get_db),
    user_in: schemas.UserCreate, # Dit schema moet mogelijk worden aangepast (bv. rol is altijd admin)
    current_admin: models.User = Depends(get_current_active_admin) # Alleen een admin kan andere admins maken
) -> Any:
    """
    Create new admin user. (Admin only)
    """
    user = crud.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="An admin with this email already exists in the system.",
        )
    # Zorg ervoor dat de rol correct wordt ingesteld, bv. in UserCreate of hier
    if not hasattr(user_in, 'role') or user_in.role != 'admin':
        # Forceer de rol naar admin of raise error als UserCreate dit niet toestaat
        # Voor nu, aanname dat UserCreate dit afhandelt of we zetten het hier expliciet
        # Als UserCreate een role veld heeft, en het is niet admin, dan is dat een probleem.
        # Beter is als UserCreate voor admins geen role meer verwacht, of dat de CRUD dit forceert.
        # crud.user.create_user zal de rol moeten instellen.
        pass # Laat CRUD de rol afhandelen, of pas UserCreate aan.

    new_admin = crud.create_user(db=db, user_in=user_in, force_admin_role=True) # Voeg force_admin_role toe aan CRUD
    return new_admin

@router.get("/me", response_model=schemas.User)
def read_users_me(current_admin: models.User = Depends(get_current_active_admin)) -> Any:
    """
    Get current admin user.
    """
    return current_admin

@router.get("/", response_model=List[schemas.User])
def read_users_admin(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Retrieve all admin users. (Admin only)
    """
    users = crud.get_users(db, skip=skip, limit=limit, only_admins=True) # Voeg only_admins toe aan CRUD
    return users


@router.get("/{user_id}", response_model=schemas.User)
def read_user_by_id_admin(
    user_id: int,
    current_admin: models.User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific admin user by id. (Admin only)
    """
    user = crud.get_user(db, user_id=user_id)
    if not user or (hasattr(user, 'role') and user.role != 'admin'):
        raise HTTPException(status_code=404, detail="Admin user not found")
    return user

# PUT /users/{user_id} kan worden toegevoegd als admins andere admins mogen aanpassen.
# DELETE /users/{user_id} kan worden toegevoegd als admins andere admins mogen verwijderen. 