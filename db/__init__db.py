from db.session import engine
from db.models import metadata
metadata.create_all(engine)