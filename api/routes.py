from fastapi import APIRouter
from typing import List
from fastapi import Query
from db.logic import (
    get_active_members,
    get_alumni_members,
    get_membership_history
)
from db.session import SessionLocal
from db.models import Person, Membership, ExternalProfile

from fastapi import Depends
from pydantic import BaseModel
from datetime import datetime

from api.auth import require_exec_password
from db.session import SessionLocal
from db.models import ExternalProfile

router = APIRouter()


@router.get("/get_active_members", tags=["members"])
async def read_active(semester: str):
    session = SessionLocal()
    try:
        return get_active_members(session, semester)
    finally:
        session.close()


@router.get("/get_alumni_members", tags=["alumni"])
async def read_alumni(semester: str):
    session = SessionLocal()
    try:
        return get_alumni_members(session, semester)
    finally:
        session.close()


@router.get("/get_membership_history", tags=["membership"])
async def read_membership(person_id: int):
    session = SessionLocal()
    try:
        return get_membership_history(session, person_id)
    finally:
        session.close()

@router.get("/external_profiles")
def read_external_profiles(
    person_ids: List[int] = Query(...)
):
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

@router.patch("/external_profiles/{person_id}/manual")
def set_manual_override(
    person_id: int,
    payload: ManualOverrideIn,
    _=Depends(require_exec_password),
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

        row = (
            session.query(ExternalProfile)
            .filter(ExternalProfile.c.Person_id == person_id)
            .first()
        )

        if row:
            session.execute(
                ExternalProfile.update()
                .where(ExternalProfile.c.Person_id == person_id)
                .values(**values)
            )
        else:
            session.execute(
            ExternalProfile.insert().values(
            Person_id=person_id,
            data_source="manual",
            **values
        )
            )

        session.commit()
        return {"ok": True}
    finally:
        session.close()