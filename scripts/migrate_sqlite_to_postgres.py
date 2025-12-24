import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.session import Base
from db.models import Person, Membership, ExternalProfile

SQLITE_URL = "sqlite:///datahub.db"
POSTGRES_URL = os.environ["DATABASE_URL"]

sqlite_engine = create_engine(SQLITE_URL)
pg_engine = create_engine(POSTGRES_URL)

# Create tables in Postgres
Base.metadata.create_all(bind=pg_engine)

sqlite = sqlite_engine.connect()
pg = pg_engine.connect()

try:
    # ---- PERSON ----
    rows = sqlite.execute(Person.select()).mappings().all()
    if rows:
        pg.execute(Person.insert(), rows)

    # ---- MEMBERSHIP ----
    rows = sqlite.execute(Membership.select()).mappings().all()
    if rows:
        pg.execute(Membership.insert(), rows)

    # ---- EXTERNAL PROFILE ----
    rows = sqlite.execute(ExternalProfile.select()).mappings().all()
    if rows:
        pg.execute(ExternalProfile.insert(), rows)

    pg.commit()
    print("Migration complete")

finally:
    sqlite.close()
    pg.close()
