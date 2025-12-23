from fastapi import FastAPI
from api.routes import router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from fastapi import FastAPI, Header, HTTPException, Depends

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def health_check():
    return {"ok": True}

import os
from fastapi import Header, HTTPException

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
    
@app.get("/exec/verify")
def exec_verify(_=Depends(require_exec_password)):
    return {"ok": True}