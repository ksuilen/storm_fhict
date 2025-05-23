# Import all the models, so that Base has them before being
# imported by Alembic
from app.database import Base  # noqa
from app.models.user import User  # noqa
from app.models.run import StormRun # noqa
from app.models.voucher import Voucher # noqa
from app.models.system_configuration import SystemConfiguration # noqa

# Voeg hier andere modellen toe als ze er zijn, bijv.:
# from app.models.item import Item # noqa 