from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .csv_batch import process_csv_batch
from .hybrid_scoring import score_transaction
from .models import TransactionRequest

app = FastAPI(title="Vaaligard scoring API")

# Dev-only: wide open so the webpack-dev-server origin (any port) can call
# this without extra config. Restrict to the deployed frontend origin(s)
# before shipping this anywhere real.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/score")
def score(request: TransactionRequest):
    return score_transaction(request.model_dump())


@app.post("/score/batch")
async def score_batch(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    raw_bytes = await file.read()
    try:
        raw_text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not read this file as UTF-8 text.")

    results = process_csv_batch(raw_text)
    return {"results": results}
