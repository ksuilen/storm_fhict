from logging.config import fileConfig
import os
import sys

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Voeg de 'app' map toe aan het Python pad zodat we modules zoals app.database kunnen importeren
# Dit gaat ervan uit dat alembic wordt uitgevoerd vanuit de `backend` map.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Ga twee niveaus omhoog van backend/alembic/env.py naar backend/
# en voeg dan de parent directory (project root) toe, en de app directory in de backend
# Dit is om ervoor te zorgen dat app.core.config en app.database correct gevonden worden.
# Het pad dat we nodig hebben is de `backend` directory zelf, omdat `app` een package daarin is.
# Alembic's prepend_sys_path = . in alembic.ini zou ./app moeten kunnen vinden.

# Importeer Base van je applicatie
# Zorg ervoor dat het pad naar je app module correct is.
# Als je alembic uitvoert vanuit de `backend` map, en `app` is een submap daarvan:
from app.database import Base # Pas dit pad aan indien nodig
# --- NIEUW: Importeer je modellen hier zodat Base.metadata ze bevat ---
from app import models # Dit importeert backend/app/models.py
# --- EINDE NIEUW ---

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # De sectie naam moet matchen met degene in alembic.ini, meestal [alembic]
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        # Zorg ervoor dat de URL correct wordt geïnterpreteerd, vooral voor SQLite paden
        # De URL uit alembic.ini zou moeten werken: sqlite:///storm_app.db
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
