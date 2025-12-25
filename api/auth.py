import os
from fastapi import Header, HTTPException, Request

def is_exec(x_exec_password: str | None) -> bool:
    expected = os.getenv("EXEC_PASSWORD")
    if not expected:
        return False
    return x_exec_password == expected


def require_exec_password(
    request: Request,
    x_exec_password: str | None = Header(default=None)
):
    if request.method == "OPTIONS":
        return

    expected = os.getenv("EXEC_PASSWORD")

    if not expected:
        raise HTTPException(
            status_code=500,
            detail="EXEC_PASSWORD not set on server"
        )

    if not x_exec_password or x_exec_password != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid exec password"
        )
