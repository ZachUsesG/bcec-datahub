import os
from fastapi import Header, HTTPException, Request

def get_role(x_exec_password: str | None) -> str:
    exec_expected = os.getenv("EXEC_PASSWORD")
    editor_expected = os.getenv("EDITOR_PASSWORD")

    if editor_expected and x_exec_password == editor_expected:
        return "editor"
    if exec_expected and x_exec_password == exec_expected:
        return "exec"
    return "none"

def is_exec(x_exec_password: str | None) -> bool:
    # editor inherits exec power
    return get_role(x_exec_password) in ("exec", "editor")

def is_editor(x_exec_password: str | None) -> bool:
    return get_role(x_exec_password) == "editor"

def require_exec_password(
    request: Request,
    x_exec_password: str | None = Header(default=None),
):
    if request.method == "OPTIONS":
        return

    if get_role(x_exec_password) == "none":
        raise HTTPException(status_code=401, detail="Invalid exec/editor password")

def require_editor_password(
    request: Request,
    x_exec_password: str | None = Header(default=None),
):
    if request.method == "OPTIONS":
        return

    if get_role(x_exec_password) != "editor":
        raise HTTPException(status_code=401, detail="Invalid editor password")
