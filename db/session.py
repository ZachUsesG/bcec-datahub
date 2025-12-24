import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Railway / Production (Postgres)
    engine = create_engine(
        DATABASE_URL,
        echo=True,
        future=True
    )
else:
    # Local development (SQLite)
    from pathlib import Path
    BASE_DIR = Path(__file__).resolve().parent.parent
    DB_PATH = BASE_DIR / "datahub.db"

    engine = create_engine(
        f"sqlite:///{DB_PATH}",
        echo=True,
        future=True
    )

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    expire_on_commit=False
)
