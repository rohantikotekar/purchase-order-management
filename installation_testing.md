# Installation & Testing Guide

## 1. Installation & Setup

### Backend (FastAPI)

Run these commands in your terminal to set up the server.

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Create a Python virtual environment
py -3.12 -m venv .venv

# 3. Activate virtual env 

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Mac / Linux
source .venv/bin/activate

# 4. Upgrade pip and build tools
python -m pip install --upgrade pip setuptools wheel

# 5. Install Python dependencies
pip install -r requirements.txt

# 6. Start the backend server
uvicorn main:app --reload

### Frontend (Next.js)

Open a **new terminal window** and run these commands to set up the user interface.

```bash
# 1. Navigate to the frontend folder
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start the Development Server
npm run dev

```

*App is now running at: `http://localhost:3000*`

---

## 2. Automated Testing

 Robust test suite covering logic, database locking, and AI mocking.

**Run the tests:**
Make sure you are in the `backend` directory.

```bash
python -m pytest -q

```

**What is being tested?**

* **Unit Tests:** Checks helper functions like ID normalization.
* **Integration:** Tests the full flow (Create → Read → Update → Delete).
* **AI Resilience:** Ensures the system retries if OpenAI is busy (Rate Limits).
* **Mocking:** Simulates OpenAI so you don't spend money running tests.

* check file: test_all.py in home directory for tests

---

## 3. API Testing (Swagger UI)

You can manually test all endpoints using the interactive Swagger UI.

**Go to:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Sample Test Scenarios

**1. Create Order (Parse Email)**

* **Click:** `POST /parse` → `Try it out`
* **Paste JSON:**
```json
{
  "text": "Please process PO-9999 from Acme Corp. Items: 500 Widgets. Delivery expected by 2026-12-25."
}

```


* **Click:** `Execute`
* **Result:** `200 OK`

**2. Update Order Status**

* **Click:** `PATCH /pos/{po_id}` → `Try it out`
* **po_id:** `PO-9999`
* **Paste JSON:**
```json
{
  "status": "Shipped"
}

```


* **Click:** `Execute`

**3. Rename Order ID**

* **Click:** `PATCH /pos/{po_id}` → `Try it out`
* **po_id:** `PO-9999`
* **Paste JSON:**
```json
{
  "id": "PO-NEW-ID"
}

```


* **Click:** `Execute`

**4. Delete Order**

* **Click:** `DELETE /pos/{po_id}` → `Try it out`
* **po_id:** `PO-NEW-ID`
* **Click:** `Execute`

---

## 4. Manual Testing Scenarios (Edge Cases)

Use the **Parser Engine** on the frontend or the **Swagger UI** to test these specific edge cases.

| Scenario | Input Text / Action | Expected Result |
| --- | --- | --- |
| **1. Minimal Valid** | `PO-12345` | **200 OK**: Extracted successfully. |
| **2. Complete PO** | `PO-67890 from Acme Corporation Items: 500x Widgets... Expected Delivery: March 15, 2026 Status: On Track` | **200 OK**: All fields populated correctly. |
| **3. Missing Year** | `PO-11111 from Test Corp Expected: Feb 28` | **200 OK**: Year defaults to current year (e.g., 2026). |
| **4. Ambiguous Status** | `PO-22222 Status: Delayed but on schedule now` | **200 OK**: AI infers "On Track" or "Unknown". |
| **5. Multiple Dates** | `PO-33333 Order: Jan 1, Ship: Feb 15, Delivery: Mar 1` | **200 OK**: Prioritizes "Delivery/Expected" date (Mar 1). |
| **6. Special Chars** | `PO-44444-ABC#123 from Supplier™ Inc. Items: Wídgëts` | **200 OK**: Handles special characters correctly. |
| **7. Long Text** | `PO-33334 Order: Jan 1, Ship: Feb 15, Delivery: Mar 1 from [insert 2000 chars of lorem ipsum]` | **200 OK**: Handles text up to 3000 chars. |
| **8. Duplicate Test** | Submit `PO-DUP` → Submit `PO-DUP` again immediately. | **409 Conflict**: Second submission blocked. |
| **9. Case Variation** | Submit `po-case-test` → Submit `PO-CASE-TEST` | **409 Conflict**: Blocked (Case-insensitive check). |
| **10. Gibberish** | `asdfjkl qwerty zxcvbn 12345 !@#$%` | **400 Bad Request**: Rejects invalid input. |
| **11. SQL Injection** | `PO-12345'; DROP TABLE pos; --` | **200 OK**: Treated as literal text. Database safe. |
| **12. XSS Attempt** | `PO-<script>alert('xss')</script>-12345` | **200 OK**: HTML tags treated as text, not executed. |
| **13. Unicode/Emoji** | `PO-🚀12345 from 北京公司 Items: 产品🔧` | **200 OK**: UTF-8 handled correctly. |
| **14. Whitespace** | `[Press space/tab/enter many times]` | **400 Bad Request**: Empty input rejected. |
