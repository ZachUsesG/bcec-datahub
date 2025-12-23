import pandas as pd
from sqlalchemy import select
from db.session import SessionLocal
from db.models import Person, ExternalProfile


def normalize_email(email):
    return email.strip().lower() if isinstance(email, str) else None


def main():
    df = pd.read_csv(
        "data/derived/external_profiles_ready.csv",
        dtype=str
    )

    df["Email"] = df["Email"].apply(normalize_email)

    session = SessionLocal()

    inserted = 0
    updated = 0
    skipped = 0

    for _, row in df.iterrows():
        linkedin = row.get("linkedin_norm")

        if not linkedin:
            skipped += 1
            continue

        person_id = session.execute(
            select(Person.c.Person_id)
            .where(Person.c.linkedin == linkedin)
        ).scalars().first()

        if not person_id:
            skipped += 1
            continue

        values = {
            "Person_id": person_id,
            "current_title": row.get("current_title"),
            "current_company": row.get("current_company"),
            "data_source": row.get("data_source"),
            "last_verified_at": row.get("last_verified_at"),
        }

        exists = session.execute(
            select(ExternalProfile.c.Person_id)
            .where(ExternalProfile.c.Person_id == person_id)
        ).scalars().first()

        if exists:
            session.execute(
                ExternalProfile.update()
                .where(ExternalProfile.c.Person_id == person_id)
                .values(**values)
            )
            updated += 1
        else:
            session.execute(
                ExternalProfile.insert().values(**values)
            )
            inserted += 1

    session.commit()
    session.close()

    print("External profile load complete.")
    print(f"Inserted: {inserted}")
    print(f"Updated: {updated}")
    print(f"Skipped (no match): {skipped}")


if __name__ == "__main__":
    main()
