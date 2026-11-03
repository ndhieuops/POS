from alembic import context
from sqlalchemy import create_engine

from pos.models import Base

config = context.config
target_metadata = Base.metadata


def run_migrations_online() -> None:
    engine = create_engine(config.get_main_option("sqlalchemy.url"))
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
