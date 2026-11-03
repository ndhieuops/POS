"""one awaiting_payment sale per device (DB-enforced) and QR payload snapshot

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("qr_payload", sa.String(), nullable=True))
    op.create_index(
        "ix_sales_one_pending_per_device", "sales", ["device_id"], unique=True,
        sqlite_where=sa.text("status = 'awaiting_payment'"),
    )


def downgrade() -> None:
    op.drop_index("ix_sales_one_pending_per_device", table_name="sales")
    op.drop_column("sales", "qr_payload")
