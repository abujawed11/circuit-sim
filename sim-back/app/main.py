from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.services.ngspice_runner import run_ngspice

app = FastAPI(title="Circuit Sim Backend")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalogAnalysis(BaseModel):
    type: str  # "op" | "tran" | "ac"
    # Optional parameters (frontend also includes nested `tran` / `ac`, which are accepted as extras)
    step: Optional[str] = None
    stop: Optional[str] = None

class AnalogRequest(BaseModel):
    netlist: str
    analysis: AnalogAnalysis

@app.post("/api/analog/simulate")
async def simulate_analog(req: AnalogRequest):
    """
    Run ngspice simulation.
    Netlist is fully formed by frontend (including analysis commands?).
    Wait, frontend step 3 says: "Update analog netlist generator so analysis command is appended".
    So backend just runs it.
    BUT frontend also sends analysis config for backend parsing context.
    """
    if not req.netlist:
        raise HTTPException(status_code=400, detail="Empty netlist")
    
    result = run_ngspice(req.netlist, req.analysis.type)
    return result

@app.get("/")
def read_root():
    return {"status": "ok", "service": "sim-back"}
