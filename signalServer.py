from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import uvicorn

app = FastAPI()

# Allow CORS for local frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Signal(BaseModel):
    id: str
    symbol: str
    timeframe: str
    entryTime: int
    entryPrice: float
    stopLoss: float
    takeProfit: float
    trailingSL: Dict = {}
    trailingTP: Dict = {}
    confidence: float
    strategy: str
    eventType: str  # "open", "update", "close"

# In-memory queue of active WebSocket connections
active_connections: List[WebSocket] = []

@app.post("/signals")
def post_signal(signal: Signal = Body(...)):
    # Broadcast to all connected WebSocket clients
    message = signal.dict()
    for conn in active_connections:
        try:
            conn.send_json(message)
        except:
            pass
    return {"status": "sent", "signal": message}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection open
    except WebSocketDisconnect:
        active_connections.remove(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
