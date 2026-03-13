import os
import datetime
import logging
import asyncio
import re
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from openai import OpenAI, APIConnectionError, RateLimitError, APITimeoutError
from dotenv import load_dotenv
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

# --------------------
# 0. CONFIGURATION & LOGGING
# --------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("PO_API")

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.critical("FATAL: OPENAI_API_KEY is missing.")
    raise RuntimeError("OPENAI_API_KEY is missing.")

client = OpenAI(api_key=api_key)

# In-memory database & concurrency lock
db: List[dict] = []
PO_LOCK = asyncio.Lock()

# --------------------
# 1. LIFECYCLE
# --------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("System Startup: Database initialized.")
    yield
    logger.info("System Shutdown.")


app = FastAPI(title="PO Management System API", lifespan=lifespan)

# --------------------
# 2. CORS
# --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# 3. STRICT MODELS
# --------------------
class ParsedPO(BaseModel):
    id: str = Field(
        ..., description="The FULL exact PO ID (e.g. PO-45821). No 'PO#' prefix."
    )
    supplier: str = Field(
        default="N/A",
        description="Legal company name only. Use N/A if not explicitly present.",
    )
    items: str = Field(
        default="N/A",
        description="Summary list of products/quantities. Use N/A if not explicitly present.",
    )
    date_value: str = Field(
        default="N/A",
        description="YYYY-MM-DD format. Use N/A if missing or not explicitly present.",
    )
    status: str = Field(
        default="N/A",
        description="One of: On Track, Shipped, Product Delays, Shipment Delay. Use N/A if not explicitly present.",
    )


class ExtractionResult(BaseModel):
    is_valid: bool = Field(..., description="True if text contains a PO Number.")
    po_data: Optional[ParsedPO] = Field(None)


class POUpdate(BaseModel):
    status: Optional[str] = None
    id: Optional[str] = Field(None, min_length=1, max_length=50)


# --------------------
# 4. HELPERS
# --------------------
def normalize_po_id(po_id: str) -> str:
    return (po_id or "").strip()


def today_str() -> str:
    return datetime.date.today().strftime("%b %d, %Y")


def sanitize_input(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\x00", "")
    text = re.sub(r"[^\x20-\x7E\n\t]", "", text)
    return text.strip()


def normalize_field(value: Optional[str]) -> str:
    """Force missing/unknown-like values to N/A."""
    if value is None:
        return "N/A"

    cleaned = value.strip()
    if cleaned.lower() in {
        "",
        "unknown",
        "not provided",
        "not mentioned",
        "missing",
        "n/a",
        "none",
        "null",
    }:
        return "N/A"

    return cleaned


# --------------------
# 5. FALLBACK PARSER (REGEX)
# --------------------
def extract_po_fallback(email_text: str) -> Optional[ExtractionResult]:
    try:
        logger.info("Attempting fallback regex extraction")
        po_match = re.search(
            r"(?:PO|Order|P\.?O\.?)[#\s:.-]*([A-Z0-9-]+)",
            email_text,
            re.IGNORECASE,
        )
        if not po_match:
            return ExtractionResult(is_valid=False, po_data=None)

        full_id = po_match.group(1).strip()

        return ExtractionResult(
            is_valid=True,
            po_data=ParsedPO(
                id=full_id,
                supplier="N/A",
                items="N/A",
                date_value="N/A",
                status="N/A",
            ),
        )
    except Exception as e:
        logger.error(f"Fallback failed: {e}")
        return None


# --------------------
# 6. ROBUST LLM EXTRACTION
# --------------------
@retry(
    retry=retry_if_exception_type(
        (RateLimitError, APITimeoutError, APIConnectionError)
    ),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(2),
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def extract_po_robust(email_text: str) -> ExtractionResult:
    logger.info(f"Sending request to OpenAI (Length: {len(email_text)} chars)")

    try:
        response = client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a strict information extraction tool. Today is {datetime.date.today()}.\n\n"
                        "Extract purchase order fields ONLY if they are explicitly present in the text.\n"
                        "Never infer, guess, assume, or fabricate any field.\n"
                        "If a field is missing, ambiguous, or not explicitly stated, return 'N/A'.\n"
                        "Do not use prior knowledge. Do not complete partial records.\n\n"
                        "STRICT RULES:\n"
                        "1. PO ID: Extract the FULL exact PO ID if explicitly present.\n"
                        "2. SUPPLIER: Extract supplier/company name if explicitly present. Else 'N/A'.\n"
                        "3. ITEMS: Extract items only if explicitly present. Else 'N/A'.\n"
                        "4. DATE: Convert explicit expected/delivery/shipping date to YYYY-MM-DD. Else 'N/A'.\n"
                        "5. STATUS: Must be exactly one of: On Track, Shipped, Product Delays, Shipment Delay. Else 'N/A'. Look for words like delay, late, busy.\n"
                        "6. If only a PO ID is present, return that PO ID and 'N/A' for all other fields.\n"
                        "7. Do not invent supplier names, items, dates, or statuses.\n"
                        "8. Return only the extracted fields as structured data.\n"
                    ),
                },
                {"role": "user", "content": email_text},
            ],
            response_format=ExtractionResult,
        )

        result = response.choices[0].message.parsed

        if result and result.po_data:
            # Cleanup / strict guardrails
            result.po_data.id = normalize_po_id(result.po_data.id)

            result.po_data.supplier = normalize_field(
                re.sub(
                    r"\s+is\s+(on\s+track|shipped|delayed).*",
                    "",
                    result.po_data.supplier,
                    flags=re.IGNORECASE,
                ).strip()
            )

            result.po_data.items = normalize_field(
                re.sub(
                    r"^(items|included|products):\s*",
                    "",
                    result.po_data.items,
                    flags=re.IGNORECASE,
                ).strip()
            )

            result.po_data.date_value = normalize_field(result.po_data.date_value)

            result.po_data.status = normalize_field(result.po_data.status)
            allowed_statuses = {
                "On Track",
                "Shipped",
                "Product Delays",
                "Shipment Delay",
                "N/A",
            }
            if result.po_data.status not in allowed_statuses:
                result.po_data.status = "N/A"

        return result

    except Exception as e:
        logger.warning(f"OpenAI failed: {e}. Trying fallback...")
        fallback = extract_po_fallback(email_text)
        if fallback and fallback.is_valid:
            return fallback
        raise e


