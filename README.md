# ShopfloorIQ — Manufacturing Intelligence

A specialized platform designed to bridge the gap between unstructured supplier communication and manufacturing operations.

---

## The Problem

In manufacturing, production schedules rely on accurate, up-to-the-minute data. Currently, critical updates are trapped in a **"Black Hole of Email."**

- **Information Silos:** Suppliers send updates in dozens of different text and PDF formats.
- **Manual Bottlenecks:** Procurement teams spend hours manually transcribing emails into spreadsheets or ERPs.
- **Delayed Response:** Missing a "Production Delay" notification by even a few hours can lead to idle production lines and wasted labor costs.

---

## The Solution

This system automates Proces-Order tracking so supply chain managers always know what's coming.

- **Intelligent Parsing:** Converts messy, unstructured supplier emails into clean, actionable data with zero manual entry.
- **Risk Categorization:** Automatically flags Product Delays and Shipment Delays, allowing teams to prioritize urgent bottlenecks over routine orders.
- **Production Readiness:** Provides the warehouse and assembly teams with a centralized view of status to optimize floor space and labor allocation.

---

## Core Features

### 1. Zero-Friction Email Parsing

- Users paste raw supplier emails directly into the system.
- The engine extracts PO IDs, supplier names, line items, and fulfillment dates.
- Gracefully handles diverse formatting from different global logistics providers.

### 2. Operational Status Tracking

Monitors the lifecycle of every order across four critical manufacturing states:

| Status | Description |
|---|---|
| ✅ **On Track** | Production and logistics are proceeding as planned. |
| ⚠️ **Product Delays** | Immediate flag for manufacturing or material shortages at the source. |
| 📦 **Shipped** | Signals the warehouse to prepare for inbound receiving. |
| 🚨 **Shipment Delay** | Alerts logistics teams to potential JIT (Just-In-Time) inventory gaps. |

### 3. Management Dashboard

- **Triage View:** A high-density table for quick status assessment.
- **Search & Filter:** Instantly isolate all delayed orders or specific supplier performance.
- **Audit Trail:** Tracks "Last Updated" timestamps to ensure data freshness for production meetings.

---

## Requirements

### Feature Breakdown

#### 📧 Email Parsing
- Paste raw supplier emails into a text area for instant processing
- Automatically extract PO ID, supplier name, line items, dates, and status
- Handles multiple email formats and layouts gracefully

#### 📊 PO Status Tracking

Each PO is assigned one of the following operational states:

| Status | Meaning |
|--------|---------|
| ✅ `On Track` | Order is progressing normally |
| ⚠️ `Product Delays` | Manufacturing or production issues at the source |
| 📦 `Shipped` | Order has been dispatched |
| 🚨 `Shipment Delay` | Logistics or shipping issues detected |

#### 🗂️ PO Management
- View all active POs in a centralized dashboard
- Filter and search by PO ID, supplier name, or status
- Manually override or update PO status as needed

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

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Python, FastAPI, uvicorn |
| **Database** | In-memory store (local, no external DB required) |

---

## Sample Email Formats

The parser is designed to handle a wide variety of real-world supplier email formats:

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

Please refer installation_testing.md.

## Project Structure
```
smart-po/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── ...
└── README.md
```