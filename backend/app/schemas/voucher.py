from pydantic import BaseModel
from typing import Optional
import datetime

# Shared properties
class VoucherBase(BaseModel):
    prefix: Optional[str] = None
    max_runs: int
    is_active: Optional[bool] = True

# Properties to receive on item creation
class VoucherCreate(VoucherBase):
    pass # code wordt server-side gegenereerd

# Properties to receive on item update
class VoucherUpdate(BaseModel):
    max_runs: Optional[int] = None
    is_active: Optional[bool] = None
    # prefix kan over het algemeen niet gewijzigd worden na creatie
    # code kan ook niet gewijzigd worden

# Properties shared by models stored in DB
class VoucherInDBBase(VoucherBase):
    id: int
    code: str
    used_runs: int
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None
    created_by_admin_id: Optional[int] = None

    class Config:
        from_attributes = True # Pydantic V2 correct setting
        # Voor Pydantic V1:
        # orm_mode = True 

# Additional properties to return to client
class Voucher(VoucherInDBBase):
    pass

# Properties to return to client for display purposes
class VoucherDisplay(VoucherInDBBase):
    remaining_runs: Optional[int] = None

    # In Pydantic V2 zou je @computed_field gebruiken
    # @computed_field
    # @property
    # def remaining_runs(self) -> int:
    #     return self.max_runs - self.used_runs
    # Voor nu doen we dit in de route/service laag. 