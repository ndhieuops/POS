"""barcode unique per location, not globally

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

# 0001 created the barcode unique inline (unnamed); name it on reflection so batch can drop it.
_NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


def upgrade() -> None:
    with op.batch_alter_table("products", naming_convention=_NAMING, recreate="always") as b:
        b.drop_constraint("uq_products_barcode", type_="unique")
        b.create_unique_constraint("uq_product_barcode_location", ["barcode", "location"])


def downgrade() -> None:
    with op.batch_alter_table("products", recreate="always") as b:
        b.drop_constraint("uq_product_barcode_location", type_="unique")
        b.create_unique_constraint("uq_products_barcode", ["barcode"])
