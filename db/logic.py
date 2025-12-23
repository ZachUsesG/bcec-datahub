from db.models import Person, Membership, ExternalProfile
from sqlalchemy import func


def get_last_semester(session, person_id):
    return (
        session.query(func.max(Membership.c.start_semester))
        .filter(Membership.c.Person_id == person_id)
        .scalar()
    )


def get_active_members(session, semester):
    rows = (
        session.query(Person)
        .filter(
            session.query(Membership)
            .filter(
                Membership.c.Person_id == Person.c.Person_id,
                Membership.c.start_semester == semester
            )
            .exists()
        )
        .all()
    )

    rows.sort(
        key=lambda p: get_last_semester(session, p.Person_id) or "",
        reverse=True
    )

    return [dict(row._mapping) for row in rows]


def get_alumni_members(session, semester):
    has_any_membership = (
        session.query(Membership)
        .filter(Membership.c.Person_id == Person.c.Person_id)
        .exists()
    )

    active_this_semester = (
        session.query(Membership)
        .filter(
            Membership.c.Person_id == Person.c.Person_id,
            Membership.c.start_semester == semester
        )
        .exists()
    )

    rows = (
        session.query(Person)
        .filter(has_any_membership)
        .filter(~active_this_semester)
        .all()
    )

    rows.sort(
        key=lambda p: get_last_semester(session, p.Person_id) or "",
        reverse=True
    )

    return [dict(row._mapping) for row in rows]


def get_membership_history(session, person_id):
    rows = (
        session.query(Membership)
        .filter(Membership.c.Person_id == person_id)
        .order_by(Membership.c.start_semester.desc())
        .all()
    )

    return [dict(row._mapping) for row in rows]

def get_external_profile(session, person_id):
    row = (
        session.query(ExternalProfile)
        .filter(ExternalProfile.c.Person_id == person_id)
        .first()
    )
    return dict(row._mapping) if row else None

def get_external_profiles(session, person_ids):
    rows = (
        session.query(ExternalProfile)
        .filter(ExternalProfile.c.Person_id.in_(person_ids))
        .all()
    )
    return {r.Person_id: dict(r._mapping) for r in rows}
