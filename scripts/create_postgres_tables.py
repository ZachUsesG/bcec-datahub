import sys
from pathlib import Path

# Add project root to Python path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import os
from sqlalchemy import create_engine
from db.models import metadata

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL)

metadata.create_all(bind=engine)

print("Postgres tables created")
