import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL")
ENV = os.getenv("ENV", "dev")  # set ENV=prod on Railway, or use RAILWAY_ENVIRONMENT

# Only echo SQL locally
ECHO_SQL = (ENV != "prod") and (os.getenv("SQL_ECHO", "0") == "1" or ENV == "dev")

if DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        echo=ECHO_SQL,   # <- change
        future=True
    )
else:
    from pathlib import Path
    BASE_DIR = Path(__file__).resolve().parent.parent
    DB_PATH = BASE_DIR / "datahub.db"

    engine = create_engine(
        f"sqlite:///{DB_PATH}",
        echo=True,       # keep local echo if you want
        future=True
    )

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    expire_on_commit=False
)
