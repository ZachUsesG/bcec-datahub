from db.models import Person, Membership, ExternalProfile
from sqlalchemy import func


def get_active_members(session, semester):
    latest = (
        session.query(
            Membership.c.Person_id,
            func.max(Membership.c.start_semester).label("latest_semester")
        )
        .group_by(Membership.c.Person_id)
        .subquery()
    )

    rows = (
        session.query(Person)
        .join(latest, latest.c.Person_id == Person.c.Person_id)
        .filter(latest.c.latest_semester == semester)
        .all()
    )

    return [dict(r._mapping) for r in rows]


def get_alumni_members(session, semester):
    latest = (
        session.query(
            Membership.c.Person_id,
            func.max(Membership.c.start_semester).label("latest_semester")
        )
        .group_by(Membership.c.Person_id)
        .subquery()
    )

    rows = (
        session.query(Person)
        .join(latest, latest.c.Person_id == Person.c.Person_id)
        .filter(latest.c.latest_semester != semester)
        .all()
    )

    return [dict(r._mapping) for r in rows]


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
