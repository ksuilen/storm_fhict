from pydantic import BaseModel
from typing import Optional, Union

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[Union[int, str]] = None # user_id (int) or voucher_code (str) of in Pydantic V1 email (str)

# Nieuwe TokenData die meer info kan bevatten
class TokenData(BaseModel):
    actor_id: Optional[int] = None # Kan User.id of Voucher.id zijn
    actor_email: Optional[str] = None # Alleen voor admins (sub uit de oude TokenPayload)
    actor_voucher_code: Optional[str] = None # Alleen voor vouchers
    actor_type: Optional[str] = None # 'admin' of 'voucher'
    max_runs: Optional[int] = None # Alleen voor vouchers
    used_runs: Optional[int] = None # Alleen voor vouchers
    # permissions: Optional[str] = None # Eventueel voor meer granulaire permissies later 