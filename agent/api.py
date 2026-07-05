"""
Assay agent API — the endpoint the web AGENT RUN view calls.

    uvicorn api:app --port 8000 --reload

POST /run  {prompt, budget}  → Server-Sent Events stream of the run:
    event: intake | discover | decision | pay_start | pay_done | pay_error
           | synthesize | done
Each SSE `data:` payload is the JSON emitted by the graph's `emit` callback, so the
frontend can render the live decision feed (with refusals front and center) as it happens.

The run executes in a background thread; events flow through a thread-safe queue into the
SSE generator. CORS is open so the Next.js dev server can connect directly.
"""
from __future__ import annotations

import json
import queue
import threading
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from assay.graph import run_task

app = FastAPI(title="Assay Agent API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_SENTINEL = object()


class RunRequest(BaseModel):
    prompt: str
    budget: float = 0.02
    backend: Optional[str] = None
    authorizationId: Optional[str] = None



@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "assay-agent"}


@app.post("/run")
def run(req: RunRequest) -> StreamingResponse:
    q: "queue.Queue[Any]" = queue.Queue()

    def emit(event: str, data: Dict[str, Any]) -> None:
        q.put({"event": event, "data": data})

    def worker() -> None:
        try:
            run_task(req.prompt, req.budget, emit=emit, backend_url=req.backend,
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
