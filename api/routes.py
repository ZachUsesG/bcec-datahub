# api/routes.py
from fastapi import APIRouter, Depends, Query, Header, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from db.logic import (
    get_active_members,
    get_alumni_members,
    get_membership_history,
)
from db.session import SessionLocal
from db.models import ExternalProfile, Membership, Person

from api.auth import (
    is_exec,
    is_editor,
    require_exec_password,
    require_editor_password,
)

router = APIRouter()

# ----------------------------
# AUTH VERIFY ENDPOINTS
# ----------------------------

@router.get("/exec/verify", tags=["auth"])
def verify_exec(
    x_exec_password: str | None = Header(default=None),
    x_editor_password: str | None = Header(default=None),
):
    if is_exec(x_exec_password, x_editor_password):
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Invalid exec/editor password")


@router.get("/editor/verify", tags=["auth"])
def verify_editor(
    x_editor_password: str | None = Header(default=None),
):
    if is_editor(x_editor_password):
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Invalid editor password")


# ----------------------------
# READ MEMBERS (EMAIL MASKING)
# ----------------------------

@router.get("/get_active_members", tags=["members"])
async def read_active(
    semester: str,
    x_exec_password: str | None = Header(default=None),
    x_editor_password: str | None = Header(default=None),
):
    session = SessionLocal()
    try:
        exec_user = is_exec(x_exec_password, x_editor_password)
        rows = get_active_members(session, semester)

        if exec_user:
            return rows

        return [{**r, "email": None} for r in rows]
    finally:
        session.close()


@router.get("/get_alumni_members", tags=["alumni"])
async def read_alumni(
    semester: str,
    x_exec_password: str | None = Header(default=None),
    x_editor_password: str | None = Header(default=None),
):
    session = SessionLocal()
    try:
        exec_user = is_exec(x_exec_password, x_editor_password)
        rows = get_alumni_members(session, semester)

        if exec_user:
            return rows

        return [{**r, "email": None} for r in rows]
    finally:
        session.close()


@router.get("/get_membership_history", tags=["membership"])
async def read_membership(person_id: int):
    session = SessionLocal()
    try:
        return get_membership_history(session, person_id)
    finally:
        session.close()


# ----------------------------
# EXTERNAL PROFILES
# ----------------------------

@router.get("/external_profiles", tags=["external_profiles"])
def read_external_profiles(person_ids: List[int] = Query(...)):
    session = SessionLocal()
    try:
        rows = (
            session.query(ExternalProfile)
            .filter(ExternalProfile.c.Person_id.in_(person_ids))
            .all()
        )
        return [dict(r._mapping) for r in rows]
    finally:
        session.close()


class ManualOverrideIn(BaseModel):
    manual_title: str | None = None
    manual_company: str | None = None
    verified_semester: str | None = None


class ContactStatusIn(BaseModel):
    contact_status: str


@router.patch("/external_profiles/{person_id}/manual", tags=["external_profiles"])
def set_manual_override(
    person_id: int,
    payload: ManualOverrideIn,
    _=Depends(require_exec_password),  # exec OR editor
):
    session = SessionLocal()
    try:
        now = datetime.utcnow().isoformat()

        values = {
            "manual_title": payload.manual_title,
            "manual_company": payload.manual_company,
            "manual_updated_at": now,
        }

        if payload.verified_semester:
            values["last_verified_at"] = payload.verified_semester

        from sqlalchemy.dialects.postgresql import insert

        stmt = insert(ExternalProfile).values(
            Person_id=person_id,
            data_source="manual",
            **values,
        )

        stmt = stmt.on_conflict_do_update(
            constraint="ExternalProfile_Person_id_key",
            set_=values,
        )

        session.execute(stmt)
        session.commit()
        return {"ok": True}

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


ALLOWED_CONTACT_STATUSES = {
    "not_yet",
    "reached_out",
    "consented",
    "do_not_contact",
}


@router.patch("/external_profiles/{person_id}/contact_status", tags=["external_profiles"])
def set_contact_status(
    person_id: int,
    payload: ContactStatusIn,
    _=Depends(require_exec_password),  # exec OR editor
):
    if payload.contact_status not in ALLOWED_CONTACT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid contact_status")

    session = SessionLocal()
    try:
        now = datetime.utcnow().isoformat()

        values = {
            "contact_status": payload.contact_status,
            "contact_status_updated_at": now,
        }

        from sqlalchemy.dialects.postgresql import insert

        stmt = insert(ExternalProfile).values(
            Person_id=person_id,
            data_source="manual",
            **values,
        )

        stmt = stmt.on_conflict_do_update(
            constraint="ExternalProfile_Person_id_key",
            set_=values,
        )

        session.execute(stmt)
        session.commit()
        return {"ok": True, **values}

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


# ----------------------------
# BULK ENDPOINTS
# ----------------------------

class BulkIdsIn(BaseModel):
    person_ids: List[int]


@router.post("/membership_history/bulk", tags=["membership"])
def membership_history_bulk(payload: BulkIdsIn):
    session = SessionLocal()
    try:
        ids = payload.person_ids or []
        if not ids:
            return {}

        rows = (
            session.query(Membership)
            .filter(Membership.c.Person_id.in_(ids))
            .order_by(Membership.c.Person_id.asc(), Membership.c.start_semester.desc())
            .all()
        )

        out: Dict[int, List[Dict[str, Any]]] = {}
        for r in rows:
            d = dict(r._mapping)
            pid = d["Person_id"]
            out.setdefault(pid, []).append(d)

        for pid in ids:
            out.setdefault(pid, [])

        return out
    finally:
        session.close()


@router.post("/external_profiles/bulk", tags=["external_profiles"])
def external_profiles_bulk(payload: BulkIdsIn):
    session = SessionLocal()
    try:
        ids = payload.person_ids or []
        if not ids:
            return []

        rows = (
            session.query(ExternalProfile)
            .filter(ExternalProfile.c.Person_id.in_(ids))
            .all()
        )

        return [dict(r._mapping) for r in rows]
    finally:
        session.close()


# ----------------------------
# EDITOR-ONLY PERSON EDIT
# ----------------------------

class PersonUpdateIn(BaseModel):
    name: str | None = None
    linkedin: str | None = None


def _normalize_linkedin(url: str | None) -> str | None:
    if not url:
        return None
    u = url.strip()
    if not u:
        return None
    u = u.lower()
    u = u.replace("https://", "").replace("http://", "")
    u = u.replace("www.", "")
    u = u.split("?")[0].rstrip("/")
    return u or None


@router.patch("/people/{person_id}", tags=["people"])
def update_person(
    person_id: int,
    payload: PersonUpdateIn,
    _=Depends(require_editor_password),  # editor only
):
    session = SessionLocal()
    try:
        values: Dict[str, Any] = {}

        if payload.name is not None:
            values["name"] = payload.name.strip() or None

        if payload.linkedin is not None:
            values["linkedin"] = _normalize_linkedin(payload.linkedin)

        if not values:
            return {"ok": True, "updated": {}}

        result = session.execute(
            Person.update()
            .where(Person.c.Person_id == person_id)
            .values(**values)
        )

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Person not found")

        session.commit()
        return {"ok": True, "updated": values}

    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()
