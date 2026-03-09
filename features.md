# Purchase Order Management System

## Frontend Features

1. **Add New Order:**
   Accepts raw, unstructured email text via the Parser Engine. Validates input length before submission.

2. **Edit PO ID:**
   Allows inline renaming of Purchase Order IDs. Includes validation to prevent duplicate IDs. Max length set to 20.

3. **Delete Orders:**
   Removes orders from the manifest. Protected by a confirmation modal to prevent accidental deletion.

4. **Search Orders:**
   Real-time filtering of the manifest based on PO ID, Supplier name, or Item details.

5. **View Metrics:**
   Displays high-level statistics including Active Orders, On Track status, Critical Delays, and Fulfilled counts.

6. **Scroll Navigation:**
   Interactive headers allow instant scrolling between the Dashboard (top) and the Live Manifest (table).

7. **Download Live Manifest:**
   One-click export of the current table view to a `.csv` file. Compatible with Excel and Google Sheets for easy sharing and reporting.

## Backend System Design

### System Flow

1. **Ingestion:** API receives raw text and performs sanitization (removing null bytes/control characters).
2. **Extraction:** Robustly calls OpenAI using Structured Outputs to enforce a strict JSON schema.
3. **Validation:** Pydantic models validate data integrity (e.g., YYYY-MM-DD date formats).
4. **Persistence:** An asyncio lock acquires exclusive access to the database to prevent race conditions during write/update operations.

### Test Robustness

This project uses a comprehensive test suite (`test_all.py`) to ensure stability. Run with: `python -m pytest -q`

* **Mocking:** Simulates OpenAI responses to test logic without API costs or latency.
* **Concurrency:** Validates that multiple simultaneous writes/updates do not corrupt data.
* **Input Validation:** Ensures the system rejects empty strings, massive payloads, and SQL injection attempts.
* **Resilience:** Uses regex functionality when the AI service is unavailable (Rate Limits/503s).
* **Workflow:** Tests complete lifecycles (Create → Read → Update → Delete) to guarantee end-to-end functionality.

### Production Readiness

* **Type Safety:** Uses Python Enum and Pydantic models to strictly enforce data schemas throughout the lifecycle.
* **Observability:** Structured logging provides detailed audit trails for system startup, database operations, and errors.
* **Concurrency Control:** Uses `asyncio.Lock` to ensure atomic operations on the shared in-memory state.
* **Resilience:** Uses regex functionality when the AI service is unavailable (Rate Limits/503s).

## Tech Stack & Rationale

**Backend: Python & FastAPI**
* **Key Libraries:** `uvicorn` (ASGI server), `pydantic` (validation), `tenacity` (retries), `openai` (AI client).

**Frontend: Next.js & React**
* **Key Libraries:** `framer-motion` (animations), `lucide-react` (icons), `sonner` (toast notifications), `tailwindcss` (styling).

**AI Engine: OpenAI (GPT-4o)**
* **Why:** The `Structured Outputs` feature guarantees valid JSON schema adherence, eliminating parsing errors common with other LLMs.
* **Fallback:** Custom Regex parser ensures business continuity even during AI outages.

**Testing: Pytest**
* **Why:** Industry standard for Python testing; supports powerful fixtures and easy mocking of external services.

## Key Assumptions

* **Date Resolution:** Dates lacking a year default to the current calendar year unless an email header specifies otherwise.
* **Date Priority:** The system prioritizes **Expected Date** over **Ship Date** if both appear. If only one date is found, it is treated as the Expected Date unless explicitly labeled "Shipped".
* **Volume Scaling:** Cost estimates are modeled on variable daily loads ranging from 25 to 1,000 emails.

## Cost Analysis (GPT-4o)

**Token Economics**

* **Input Pricing:** $2.50 per 1,000,000 tokens
* **Output Pricing:** $10.00 per 1,000,000 tokens
* **Average Email:** ~93 tokens / ~350 characters (calculated from 3 sample emails in readme.md)
* **Total Input Payload:** ~593 tokens (500 system prompt + 93 user content)
* **Total Output Payload:** ~150 tokens (Structured JSON)

**Per-Request Cost Calculation**

* **Input:** 593 / 1,000,000 × $2.50 = $0.00148
* **Output:** 150 / 1,000,000 × $10.00 = $0.00150
* **Total:** **$0.0030 per email** (approx 0.3 cents)

**Projected Operating Costs**

| Emails / Day | Daily Cost | Monthly Cost (30 Days) |
| :--- | :--- | :--- |
| 25 | $0.075 | $2.25 |
| 50 | $0.15 | $4.50 |
| 100 | $0.30 | $9.00 |
| 250 | $0.75 | $22.50 |
| 500 | $1.50 | $45.00 |
| 1,000 | $3.00 | $90.00 |

**Summary**: $0.003 per transaction, scaling to 1,000 emails daily remains highly cost-effective at under $100/month. The system is optimized for performance with a peak LLM parsing latency of 2.3s.

**Note**: Incremental bug fixes and feature enhancements implemented from Feb 7 to 10 Feb (~3-4 hours), 11 Feb (~6 hours)
