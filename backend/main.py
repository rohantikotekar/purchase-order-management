import os
import datetime
import logging
import asyncio
import re
from typing import List, Optional, Dict
from enum import Enum
from contextlib import asynccontextmanager

from fastapi import FastAPI, Body, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, ValidationInfo
from openai import OpenAI, APIConnectionError, RateLimitError, APITimeoutError
from dotenv import load_dotenv
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log
)

# --------------------
# 0. CONFIGURATION & LOGGING
# --------------------
load_dotenv()

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("PO_API")

# Validate API Key on Startup
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.critical("FATAL: OPENAI_API_KEY is missing from environment variables.")
    raise RuntimeError("OPENAI_API_KEY is missing.")

client = OpenAI(api_key=api_key)

# In-memory database & Concurrency Lock
db: List[dict] = []
PO_LOCK = asyncio.Lock()  # Prevents race conditions

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
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://169.254.83.107:3000",
    "https://rohan-po-fullstack.vercel.app",
    "https://rohan-po-fullstack-git-main-rohans-projects-a97c7c7b.vercel.app",
    "https://rohan-po-fullstack-fqajoz29y-rohans-projects-a97c7c7b.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# 3. STRICT MODELS & VALIDATION
# --------------------

class POStatus(str, Enum):
    ON_TRACK = "On Track"
    SHIPPED = "Shipped"
    PRODUCT_DELAYS = "Product Delays"
    SHIPMENT_DELAY = "Shipment Delay"
    UNKNOWN = "Unknown"

class DateLabel(str, Enum):
    EXPECTED = "Expected"
    SHIPPED = "Shipped"
    UNKNOWN = "Unknown"

class ParsedPO(BaseModel):
    id: str = Field(..., description="The Purchase Order ID.")
    
    supplier: str = Field(..., description="Name of the supplier. Return 'Unknown' if missing.")
    items: str = Field(..., description="Summary of items. Return 'Unknown' if missing.")
    
    date_label: DateLabel = Field(..., description="Type of date found.")
    date_value: str = Field(..., description="Date in YYYY-MM-DD format, or 'N/A' if Unknown.")
    
    status: POStatus = Field(..., description="Current status of the order. Return 'Unknown' if not explicitly mentioned.")

    #  enforce YYYY-MM-DD
    @field_validator('date_value')
    @classmethod
    def validate_date_format(cls, v: str, info: ValidationInfo) -> str:
        if v.upper() == 'N/A':
            return 'N/A'
        try:
            datetime.datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError(f"Date '{v}' is not in YYYY-MM-DD format.")

class ExtractionResult(BaseModel):
    is_valid: bool = Field(..., description="True if text contains a PO Number. False if text is gibberish/spam.")
    po_data: Optional[ParsedPO] = Field(None)

class POUpdate(BaseModel):
    status: Optional[POStatus] = None
    id: Optional[str] = Field(None, min_length=1, max_length=20, description="New ID if renaming the order.")

# --------------------
# 4. HELPERS
# --------------------

def normalize_po_id(po_id: str) -> str:
    return (po_id or "").strip().upper()

def today_str() -> str:
    return datetime.date.today().strftime("%b %d, %Y")

def sanitize_input(text: str) -> str:
    """Removes null bytes and control characters."""
    if not text:
        return ""
    text = text.replace("\x00", "")
    text = re.sub(r'[^\x20-\x7E\n\t]', '', text)
    return text.strip()

# --------------------
# 5. FALLBACK PARSER (REGEX-BASED)
# --------------------

