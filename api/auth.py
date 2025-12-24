import os
from fastapi import Header, HTTPException

def is_exec(x_exec_password: str | None) -> bool:
    expected = os.getenv("BCEC_ADMIN_TOKEN")
    if not expected:
        return False
    return x_exec_password == expected


def require_exec_password(
    x_exec_password: str | None = Header(default=None)
):
    expected = os.getenv("BCEC_ADMIN_TOKEN")

    if not expected:
        raise HTTPException(
            status_code=500,
            detail="BCEC_ADMIN_TOKEN not set on server"
        )

    if not x_exec_password or x_exec_password != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid exec password"
        )