# --------------------
# 7. ROUTES
# --------------------
@app.get("/pos")
def get_all_pos():
    return sorted(db, key=lambda x: x["last_updated"], reverse=True)


@app.post("/parse")
async def parse_email_route(payload: dict = Body(...)):
    raw_text = payload.get("text", "")
    clean_text = sanitize_input(raw_text)

    if not clean_text:
        raise HTTPException(status_code=400, detail="Input text is empty.")

    try:
        result = await asyncio.to_thread(extract_po_robust, clean_text)

        if not result.is_valid or not result.po_data:
            raise ValueError("No Purchase Order found in text.")

        raw_data = result.po_data

        po_dict = {
            "id": normalize_po_id(raw_data.id),
            "supplier": normalize_field(raw_data.supplier),
            "items": normalize_field(raw_data.items),
            "expected_date": normalize_field(raw_data.date_value),
            "status": normalize_field(raw_data.status),
            "last_updated": today_str(),
        }

        async with PO_LOCK:
            if any(po["id"] == po_dict["id"] for po in db):
                return JSONResponse(
                    status_code=409,
                    content={"detail": f"PO {po_dict['id']} already exists."},
                )
            db.append(po_dict)

        return {"duplicate": False, "po": po_dict}

    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise HTTPException(status_code=400, detail=f"Error: {str(e)}")


@app.patch("/pos/{po_id}")
async def update_po(po_id: str, update: POUpdate):
    async with PO_LOCK:
        po_index = next((i for i, po in enumerate(db) if po["id"] == po_id), None)
        if po_index is None:
            raise HTTPException(status_code=404, detail="PO not found")

        po = db[po_index]

        if update.status is not None:
            po["status"] = normalize_field(update.status)

        if update.id:
            new_id = normalize_po_id(update.id)
            if any(p["id"] == new_id for p in db if p["id"] != po_id):
                raise HTTPException(status_code=409, detail="ID already exists")
            po["id"] = new_id

        po["last_updated"] = today_str()
        return po


@app.delete("/pos/{po_id}")
async def delete_po(po_id: str):
    async with PO_LOCK:
        global db
        initial_count = len(db)
        db[:] = [po for po in db if po["id"] != po_id]
        if len(db) == initial_count:
            raise HTTPException(status_code=404, detail="PO not found")
    return {"message": "Deleted"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)