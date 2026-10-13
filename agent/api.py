"""
Assay agent API — the endpoint the web AGENT RUN view calls.

    uvicorn api:app --port 8000 --reload

POST /run  {prompt, budget}  → Server-Sent Events stream of the run:
    event: intake | discover | decision | pay_start | pay_done | pay_intent | pay_error
           | synthesize | done
Each SSE `data:` payload is the JSON emitted by the graph's `emit` callback, so the
frontend can render the live decision feed (with refusals front and center) as it happens.

The run executes in a background thread; events flow through a thread-safe queue into the
SSE generator. CORS is restricted to configured frontend origins.
"""
from __future__ import annotations

import json
import queue
import threading
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict

from config import load_agent_config

CONFIG = load_agent_config()

from assay.graph import run_task  # noqa: E402 — validate production before graph imports

app = FastAPI(title="Assay Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CONFIG.cors_origins),
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)

_SENTINEL = object()


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str
    budget: float = 0.02
    authorizationId: Optional[str] = None



@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "assay-agent", "runtime": CONFIG.runtime}


@app.post("/run")
def run(req: RunRequest) -> StreamingResponse:
    q: "queue.Queue[Any]" = queue.Queue()

    def emit(event: str, data: Dict[str, Any]) -> None:
        q.put({"event": event, "data": data})

    def worker() -> None:
        try:
            run_task(req.prompt, req.budget, emit=emit, backend_url=CONFIG.backend_url,
                     authorization_id=req.authorizationId)

        except Exception as e:  # noqa: BLE001 — report as a stream event, don't 500
            q.put({"event": "error", "data": {"message": str(e)}})
        finally:
            q.put(_SENTINEL)

    threading.Thread(target=worker, daemon=True).start()

    def stream():
        while True:
            item = q.get()
            if item is _SENTINEL:
                break
            payload = json.dumps(item["data"])
            yield f"event: {item['event']}\ndata: {payload}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })
