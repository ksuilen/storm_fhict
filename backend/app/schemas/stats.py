from pydantic import BaseModel
from typing import List, Optional
import datetime

from .voucher import VoucherInDBBase # Importeer de basis voor Voucher stats
from .user import User # Voor type hinting van user role, of gebruik str

class VoucherStatsSchema(VoucherInDBBase):
    # Alle velden van VoucherInDBBase worden overgenomen
    # Geen extra velden nodig specifiek voor stats, VoucherInDBBase is al redelijk compleet
    pass

class AdminUserRunStatSchema(BaseModel):
    user_id: int
    email: str # Zou EmailStr kunnen zijn als Pydantic types worden gebruikt
    role: str 
    run_count: int

class AdminDashboardStatsSchema(BaseModel):
    voucher_stats: List[VoucherStatsSchema]
    admin_run_stats: List[AdminUserRunStatSchema] 