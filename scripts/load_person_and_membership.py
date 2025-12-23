import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from db.session import SessionLocal
from db.models import Person, Membership



def normalize_email(email):
    if not email or pd.isna(email):
        return None
    return email.strip().lower()


def normalize_linkedin(url):
    if not url or pd.isna(url):
        return None
    url = url.lower().strip()
    url = url.replace("https://", "").replace("http://", "")
    url = url.replace("www.", "")
    url = url.split("?")[0].rstrip("/")
    return url


def normalize_optional(value):
    if not value or pd.isna(value):
        return None
    return value.strip()


def main():
    df = pd.read_csv(
        "data/canonical/bcec_cleaned_alumni - Sheet1.csv",
        dtype=str
    )

    session: Session = SessionLocal()

    created_people = 0
    created_memberships = 0
    skipped = 0

    for _, row in df.iterrows():
        email = normalize_email(row.get("Email"))
        linkedin = normalize_linkedin(row.get("LinkedIn"))

        if not email:
            skipped += 1
            continue


        person_id = session.execute(
            select(Person.c.Person_id).where(Person.c.email == email)
        ).scalar_one_or_none()

        if not person_id:
            result = session.execute(
                Person.insert().values(
                    email=email,
                    name=normalize_optional(row.get("Name")),
                    linkedin=linkedin,
                    graduation_semester=normalize_optional(
                        row.get("graduation_semester")
                    ),
                )
            )
            person_id = result.inserted_primary_key[0]
            created_people += 1

        assert isinstance(person_id, int)


        semester = row.get("Semester")
        if not semester or pd.isna(semester):
            continue

        exists = session.execute(
            select(Membership.c.id).where(
                Membership.c.Person_id == person_id,
                Membership.c.start_semester == semester,
            )
        ).scalar_one_or_none()

        if not exists:
            session.execute(
                Membership.insert().values(
                    Person_id=person_id,
                    start_semester=semester,
                    role=normalize_optional(row.get("role")),
                    committee=normalize_optional(row.get("Committee")),
                )
            )
            created_memberships += 1

    session.commit()
    session.close()

    print("Person + Membership import complete.")
    print(f"New people created: {created_people}")
    print(f"New memberships created: {created_memberships}")
    print(f"Skipped rows: {skipped}")


if __name__ == "__main__":
    main()
