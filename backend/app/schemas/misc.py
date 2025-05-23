from pydantic import BaseModel
from typing import Any

# Misc Schemas
class StormQueryRequest(BaseModel):
    query: str
    # k: int | None = None

class StormResponse(BaseModel):
    result: Any

class Msg(BaseModel):
    message: str 