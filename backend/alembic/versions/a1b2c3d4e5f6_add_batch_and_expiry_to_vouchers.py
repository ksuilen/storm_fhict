"""add batch_label and expires_at to vouchers

Revision ID: a1b2c3d4e5f6
Revises: 6c0e38575b57
Create Date: 2025-09-05 09:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '6c0e38575b57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('vouchers', sa.Column('batch_label', sa.String(), nullable=True))
    op.add_column('vouchers', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('vouchers', 'expires_at')
    op.drop_column('vouchers', 'batch_label')



