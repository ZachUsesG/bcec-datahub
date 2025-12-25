import os
from fastapi import Header, HTTPException, Request

def is_exec(x_exec_password: str | None) -> bool:
    expected = os.getenv("EXEC_PASSWORD")
    return bool(expected and x_exec_password == expected)


def require_exec_password(
    request: Request,
    x_exec_password: str | None = Header(default=None)
):
    if request.method == "OPTIONS":
        return

    expected = os.getenv("EXEC_PASSWORD")

    if not expected:
        raise HTTPException(500, "EXEC_PASSWORD not set on server")

    if x_exec_password != expected:
        raise HTTPException(401, "Invalid exec password")
