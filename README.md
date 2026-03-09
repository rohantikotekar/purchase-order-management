# ShopFoorIQ - Manufacturing Intelligence

A specialized platform designed to bridge the gap between unstructured supplier communication and manufacturing operations.

---

## The Problem

In manufacturing, production schedules rely on accurate, up-to-the-minute data. Currently, critical updates are trapped in a **"Black Hole of Email."**

- **Information Silos:** Suppliers send updates in dozens of different text and PDF formats.
- **Manual Bottlenecks:** Procurement teams spend hours manually transcribing emails into spreadsheets or ERPs.
- **Delayed Response:** Missing a "Production Delay" notification by even a few hours can lead to idle production lines and wasted labor costs.

---

## The Solution

Automates Purchase Order tracking so supply chain managers always know what's coming.

- **Intelligent Parsing:** Converts messy, unstructured supplier emails into clean, actionable data with zero manual entry.
- **Risk Categorization:** Automatically flags Product Delays and Shipment Delays, allowing teams to prioritize urgent bottlenecks over routine orders.
- **Production Readiness:** Provides warehouse and assembly teams with a centralized view of status to optimize floor space and labor allocation.

---

## Features

### 📧 Email Parsing
- Paste raw supplier emails into the Parser Engine for instant processing
- Automatically extracts PO ID, supplier name, line items, dates, and status
- Handles multiple email formats and layouts gracefully
- Validates input length before submission

### 📊 PO Status Tracking

Each PO is assigned one of the following operational states:

| Status | Meaning |
|--------|---------|
| ✅ `On Track` | Order is progressing normally |
| ⚠️ `Product Delays` | Manufacturing or production issues at the source |
| 📦 `Shipped` | Order has been dispatched |
| 🚨 `Shipment Delay` | Logistics or shipping issues detected |

### 🗂️ PO Management
- **Edit PO ID:** Inline renaming with duplicate validation (max 20 characters)
- **Delete Orders:** Confirmation modal to prevent accidental deletion
- **Search Orders:** Real-time filtering by PO ID, supplier name, or item details
- **Download Manifest:** One-click CSV export compatible with Excel and Google Sheets

### 📈 Dashboard Metrics
- At-a-glance stats: Active Orders, On Track, Critical Delays, and Fulfilled counts
- Interactive headers for instant scrolling between Dashboard and Live Manifest

---

### Dashboard Preview

| PO ID | Supplier | Items | Expected Date | Status | Last Updated |
|-------|----------|-------|---------------|--------|--------------|
| PO-45821 | Vertex Industrial | 500x Steel Bracket A, 200x Steel Bracket B | Jan 15, 2024 | ✅ On Track | Jan 2, 2024 |
| NX2024-0012 | NovEx Freight | 100x Drive Unit V2, 50x Control Module | Jan 10, 2024 | 📦 Shipped | Jan 10, 2024 |
| PO12345 | Pinnacle Manufacturing | 300x Hydraulic Seal Z | Feb 5, 2024 | ⚠️ Product Delays | Jan 8, 2024 |
| PO-8821 | SwiftRoute Logistics | 1000x Assembly Kit Pro | Jan 20, 2024 | 🚨 Shipment Delay | Jan 18, 2024 |
| PO-2024-001 | Orion Components | 100x PCB Module Rev2 | Feb 10, 2024 | ✅ On Track | Jan 5, 2024 |

---

## System Design

### Backend Architecture

1. **Ingestion:** API receives raw email text and sanitizes input (removes null bytes and control characters)
2. **Extraction:** Calls OpenAI with Structured Outputs to enforce a strict JSON schema
3. **Validation:** Pydantic models validate data integrity (e.g., `YYYY-MM-DD` date formats)
4. **Persistence:** `asyncio.Lock` ensures atomic writes to shared in-memory state, preventing race conditions

### AI Engine — OpenAI GPT-4o

- **Structured Outputs** guarantees valid JSON schema adherence, eliminating parsing errors
- **Regex Fallback** ensures business continuity during AI outages (rate limits / 503s)

### Key Assumptions

- Dates without a year default to the current calendar year
- **Expected Date** takes priority over **Ship Date** if both are present
- If only one date is found, it is treated as the Expected Date unless explicitly labeled "Shipped"

---

## Cost Analysis (GPT-4o)

| Metric | Value |
|--------|-------|
| Input pricing | $2.50 / 1M tokens |
| Output pricing | $10.00 / 1M tokens |
| Avg. input per email | ~593 tokens (500 system prompt + ~93 content) |
| Avg. output per email | ~150 tokens |
| **Cost per email** | **~$0.003** |

**Projected Monthly Costs**

| Emails / Day | Daily Cost | Monthly Cost |
|:-------------|:-----------|:-------------|
| 25 | $0.075 | $2.25 |
| 100 | $0.30 | $9.00 |
| 500 | $1.50 | $45.00 |
| 1,000 | $3.00 | $90.00 |

> Peak LLM parsing latency: **2.3s**. At 1,000 emails/day, monthly cost stays under $100.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, framer-motion |
| **Backend** | Python, FastAPI, uvicorn, Pydantic, Tenacity |
| **AI Engine** | OpenAI GPT-4o (Structured Outputs) + Regex fallback |
| **Testing** | Pytest |
| **Database** | In-memory store (no external DB required) |

---

## Testing

Run the full test suite with:
```bash
python -m pytest -q
```

Covers:
- **Mocking** — Simulates OpenAI responses without API costs
- **Concurrency** — Validates simultaneous writes don't corrupt data
- **Input Validation** — Rejects empty strings, oversized payloads, and injection attempts
- **Resilience** — Tests regex fallback when AI is unavailable
- **Workflow** — Full Create → Read → Update → Delete lifecycle

---

## Sample Email Formats

**Format 1 — Standard Order Update**
```
Subject: PO Update - PO-45821

Hi,

Your order PO-45821 from Acme Supplies is on track.

Expected ship date: Jan 15, 2024
Items: 500x Widget A, 200x Widget B

Thanks,
Acme Supplies Team
```

**Format 2 — Logistics Shipment Notification**
```
From: logistics@globaltech.com
Subject: Shipment Notification

Purchase Order: GT2024-0012
Status: SHIPPED
Tracking: 1Z999AA10123456784
Ship Date: 2024-01-10

Items included:
- 100 units Model X
- 50 units Model Y

GlobalTech Logistics
```

**Format 3 — Urgent Delay Alert**
```
URGENT: Production Delay - PO12345

Due to material shortages, we're experiencing delays on PO12345.

Original delivery: Jan 20
Revised delivery: Feb 5

Supplier: MegaCorp International
```

---

## Setup & Installation

Please refer to `installation_testing.md` for full setup instructions.

---

## Project Structure
```
relay/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── test_all.py
├── frontend/
│   ├── app/
│   ├── components/
│   └── package.json
├── features.md
├── installation_testing.md
└── README.md
```