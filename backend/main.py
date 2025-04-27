from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import petri

app = FastAPI(title="Petri-Net API")

class InitRequest(BaseModel):
    num_places: int
    num_transitions: int

class RuleRequest(BaseModel):
    rule: str             # "psiA", "psiT", etc.
    target_id: Optional[str]

@app.post("/init")
def init_net(req: InitRequest):
    """
    Initialize a new Petri net with req.num_places, req.num_transitions.
    """
    try:
        petri.reset_history()
        net_id = petri.init_net(req.num_places, req.num_transitions)
        return {"net_id": net_id, "graph": petri.serialize_graph(), "log": petri.get_log()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/apply")
def apply_rule(req: RuleRequest):
    """
    Apply a synthesis rule to the current net.
    """
    try:
        petri.push_undo_snapshot()
        petri.apply_rule(req.rule, req.target_id)
        return {"graph": petri.serialize_graph(), "log": petri.get_log()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/undo")
def undo_last():
    """
    Undo the last operation.
    """
    try:
        petri.pop_undo_snapshot()
        return {"graph": petri.serialize_graph(), "log": petri.get_log()}
    except petri.UndoEmpty:
        raise HTTPException(400, "No more steps to undo")

@app.get("/status")
def status():
    """
    Return current graph + log without changes.
    """
    return {"graph": petri.serialize_graph(), "log": petri.get_log()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
