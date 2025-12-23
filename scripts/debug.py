from db.session import SessionLocal
from sqlalchemy import text

s = SessionLocal()

rows = s.execute(text("""
SELECT email FROM Person
WHERE lower(email) LIKE '%aryan%'
""")).fetchall()

print(rows)
s.close()