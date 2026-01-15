import os
from fastapi import Header, HTTPException, Request

def is_editor(x_editor_password: str | None) -> bool:
    expected = os.getenv("EDITOR_PASSWORD")
    return bool(expected and x_editor_password == expected)

def is_exec(
    x_exec_password: str | None,
    x_editor_password: str | None = None,
) -> bool:
    exec_expected = os.getenv("EXEC_PASSWORD")
    editor_expected = os.getenv("EDITOR_PASSWORD")

    # exec OR editor counts as "exec capability"
    return bool(
        (exec_expected and x_exec_password == exec_expected)
        or (editor_expected and x_editor_password == editor_expected)
    )

def require_exec_password(
    request: Request,
    x_exec_password: str | None = Header(default=None),
    x_editor_password: str | None = Header(default=None),
):
    if request.method == "OPTIONS":
        return

    exec_expected = os.getenv("EXEC_PASSWORD")
    editor_expected = os.getenv("EDITOR_PASSWORD")

    if not exec_expected and not editor_expected:
        raise HTTPException(500, "EXEC_PASSWORD / EDITOR_PASSWORD not set on server")

    if not (
        (exec_expected and x_exec_password == exec_expected)
        or (editor_expected and x_editor_password == editor_expected)
    ):
        raise HTTPException(401, "Invalid exec/editor password")

def require_editor_password(
    request: Request,
    x_editor_password: str | None = Header(default=None),
):
    if request.method == "OPTIONS":
        return

    expected = os.getenv("EDITOR_PASSWORD")
    if not expected:
        raise HTTPException(500, "EDITOR_PASSWORD not set on server")

    if x_editor_password != expected:
        raise HTTPException(401, "Invalid editor password")

