from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

Base = declarative_base()

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
