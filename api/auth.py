import os
from fastapi import Header, HTTPException, Request

EXEC_PASSWORD = os.getenv("EXEC_PASSWORD")

def is_exec(x_exec_password: str | None) -> bool:
    if not EXEC_PASSWORD or not x_exec_password:
        return False
    return x_exec_password.strip() == EXEC_PASSWORD.strip()


def require_exec_password(
    request: Request,
    x_exec_password: str | None = Header(default=None)
):
    # Allow CORS preflight
    if request.method == "OPTIONS":
        return

    if not EXEC_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="EXEC_PASSWORD not set on server"
        )

    if not x_exec_password or x_exec_password.strip() != EXEC_PASSWORD.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid exec password"
        )

    return True