def extract_po_fallback(email_text: str) -> Optional[ExtractionResult]:
    """
    Fallback parser using regex when OpenAI is unavailable.
    Extracts basic PO information without AI.
    """
    try:
        logger.info("Attempting fallback regex extraction")
        
        # Extract PO ID - look for common patterns
        po_patterns = [
            r'PO[-: ]?([A-Z0-9-]+)',  # PO-12345, PO:12345, PO 12345
            r'Purchase\s*Order[-: ]?([A-Z0-9-]+)',  # Purchase Order: 12345
            r'Order\s*#?[\s:]?([A-Z0-9-]+)',  # Order #12345, Order: 12345
            r'P\.?O\.?[-: ]?([A-Z0-9-]+)',  # P.O.-12345, PO-12345
        ]
        
        po_id = None
        for pattern in po_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                po_id = match.group(1).strip()
                logger.info(f"Fallback extracted PO ID: {po_id}")
                break
        
        if not po_id:
            logger.warning("Fallback parser could not find PO ID")
            return ExtractionResult(is_valid=False, po_data=None)
        
        # Extract supplier - look after "from", "supplier:", etc.
        supplier = "Unknown"
        supplier_patterns = [
            r'from\s+([A-Za-z0-9\s&.-]+?)(?:\n|\.|,|$|;)',
            r'supplier[:\s]+([A-Za-z0-9\s&.-]+?)(?:\n|\.|,|$|;)',
            r'vendor[:\s]+([A-Za-z0-9\s&.-]+?)(?:\n|\.|,|$|;)',
            r'company[:\s]+([A-Za-z0-9\s&.-]+?)(?:\n|\.|,|$|;)',
        ]
        
        for pattern in supplier_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                supplier = match.group(1).strip()
                break
        
        # Extract date
        date_value = "N/A"
        date_label = DateLabel.UNKNOWN
        date_patterns = [
            r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
            r'expected:?\s*(\d{4}-\d{2}-\d{2})',
            r'delivery:?\s*(\d{4}-\d{2}-\d{2})',
            r'ship:?\s*(\d{4}-\d{2}-\d{2})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                date_value = match.group(1)
                date_label = DateLabel.EXPECTED
                break
        
        # Extract items - simple approach
        items = "Unknown"
        items_patterns = [
            r'items?:?\s*(.+?)(?:\n|\.|$|;)',
            r'products?:?\s*(.+?)(?:\n|\.|$|;)',
            r'quantity:?\s*(.+?)(?:\n|\.|$|;)',
        ]
        
        for pattern in items_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                items = match.group(1).strip()[:100]  # Limit length
                break
        
        # Default to UNKNOWN status
        status = POStatus.UNKNOWN
        
        # Check for status keywords
        if re.search(r'on track|on schedule|proceeding', email_text, re.IGNORECASE):
            status = POStatus.ON_TRACK
        elif re.search(r'shipped|dispatched|in transit', email_text, re.IGNORECASE):
            status = POStatus.SHIPPED
        elif re.search(r'product delay|manufacturing delay', email_text, re.IGNORECASE):
            status = POStatus.PRODUCT_DELAYS
        elif re.search(r'shipment delay|delivery delay|shipping delay', email_text, re.IGNORECASE):
            status = POStatus.SHIPMENT_DELAY
        
        logger.info(f"Fallback parser succeeded for PO: {po_id}")
        
        return ExtractionResult(
            is_valid=True,
            po_data=ParsedPO(
                id=po_id,
                supplier=supplier[:50],
                items=items,
                date_label=date_label,
                date_value=date_value,
                status=status
            )
        )
        
    except Exception as e:
        logger.error(f"Fallback parser failed: {e}")
        return None

# --------------------
# 6. ROBUST LLM EXTRACTION WITH FALLBACK
# --------------------

@retry(
    retry=retry_if_exception_type((RateLimitError, APITimeoutError, APIConnectionError)),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(2),  # Reduced attempts to fail faster
    before_sleep=before_sleep_log(logger, logging.WARNING)
)
def extract_po_robust(email_text: str) -> ExtractionResult:
    """
    Extracts PO data with retries using STRUCTURED OUTPUTS.
    Falls back to regex parser if OpenAI is unavailable.
    """
    logger.info(f"Sending request to OpenAI (Length: {len(email_text)} chars)")
    
    # Try OpenAI first
    try:
        response = client.responses.parse(
            model="gpt-4o-2024-08-06",
            input=[
                {
                    "role": "system", 
                    "content": (
                        f"You are a strict Purchase Order extraction system. Today's date: {datetime.date.today()}.\n\n"
                        "RULES:\n"
                        "1. VALIDITY: Set is_valid=True ONLY if you find a clear PO number/ID. Otherwise False.\n"
                        "2. PO ID: Extract the purchase order number/ID exactly as written.\n"
                        "3. SUPPLIER: Extract supplier name. Use 'Unknown' if not found.\n"
                        "4. ITEMS: Summarize items briefly. Use 'Unknown' if not found.\n"
                        "5. DATE: Extract delivery/shipping date in YYYY-MM-DD format.\n"
                        f"   - If year is missing (e.g., 'Jan 20'), assume {datetime.date.today().year}\n"
                        "   - If no date found, set date_label='Unknown' and date_value='N/A'\n"
                        "6. STATUS: Use 'Unknown' as default. ONLY use specific status if EXPLICITLY stated:\n"
                        "   - 'On Track' if text says 'on track', 'on schedule', 'proceeding as planned'\n"
                        "   - 'Shipped' if text says 'shipped', 'dispatched', 'in transit'\n"
                        "   - 'Product Delays' if text mentions 'product delay', 'manufacturing delay'\n"
                        "   - 'Shipment Delay' if text mentions 'shipping delay', 'delivery delay'\n"
                        "   - Otherwise use 'Unknown'\n\n"
                        "DO NOT invent or infer data. Use 'Unknown'/'N/A' for missing information."
                    )
                },
                {"role": "user", "content": email_text},
            ],
            text_format=ExtractionResult,
        )
        result = response.output_parsed
        logger.info("OpenAI extraction successful")
        return result
        
    except Exception as e:
        logger.warning(f"OpenAI extraction failed: {type(e).__name__}: {e}. Attempting fallback...")
        
        # FALLBACK: Use regex parser
        fallback_result = extract_po_fallback(email_text)
        
        if fallback_result and fallback_result.is_valid:
            logger.info("Fallback parser succeeded - using regex extracted data")
            return fallback_result
        
        # If fallback also fails or couldn't find PO, re-raise
        logger.error("Both OpenAI and fallback parsers failed")
        raise e

# --------------------
# 7. ROUTES
# --------------------

@app.get("/pos")
def get_all_pos():
    return sorted(db, key=lambda x: x['last_updated'], reverse=True)

@app.post("/parse")
async def parse_email_route(payload: dict = Body(...)):
    raw_text = payload.get("text", "")
    clean_text = sanitize_input(raw_text)
    
    if not clean_text:
        raise HTTPException(status_code=400, detail="Input text is empty.")
    
    if len(clean_text) > 1000:
        raise HTTPException(status_code=400, detail="Text too long (max 1000 chars).")

    # 1. Robust Extraction with Fallback
    try:
        result = await asyncio.to_thread(extract_po_robust, clean_text)
    except Exception as e:
        logger.error(f"Failed to process request: {e}")
        # Return 202 Accepted with partial info if possible, otherwise 503
        raise HTTPException(status_code=503, detail="AI Service Unavailable. Please try again later.")

    # 2. Logic Validation
    if not result.is_valid or not result.po_data:
        raise HTTPException(
            status_code=400, 
            detail="Invalid Input: Text does not appear to contain a Purchase Order."
        )

    raw_data = result.po_data

    # 3. Format Data
    if raw_data.date_label == DateLabel.UNKNOWN:
        final_date_str = "Unknown"
    else:
        final_date_str = f"{raw_data.date_label.value}: {raw_data.date_value}"

    po_dict = {
        "id": normalize_po_id(raw_data.id),
        "supplier": raw_data.supplier,
        "items": raw_data.items,
        "expected_date": final_date_str,
        "status": raw_data.status.value,
        "last_updated": today_str()
    }
    
    pid = po_dict["id"]

    # 4. ATOMIC DB WRITE
    async with PO_LOCK:
        existing_po = next((po for po in db if normalize_po_id(po["id"]) == pid), None)
        
        if existing_po:
            logger.warning(f"Duplicate PO blocked: {pid}")
            return JSONResponse(
                status_code=409, 
                content={"detail": f"Purchase Order {pid} already exists."}
            )

        db.append(po_dict)
        logger.info(f"Successfully inserted PO: {pid} (Source: {'OpenAI' if 'gpt' in str(raw_data) else 'Fallback'})")
    
    return {"duplicate": False, "po": po_dict}

@app.patch("/pos/{po_id}")
async def update_po(po_id: str, update: POUpdate):
    target_id = normalize_po_id(po_id)
    
    async with PO_LOCK:
        po_index = next((i for i, po in enumerate(db) if normalize_po_id(po["id"]) == target_id), None)

        if po_index is None:
            raise HTTPException(status_code=404, detail="PO not found")

        po = db[po_index]

        if update.status:
            po["status"] = update.status.value
            
        if update.id:
            new_id = normalize_po_id(update.id)
            
            if new_id != target_id:
                duplicate = next((item for item in db if normalize_po_id(item["id"]) == new_id), None)
                if duplicate:
                    raise HTTPException(
                        status_code=409, 
                        detail=f"Cannot rename to {new_id}: Order ID already exists."
                    )
                
                old_id = po["id"]
                po["id"] = new_id
                logger.info(f"Renamed PO {old_id} to {new_id}")

        po["last_updated"] = today_str()
        return po

@app.delete("/pos/{po_id}")
async def delete_po(po_id: str):
    target_id = normalize_po_id(po_id)
    
    async with PO_LOCK:
        initial_len = len(db)
        db[:] = [po for po in db if normalize_po_id(po["id"]) != target_id]
        
        if len(db) == initial_len:
            raise HTTPException(status_code=404, detail="PO not found")
        
    logger.info(f"Deleted PO: {target_id}")
    return {"message": "Deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)