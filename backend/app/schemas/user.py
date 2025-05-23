from pydantic import BaseModel, EmailStr
from typing import Optional

# Properties shared by models storing responses or data in DB
class UserBase(BaseModel):
    email: EmailStr
    role: str = "user" # Standaard rol voor nieuwe gebruikers

# Properties to receive via API on user creation
class UserCreate(UserBase):
    password: str
    # De rol wordt geërfd van UserBase, met "user" als default

# Properties to receive via API on user update
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None # Optioneel wachtwoord wijzigen
    is_active: Optional[bool] = None
    role: Optional[str] = None # Admin zou rollen moeten kunnen wijzigen

# Properties stored in DB
class UserInDBBase(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True # Pydantic V2

# Properties to return to client
class User(UserInDBBase):
    # id en is_active worden geërfd van UserInDBBase
    # email en role worden geërfd van UserBase via UserInDBBase
    pass

# Additional properties stored in DB but not returned to client
class UserInDB(UserInDBBase):
    hashed_password: str

# Schema for user login
class UserLoginSchema(BaseModel):
    username: EmailStr # Use EmailStr if username is always an email
    password: str

# Schema for user registration (can be an alias or a specific subset)
UserRegistration = UserCreate # Alias UserCreate for now 