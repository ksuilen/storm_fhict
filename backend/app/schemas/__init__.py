# backend/app/schemas/__init__.py

# Import from user.py
from .user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDBBase, # Als deze nog bestaat en gebruikt wordt
    User,
    UserInDB,
    UserLoginSchema,
    UserRegistration,
    PasswordChangeRequest,
)

# Import from token.py
from .token import (
    Token,
    TokenPayload,
    TokenData,
)

# Import from voucher.py
from .voucher import (
    VoucherBase,
    VoucherCreate,
    VoucherUpdate,
    VoucherInDBBase,
    Voucher,
    VoucherDisplay,
)

# Import from storm_run.py
from .storm_run import (
    StormRunBase, # Als deze nog bestaat
    StormRunCreate,
    StormRunUpdate,
    StormRun,
    StormRunStatus,
    StormRunJobResponse,
    StormRunStatusResponse,
    StormRunHistoryItem, # Als deze nog bestaat
    UserRunStats, # Verplaatst naar hier als het run-gerelateerd is, of houd in user.py
)

# Import from system_configuration.py
from .system_configuration import (
    SystemConfigurationBase,
    SystemConfigurationCreate,
    SystemConfigurationUpdate,
    SystemConfigurationInDB,
    SystemConfigurationResponse,
)

# Import from misc.py
from .misc import (
    Msg,
    StormQueryRequest,
    StormResponse,
)

# Import from stats.py (New)
from .stats import (
    VoucherStatsSchema,
    AdminUserRunStatSchema,
    AdminDashboardStatsSchema,
)

# Import from progress.py
from .progress import (
    StormProgressUpdateBase,
    StormProgressUpdate,
)


__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserInDBBase",
    "User",
    "UserInDB",
    "UserLoginSchema",
    "UserRegistration",
    "PasswordChangeRequest",
    # Token schemas
    "Token",
    "TokenPayload",
    "TokenData",
    # Voucher schemas
    "VoucherBase",
    "VoucherCreate",
    "VoucherUpdate",
    "VoucherInDBBase",
    "Voucher",
    "VoucherDisplay",
    # StormRun schemas
    "StormRunBase",
    "StormRunCreate",
    "StormRunUpdate",
    "StormRun",
    "StormRunStatus",
    "StormRunJobResponse",
    "StormRunStatusResponse",
    "StormRunHistoryItem",
    "UserRunStats",
    # SystemConfiguration schemas
    "SystemConfigurationBase",
    "SystemConfigurationCreate",
    "SystemConfigurationUpdate",
    "SystemConfigurationInDB",
    "SystemConfigurationResponse",
    # Misc schemas
    "Msg",
    "StormQueryRequest",
    "StormResponse",
    # Stats schemas (New)
    "VoucherStatsSchema",
    "AdminUserRunStatSchema",
    "AdminDashboardStatsSchema",
    # Progress schemas
    "StormProgressUpdateBase",
    "StormProgressUpdate",
] 