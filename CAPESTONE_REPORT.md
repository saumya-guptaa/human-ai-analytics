# Capstone Project — Complete Documentation

## Web Application for Human-AI Interactions
### LLM-Powered Self-Service Learning Analytics Dashboard

**Author:** Saumya Gupta, Project Manager
**Faculty Advisor:** Professor Dr. Xiao Hu
**Course:** Capstone — Spring 2026 Semester
**Submitted:** May 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Motivation & Problem Statement](#2-motivation--problem-statement)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Data Layer — OULAD Dataset](#5-data-layer--oulad-dataset)
6. [Feature Walkthrough (Demo)](#6-feature-walkthrough-demo)
7. [Annotated Source Code](#7-annotated-source-code)
   - 7.1 [Backend — `backend/index.js`](#71-backend--backendindexjs)
   - 7.2 [Frontend — `frontend/app/auth.js`](#72-frontend--frontendappauthjs)
   - 7.3 [Frontend — `frontend/app/page.js`](#73-frontend--frontendapppagejs)
   - 7.4 [Frontend — `frontend/app/ChartCard.js`](#74-frontend--frontendappchartcardjs)
   - 7.5 [Frontend — `frontend/app/globals.css`](#75-frontend--frontendappglobalscss)
   - 7.6 [Data Loader — `scripts/load_oulad.py`](#76-data-loader--scriptsload_ouladpy)
   - 7.7 [Infrastructure — `docker-compose.yml`](#77-infrastructure--docker-composeyml)
   - 7.8 [Benchmark — `tests/tasks.json`](#78-benchmark--teststasksjson)
8. [API Reference](#8-api-reference)
9. [LLM Prompt Engineering](#9-llm-prompt-engineering)
10. [SQL Safety & Security](#10-sql-safety--security)
11. [Benchmark Evaluation](#11-benchmark-evaluation)
12. [Project Timeline & Milestones](#12-project-timeline--milestones)
13. [Challenges & Solutions](#13-challenges--solutions)
14. [Ethics & Responsible AI Usage](#14-ethics--responsible-ai-usage)
15. [Future Work](#15-future-work)
16. [References](#16-references)

---

## 1. Project Overview

This capstone project delivers a full-stack web application that enables instructors and
students to explore educational data through **natural language conversation with an LLM**.
Instead of writing SQL or building dashboards manually, a user types a plain-English question
(e.g., "Show withdrawal rate by age band"), and the system:

1. Translates the question into a MySQL `SELECT` query via a locally-hosted LLM.
2. Executes the query safely against the OULAD educational dataset.
3. Generates an interactive Vega-Lite chart and returns both the chart and raw data.
4. Supports conversational follow-ups ("change it to a line chart", "filter to module AAA").

The system is grounded in the LAK'25 paper by Wang, Lin, and Hu on self-service
teacher-facing learning analytics dashboards, adapting their research findings into a
deployable, production-quality web application.

### Repository Structure

```
human-ai-analytics/
├── .env.example                 # Template for environment variables
├── .gitignore                   # Excludes node_modules, .env, data/
├── docker-compose.yml           # MySQL 8.0 via Docker (optional)
├── README.md                    # Quick-start guide
├── FINAL_REPORT.md              # Academic final report
├── CAPSTONE_DOCUMENTATION.md   # This file — comprehensive documentation
├── data/
│   └── oulad/                   # OULAD CSV files (downloaded separately, ~443 MB)
│       ├── courses.csv
│       ├── assessments.csv
│       ├── vle.csv
│       ├── studentInfo.csv
│       ├── studentRegistration.csv
│       ├── studentAssessment.csv
│       └── studentVle.csv
├── scripts/
│   └── load_oulad.py            # Loads CSVs into MySQL with chunked writes
├── backend/
│   ├── package.json             # Node.js dependencies
│   └── index.js                 # Entire Express API server (379 lines)
├── frontend/
│   ├── package.json             # React/Next.js dependencies
│   ├── next.config.js           # Next.js configuration
│   └── app/
│       ├── layout.js            # Root HTML document shell
│       ├── page.js              # Main chat dashboard + history sidebar
│       ├── auth.js              # Login / register page
│       ├── ChartCard.js         # Vega-Lite chart renderer + spec normalizer
│       └── globals.css          # All application styles
└── tests/
    └── tasks.json               # 10 benchmark NL queries (LAK'25 adapted)
```

---

## 2. Motivation & Problem Statement

Traditional learning analytics dashboards require instructors to have:
- SQL or programming knowledge to query databases
- Familiarity with data visualization tools to build charts
- Understanding of the underlying database schema

This creates a gap: instructors who most need insights into student engagement and
performance are the least likely to have these technical skills.

**This project's solution:** Integrate a Large Language Model (LLM) as an intermediary
layer. The LLM takes the instructor's natural language question, interprets the database
schema (automatically injected into the prompt), and generates both the SQL query and the
visualization specification in a single call. The result is an interactive chart rendered
directly in a conversational chatbot interface.

The system is built on the **Open University Learning Analytics Dataset (OULAD)** — a
real-world educational dataset containing 32,593 student records, 173,912 assessment
submissions, and over 10.6 million clickstream interactions — making the analytics
immediately meaningful for educational research.

---

## 3. System Architecture

The application follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Port 3000)                       │
│            React + Next.js 14 SPA                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   auth.js    │  │   page.js    │  │   ChartCard.js    │  │
│  │  Login /     │  │  Chat panel  │  │   Vega-Lite       │  │
│  │  Register    │  │  + History   │  │   Renderer +      │  │
│  │  Role select │  │  sidebar     │  │   Spec normalizer │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                             │
│  State: JWT token + user info in localStorage               │
│  History: question log in localStorage (up to 50 entries)  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP JSON  +  Authorization: Bearer <JWT>
┌────────────────────────▼────────────────────────────────────┐
│                   Express Server (Port 4000)                 │
│                     backend/index.js                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Auth Routes                                          │   │
│  │  POST /api/auth/register  →  bcrypt hash + JWT issue  │   │
│  │  POST /api/auth/login     →  bcrypt compare + JWT     │   │
│  │  GET  /api/auth/me        →  JWT decode               │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Query Endpoint  POST /api/query                      │   │
│  │  1. Validate JWT middleware                           │   │
│  │  2. Append question to session conversation history   │   │
│  │  3. Build system prompt (schema + rules + examples)   │   │
│  │  4. Call Ollama LLM → get SQL + Vega-Lite spec        │   │
│  │  5. Validate SQL (SELECT-only, forbidden keywords)    │   │
│  │  6. Execute SQL against MySQL                         │   │
│  │  7. Return { sql, vega, data } to frontend            │   │
│  │  Retry logic: up to 3 attempts with error feedback    │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  Conversation history: in-memory Map, 6-turn window        │
└─────────────────────┬──────────────────┬────────────────────┘
                      │                  │
       ┌──────────────▼──┐    ┌──────────▼──────────┐
       │  MySQL (3306)   │    │   Ollama (11434)    │
       │                 │    │                     │
       │  OULAD tables:  │    │  llama3.1:8b        │
       │  courses        │    │                     │
       │  assessments    │    │  Input:             │
       │  vle            │    │  - System prompt    │
       │  studentInfo    │    │  - Schema + rules   │
       │  studentReg     │    │  - Conversation     │
       │  studentAssmt   │    │    history          │
       │  studentVle     │    │  - User question    │
       │  users (app)    │    │                     │
       │                 │    │  Output (JSON):     │
       │                 │    │  { sql, vega }      │
       └─────────────────┘    └─────────────────────┘
```

### Data Flow (one question → one chart)

```
User types question
       │
       ▼
page.js: submitQuestion()
  POST /api/query  { question, sessionId }
  + Authorization: Bearer <JWT>
       │
       ▼
backend: authMiddleware validates JWT
       │
       ▼
backend: addTurn(sessionId, "user", question)
       │
       ▼
backend: buildSystemPrompt()
  → injects live schema from information_schema
  → includes JOIN rules, enumerated values, few-shot examples
       │
       ▼
backend: callLLM(messages)
  POST http://localhost:11434/api/chat
  { model, messages, format:"json", temperature:0, num_predict:1024 }
       │
       ▼
Ollama llama3.1:8b → raw JSON string
       │
       ▼
backend: extractJSON(raw)
  strips markdown fences, finds first { ... last }
  repairs truncated JSON (closes open braces/brackets)
       │
       ▼
backend: validateSQL(sql)
  must start with SELECT
  must not contain forbidden DML/DDL keywords
       │
       ▼
backend: pool.query(safeSql)
  executes against MySQL oulad database
  returns rows[]
       │
       ▼
backend: return { sql, vega, data: rows }
       │
       ▼
page.js: setMessages([...prev, { role:"assistant", sql, vega, data }])
       │
       ▼
ChartCard.js: normalizeSpec(vega)
  fixes invalid marks, rewires pie encodings, adds color fields
       │
       ▼
ChartCard.js: coerceData(rows, encoding)
  converts BIGINT strings → numbers for quantitative fields
       │
       ▼
Vega-Lite compile + render → SVG chart in browser
```

---

## 4. Technology Stack

| Component | Technology | Version | Role |
|-----------|-----------|---------|------|
| Frontend framework | React + Next.js | 14.2.35 | SPA with server-side routing |
| Visualization | Vega + Vega-Lite | 5.x | Declarative chart rendering from JSON spec |
| Backend framework | Node.js + Express | 4.21.2 | REST API server |
| Database | MySQL | 8.0 | Stores OULAD data + user accounts |
| LLM runtime | Ollama (llama3.1:8b) | Local | NL → SQL + Vega-Lite spec generation |
| Authentication | bcryptjs + jsonwebtoken | — | Password hashing + JWT sessions |
| Data loading | Python + pandas + SQLAlchemy | 3.x | CSV → MySQL bulk load |
| Containerization | Docker Compose | — | Optional MySQL service |
| Version control | GitHub | — | Source code repository |

**Why Ollama (local) instead of OpenAI API?**
The project intentionally uses a locally-hosted LLM (`llama3.1:8b` via Ollama) to
demonstrate that self-service analytics does not require paid cloud APIs, improving
deployability in academic environments and eliminating per-query cost concerns. The
backend's `package.json` includes `openai`, `@anthropic-ai/sdk`, and `@google/generative-ai`
as installed dependencies, meaning the architecture is provider-agnostic and can be switched
to any cloud LLM by changing the `callLLM` function.

---

## 5. Data Layer — OULAD Dataset

### About OULAD

The Open University Learning Analytics Dataset (OULAD) is a publicly available, anonymized
dataset released by The Open University (UK) under the CC-BY 4.0 license. It covers 22
course presentations (modules × semesters) and contains:

- **32,593** student enrollment records
- **173,912** assessment submissions
- **10,655,281** virtual learning environment (VLE) clickstream interactions

All student identifiers are anonymized integer IDs. No personally identifiable information
is present. The dataset is described in:

> Kuzilek J., Hlosta M., Zdrahal Z. *Open University Learning Analytics dataset.*
> Sci. Data 4:170171 doi: 10.1038/sdata.2017.171 (2017). Licensed CC-BY 4.0.

### Database Tables

#### `courses` — 22 rows
Catalog of module/presentation combinations.

| Column | Type | Description |
|--------|------|-------------|
| `code_module` | varchar | Module identifier (e.g., `'AAA'`, `'BBB'`) |
| `code_presentation` | varchar | Presentation period (e.g., `'2013J'`, `'2014B'`) |
| `module_presentation_length` | int | Duration in days |

**Example row:** `AAA | 2013J | 268`

---

#### `assessments` — 206 rows
Assessment metadata for each course.

| Column | Type | Description |
|--------|------|-------------|
| `code_module` | varchar | Module the assessment belongs to |
| `code_presentation` | varchar | Presentation period |
| `id_assessment` | int (PK) | Unique assessment identifier |
| `assessment_type` | varchar | `'TMA'` (tutor-marked), `'CMA'` (computer-marked), or `'Exam'` |
| `date` | int | Day number when the assessment is due |
| `weight` | float | Percentage weight toward final grade |

---

#### `vle` — 6,364 rows
Metadata about Virtual Learning Environment materials (pages, resources, forums).

| Column | Type | Description |
|--------|------|-------------|
| `id_site` | int (PK) | Unique VLE material identifier |
| `code_module` | varchar | Module the material belongs to |
| `code_presentation` | varchar | Presentation period |
| `activity_type` | varchar | Type of material (e.g., `'forumng'`, `'resource'`, `'oucontent'`, `'quiz'`) |
| `week_from` | int | First week the material is available |
| `week_to` | int | Last week the material is available |

---

#### `studentInfo` — 32,593 rows
Core student demographics and final outcomes. **This is the primary student table.**

| Column | Type | Description |
|--------|------|-------------|
| `code_module` | varchar | Module enrolled in |
| `code_presentation` | varchar | Presentation period |
| `id_student` | int | Anonymized student ID |
| `gender` | varchar | `'M'` or `'F'` |
| `region` | varchar | UK region or country |
| `highest_education` | varchar | Highest prior qualification (e.g., `'HE Qualification'`, `'A Level or Equivalent'`) |
| `imd_band` | varchar | Index of Multiple Deprivation band (socioeconomic proxy) |
| `age_band` | varchar | `'0-35'`, `'35-55'`, `'55<='` |
| `num_of_prev_attempts` | int | Prior attempts at this module |
| `studied_credits` | int | Credits enrolled in this presentation |
| `disability` | varchar | `'Y'` or `'N'` |
| `final_result` | varchar | `'Pass'`, `'Fail'`, `'Withdrawn'`, `'Distinction'` |

> **Important:** `final_result`, `gender`, `highest_education`, `age_band`, `imd_band`,
> `disability`, and `region` are **only** in `studentInfo`. The LLM system prompt
> explicitly states this to prevent incorrect JOINs or wrong table references.

---

#### `studentRegistration` — 32,593 rows
Enrollment and withdrawal timestamps.

| Column | Type | Description |
|--------|------|-------------|
| `code_module` | varchar | Module |
| `code_presentation` | varchar | Presentation |
| `id_student` | int | Student ID |
| `date_registration` | int | Day number of registration (negative = before module start) |
| `date_unregistration` | int | Day number of withdrawal (NULL if student completed) |

---

#### `studentAssessment` — 173,912 rows
Assessment submission records.

| Column | Type | Description |
|--------|------|-------------|
| `id_assessment` | int (FK → assessments) | Assessment submitted |
| `id_student` | int | Student who submitted |
| `date_submitted` | int | Day number of submission |
| `is_banked` | int | `1` if score was carried over from a previous attempt |
| `score` | float | Score out of 100 |

---

#### `studentVle` — 10,655,281 rows
Clickstream data — every interaction a student had with a VLE material on a given day.

| Column | Type | Description |
|--------|------|-------------|
| `code_module` | varchar | Module |
| `code_presentation` | varchar | Presentation |
| `id_student` | int | Student |
| `id_site` | int (FK → vle) | VLE material clicked |
| `date` | int | Day number of interaction (relative to module start) |
| `sum_click` | int | Number of clicks on that material on that day |

> **Note on `date`:** All date values in OULAD are relative day numbers from the module
> start date, not calendar dates. Day 0 = module start. Negative values = before start.
> Weeks are computed as `FLOOR(date / 7)`.

---

#### `users` — Application table (auto-created on first startup)
Stores web application user accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT AUTO_INCREMENT PK | User ID |
| `name` | VARCHAR(100) NOT NULL | Display name |
| `email` | VARCHAR(255) UNIQUE | Login email (lowercased) |
| `password_hash` | VARCHAR(255) | bcrypt hash, 10 salt rounds |
| `role` | ENUM('student','instructor') | Role-based access control |
| `created_at` | TIMESTAMP | Account creation time |

### Data Loading

The `scripts/load_oulad.py` script handles all 7 CSV files. Files with more than 500,000
rows (specifically `studentVle.csv` with 10.6M rows) are loaded in **100,000-row chunks**
to prevent memory exhaustion:

```
courseTable       (22 rows)       → direct load
assessments       (206 rows)      → direct load
vle               (6,364 rows)    → direct load
studentInfo       (32,593 rows)   → direct load
studentRegistration (32,593 rows) → direct load
studentAssessment (173,912 rows)  → direct load
studentVle        (10,655,281 rows) → 107 chunks of 100,000 rows each
```

---

## 6. Feature Walkthrough (Demo)

The demo video demonstrates the complete user journey through the application. Here is a
detailed annotation of each screen and interaction shown.

### Screen 1 — Authentication Page (`auth.js`)

The app opens to a centered login card on a gradient background (indigo → light → deep
indigo). The card contains:

- **App title:** "Learning Analytics Dashboard"
- **Subtitle:** "Sign in to explore student data with AI"
- **Tab switcher:** "Sign In" / "Register" — toggle between modes with a smooth active
  indicator (indigo fill)
- **Sign In form fields:** Email, Password
- **Register form fields:** Name, Email, Password, Role selector

**Role selector** (shown on Register tab):
Two toggle buttons — "Student" and "Instructor" — styled as pill buttons. Active role
highlights in indigo. This sets the `role` field in the JWT payload and database record.

**Flow on successful login/register:**
1. Frontend POSTs to `/api/auth/login` or `/api/auth/register`
2. Backend returns `{ token, user: { id, name, email, role } }`
3. Token and user object are saved to `localStorage`
4. The `Home` component re-renders and shows the `Dashboard` component

**Error handling:** If email is already registered (409 Conflict), or credentials are wrong
(401), an inline red error banner appears below the form fields with the server's error
message.

---

### Screen 2 — Chat Dashboard (empty state, `page.js`)

After login, the user sees the main dashboard. The layout is:

```
┌─────────────────────────────────────────────────────────┐
│ ☰  │  Learning Analytics Dashboard              │  [S]  │
│     │  Ask questions about student data         │       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              🔍                                         │
│         What would you like to explore?                 │
│   Try asking about students, assessments, or patterns.  │
│                                                         │
│  [Show distribution of...] [Who are the 10 most...]     │
│  [Show grade distribution] [Compare total clicks...]    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [  Ask about student data...                    ] [▶]  │
└─────────────────────────────────────────────────────────┘
```

**Header (3-column grid):**
- Left: hamburger `☰` button → opens history sidebar
- Center: app title + subtitle
- Right: avatar circle (`[S]` for "Saumya") — clicking opens a dropdown with name, role,
  and "Sign out" button

**Empty state suggestions:**
Four clickable chips drawn from either recent history (non-modification questions, first 4)
or the 8 built-in default suggestions. The `MODIFICATION_PATTERNS` regex filters out
phrases like "change color" or "make it a line chart" from appearing as suggestions.
Clicking a chip immediately submits that question.

**Input bar:**
- Full-width text input (pill shape, 24px border-radius, indigo focus ring)
- Send button (circle, indigo) — disabled when input is empty or LLM is processing

---

### Screen 3 — Question Submitted & AI Thinking

When the user submits a question:
1. The question appears as a right-aligned indigo bubble
2. A "typing indicator" (3 bouncing dots) appears in a left-aligned white bubble
3. The input is cleared and focused
4. The send button is disabled while waiting

The typing animation is CSS `@keyframes bounce`: each dot bounces up by 6px with
staggered delays (0s, 0.15s, 0.3s) in a 1.2s infinite loop.

---

### Screen 4 — Assistant Response with Chart

When the backend returns `{ sql, vega, data }`, the typing indicator is replaced with a
bot bubble containing:

```
┌─────────────────────────────────────────────────────┐
│  [Interactive Vega-Lite Chart — rendered as SVG]    │
│                                                     │
│  42 rows returned                                   │
│                                                     │
│  ▶ View SQL                                         │
│  ▶ View data table                                  │
└─────────────────────────────────────────────────────┘
```

**Chart rendering:**
- Standard charts (bar, line, area, point): 520×300px, auto-fit to container
- Arc/pie charts: 350×350px (square aspect ratio for the Vega-Lite arc mark)
- Charts are interactive: hover tooltips, zoom (Vega's default interaction)

**"View SQL" collapsible:**
Clicking the arrow expands a monospace code block showing the exact SQL the LLM generated
and that was executed. This provides full **transparency** — users can verify the query
is correct before trusting the results.

```sql
SELECT highest_education, COUNT(*) AS cnt
FROM studentInfo
GROUP BY highest_education
LIMIT 1000
```

**"View data table" collapsible:**
Expands a scrollable table (max 260px height) showing the raw data. Column headers are
sticky. Up to 100 rows are shown. Null values are rendered as `—`.

---

### Screen 5 — History Sidebar

Clicking `☰` slides in the sidebar (280px wide, fixed position, z-index 100) over the
chat with a semi-transparent overlay.

```
┌──────────────────────┐
│  History         ×   │
├──────────────────────┤
│  + New Chat          │
├──────────────────────┤
│  Show distribution   │  ×
│  of students by...   │
│──────────────────────│
│  Who are the 10      │  ×
│  most active...      │
│──────────────────────│
│  Show grade dist...  │  ×
├──────────────────────┤
│  Clear all history   │
└──────────────────────┘
```

- **"+ New Chat"** clears the message thread (conversation history in frontend state)
  but does not clear localStorage history
- **Clicking a history item** loads it into the input box and focuses it
- **×** on each item removes that entry; "Clear all history" removes all entries
- History persists in `localStorage` across page refreshes; up to 50 entries stored

---

### Screen 6 — Conversational Follow-ups

After an initial chart, the user can ask follow-up questions. The backend maintains a
per-session conversation history (in-memory `Map`, keyed by `sessionId`, up to 6 turns).

**Example conversation flow:**

```
User: Show distribution of students by highest_education
Bot:  [bar chart]

User: Change the color to orange
Bot:  [same bar chart, orange bars — LLM reused the SQL, updated vega.mark]

User: Make it a pie chart
Bot:  [pie/arc chart — LLM reused the SQL, changed mark to "arc"]

User: Change the title to "Education Background"
Bot:  [same arc chart, new title]
```

The LLM prompt includes explicit instructions for chart modification requests:
```
If the user asks to change color, chart type, or title, reuse the SAME sql
and modify the vega spec only.
```

---

## 7. Annotated Source Code

### 7.1 Backend — `backend/index.js`

The entire backend lives in a single 379-line Express file. This section walks through
every logical block with detailed annotations.

---

#### Dependencies & App Bootstrap

```javascript
require("dotenv").config({ path: "../.env" });
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());           // Allow cross-origin requests from Next.js on :3000
app.use(express.json());   // Parse JSON request bodies
```

**`dotenv`** loads `.env` from one directory up (the project root), keeping secrets
out of the backend source directory.

**`mysql2/promise`** is the modern MySQL driver that returns Promises rather than
using callbacks, enabling clean `async/await` patterns throughout.

**`cors()`** with no configuration allows all origins. In production, this should
be restricted to `http://localhost:3000` or the deployed frontend URL.

---

#### MySQL Connection Pool

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,   // Max 5 simultaneous MySQL connections
});
```

A connection **pool** (rather than a single connection) is used so that concurrent
requests don't block each other waiting for a database connection. With `connectionLimit: 5`,
up to 5 queries can execute simultaneously; additional requests wait in queue.

---

#### Users Table Auto-Creation

```javascript
async function initUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('student','instructor') NOT NULL DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
```

The `IF NOT EXISTS` guard makes this idempotent — running it on every startup is safe.
The `users` table is the only application-managed table; all OULAD tables are loaded
separately by the Python script.

The `UNIQUE` constraint on `email` is what triggers the `ER_DUP_ENTRY` MySQL error
code, which the register endpoint catches and returns as a user-friendly "Email already
registered" message.

---

#### JWT Token Generation & Middleware

```javascript
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "24h" }   // Token expires after 24 hours
  );
}
```

The JWT payload includes `id`, `email`, `role`, and `name` so the frontend can display
user info without an extra API call. The secret should be a long random string in production.

```javascript
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    req.user = decoded;  // Attach decoded user to request for downstream handlers
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
```

The middleware extracts the Bearer token from the `Authorization` header, verifies it
with `jwt.verify` (which also checks expiration), and attaches the decoded payload to
`req.user`. If verification fails for any reason (invalid signature, expired, malformed),
a 401 is returned.

---

#### Authentication Routes

```javascript
// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  // Only allow 'instructor' explicitly; anything else defaults to 'student'
  const userRole = (role === "instructor") ? "instructor" : "student";
  try {
    const hash = await bcrypt.hash(password, 10);  // 10 salt rounds (~100ms, safe vs brute force)
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), hash, userRole]
      // email.toLowerCase() ensures case-insensitive login
    );
    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: userRole };
    res.status(201).json({ token: generateToken(user), user: { ... } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: err.message });
  }
});
```

**Security note:** Parameterized queries (`?` placeholders) are used throughout,
preventing SQL injection. Passwords are never stored in plain text; only the bcrypt
hash is persisted.

```javascript
// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  ...
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ?",
    [email.trim().toLowerCase()]
  );
  if (rows.length === 0) {
    // Same error message as wrong password — prevents user enumeration
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: generateToken(user), user: { id, name, email, role } });
});
```

Both "user not found" and "wrong password" return the same `401` response to prevent
username enumeration attacks.

---

#### Schema Loader

```javascript
let schemaDescription = "";   // String injected into every LLM prompt
let allowedIdentifiers = new Set();  // Table + column names (for future validation)

async function loadSchema() {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [process.env.DB_NAME]
  );

  const grouped = {};
  for (const r of tables) {
    if (!grouped[r.TABLE_NAME]) grouped[r.TABLE_NAME] = [];
    grouped[r.TABLE_NAME].push(`${r.COLUMN_NAME} (${r.DATA_TYPE})`);
    allowedIdentifiers.add(r.TABLE_NAME.toLowerCase());
    allowedIdentifiers.add(r.COLUMN_NAME.toLowerCase());
  }

  // Format: "tableName: col1 (type), col2 (type), ..."
  schemaDescription = Object.entries(grouped)
    .map(([t, cols]) => `${t}: ${cols.join(", ")}`)
    .join("\n");
}
```

The schema is loaded from MySQL's `information_schema` at startup rather than being
hardcoded. This means if the database schema changes (e.g., a column is added), the
LLM will automatically receive the updated schema on the next server start.

The schema string looks like:
```
assessments: code_module (varchar), code_presentation (varchar), id_assessment (int), assessment_type (varchar), date (int), weight (float)
courses: code_module (varchar), code_presentation (varchar), module_presentation_length (int)
studentInfo: code_module (varchar), code_presentation (varchar), id_student (int), gender (varchar), region (varchar), highest_education (varchar), ...
studentVle: code_module (varchar), code_presentation (varchar), id_student (int), id_site (int), date (int), sum_click (int)
...
```

---

#### SQL Safety Validation

```javascript
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|CALL|SET)\b/i;

function validateSQL(sql) {
  const trimmed = sql.trim().replace(/;+$/, "");  // Strip trailing semicolons
  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    throw new Error("Only SELECT queries are allowed.");
  }
  if (FORBIDDEN.test(trimmed)) {
    throw new Error("Query contains forbidden keywords.");
  }
  return trimmed;
}
```

Two-layer safety:
1. **Whitelist:** Query must begin with `SELECT`
2. **Blacklist:** Query must not contain any data-modifying or schema-modifying keyword

The `\b` word boundary anchors in the regex prevent false positives — the word "select"
inside a column name like `user_select_count` would not be blocked.

---

#### LLM System Prompt

```javascript
function buildSystemPrompt() {
  return `You generate MySQL queries and Vega-Lite charts for a learning analytics database.

SCHEMA:
${schemaDescription}
// Live schema injected here on every call

JOINS: studentAssessment→assessments ON id_assessment | studentVle→vle ON id_site,code_module,code_presentation | any student table→courses ON code_module,code_presentation
// Explicit JOIN paths prevent the LLM from guessing incorrect join conditions

RULES:
- final_result, gender, highest_education are ONLY in studentInfo
// Column location hint: prevents incorrect queries against other tables
- date columns are relative day numbers (not calendar dates)
// Prevents the LLM from interpreting day numbers as calendar dates
- final_result values: 'Pass','Fail','Withdrawn','Distinction'
// Enumerated values prevent typos in WHERE clauses
- Always add a LIMIT clause. Use the number the user specifies (e.g. "top 10" → LIMIT 10), otherwise default to LIMIT 1000
// Prevents unbounded full-table scans on the 10.6M row studentVle table
- Return ONLY valid JSON, nothing else
// Forces clean JSON output (reinforced by Ollama's format:"json" parameter)

OUTPUT FORMAT:
{"sql":"SELECT ...","vega":{...Vega-Lite spec...}}

EXAMPLE: (bar chart)
EXAMPLE: (line chart)

CHART MODIFICATIONS:
If the user asks to change color, chart type, or title, reuse the SAME sql.
// Critical for follow-up efficiency — avoids re-executing queries for style-only changes

EXAMPLE: (color change)`;
}
```

The prompt is rebuilt on every `/api/query` call (so schema changes are always current).
The `schemaDescription` string is injected at the `${schemaDescription}` interpolation point.

---

#### Conversation History

```javascript
const MAX_TURNS = 6;                      // 6 exchange turns = 12 messages
const sessions = new Map();               // sessionId → messages[]

function getHistory(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId);
}

function addTurn(sessionId, role, content) {
  const hist = getHistory(sessionId);
  hist.push({ role, content });
  if (hist.length > MAX_TURNS * 2) hist.splice(0, 2);
  // When we exceed 12 messages, remove the oldest pair (user+assistant)
  // This maintains a sliding 6-turn window and prevents unbounded memory growth
}
```

History is stored in-memory (server restarts clear it), which is acceptable for a
prototype. In production this would be persisted to the database. The 6-turn window
is a balance between context quality and LLM prompt length — Ollama's 8B model has
a limited context window and more history means more tokens consumed before the
actual user question.

---

#### Ollama LLM Call

```javascript
async function callLLM(messages) {
  const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
      messages,           // System prompt + conversation history + user question
      stream: false,      // Wait for complete response (not streaming tokens)
      format: "json",     // Critical: forces Ollama to output only valid JSON
      options: {
        temperature: 0,   // Deterministic output (no randomness) — better for SQL
        num_predict: 1024 // Max tokens in response; prevents truncated JSON
      },
    }),
  });
  ...
  const body = await ollamaRes.json();
  return body.message.content.trim();
}
```

**`format: "json"`** is the single most important parameter. Without it, `llama3.1:8b`
tends to add explanatory text like "Here is the SQL query: ..." before the JSON, which
breaks `JSON.parse`. With it, the model is constrained to output only valid JSON.

**`temperature: 0`** makes the model deterministic — the same question will produce the
same SQL every time. This is desirable for data queries where consistency matters more
than creativity.

**`num_predict: 1024`** was tuned through experimentation. The default Ollama value
caused truncated responses for complex Vega-Lite specs with long field names.

---

#### JSON Extraction & Repair

```javascript
function extractJSON(raw) {
  // Step 1: Strip markdown code fences the model sometimes adds
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Step 2: Find the outermost JSON object boundaries
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);  // Happy path: valid JSON
  } catch {
    // Step 3: Repair truncated JSON
    // Count open/close braces and brackets, tracking string context
    let open = 0, openBrackets = 0, inString = false, escape = false;
    for (const ch of cleaned) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") open++;
      if (ch === "}") open--;
      if (ch === "[") openBrackets++;
      if (ch === "]") openBrackets--;
    }
    // Close any dangling open strings, brackets, and braces in the correct order
    let repaired = cleaned;
    if (inString) repaired += '"';
    repaired += "]".repeat(Math.max(0, openBrackets));
    repaired += "}".repeat(Math.max(0, open));
    return JSON.parse(repaired);
  }
}
```

This function handles the most common failure modes of LLM JSON generation:
- Markdown wrapping (`\`\`\`json...`)
- Preamble text before the JSON (`{"sql":...` buried in prose)
- Truncated responses where `num_predict` was insufficient for the response length

---

#### Main Query Endpoint with Retry Logic

```javascript
const MAX_RETRIES = 2;   // Up to 3 total attempts (1 initial + 2 retries)

app.post("/api/query", authMiddleware, async (req, res) => {
  const { question, sessionId = "default" } = req.body;

  addTurn(sessionId, "user", question);  // Add question to history before calling LLM
  const history = getHistory(sessionId);

  const baseMessages = [
    { role: "system", content: buildSystemPrompt() },
    ...history,  // Include conversation context
  ];

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let messages = [...baseMessages];

    if (attempt > 0 && lastError) {
      // On retry, append an error correction message
      // The LLM sees its own error and can self-correct
      messages.push({
        role: "user",
        content: `The previous response caused an error: "${lastError}". Please fix the SQL and return valid JSON only. Remember: final_result, gender, highest_education are ONLY in the studentInfo table.`,
      });
    }

    // 1. Call LLM
    let raw = await callLLM(messages);

    // 2. Parse JSON
    let parsed = extractJSON(raw);

    // 3. Validate SQL
    let safeSql = validateSQL(parsed.sql);

    // 4. Execute SQL
    let [rows] = await pool.query(safeSql);

    // 5. Store assistant turn in history and return result
    addTurn(sessionId, "assistant", JSON.stringify(parsed));
    return res.json({ sql: safeSql, vega: parsed.vega, data: rows });
  }

  return res.status(500).json({
    error: `Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`,
  });
});
```

The retry loop with error feedback implements a self-correcting pattern: if the LLM
generates invalid SQL (e.g., references a column in the wrong table), the SQL error
message is fed back to the LLM as a user message, giving it the context to correct itself.
In practice, about 85% of queries succeed on the first attempt; retries handle edge cases.

---

### 7.2 Frontend — `frontend/app/auth.js`

The authentication page is a client component (`"use client"`) with local state.

```javascript
export default function AuthPage({ onLogin }) {
  // mode controls which form is shown: "login" or "register"
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");  // Default role
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);      // Clear previous errors
    setLoading(true);    // Disable form during request

    // Dynamic URL construction allows this to work on any host (localhost, LAN, cloud)
    const backendUrl = `http://${window.location.hostname}:4000/api/auth/${mode}`;

    // Register sends name+role; login only needs email+password
    const body = mode === "register"
      ? { name, email, password, role }
      : { email, password };

    const res = await fetch(backendUrl, { method: "POST", ... });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    // On success: persist auth state and notify parent
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    onLogin(data.user, data.token);  // Triggers re-render in Home component
  };
```

**Role selector UI:**

```jsx
<div className="role-select">
  <button
    type="button"  // Important: prevents form submission
    className={`role-btn ${role === "student" ? "active" : ""}`}
    onClick={() => setRole("student")}
  >
    Student
  </button>
  <button
    type="button"
    className={`role-btn ${role === "instructor" ? "active" : ""}`}
    onClick={() => setRole("instructor")}
  >
    Instructor
  </button>
</div>
```

The `type="button"` attribute is critical — without it, clicking a role button would
submit the form (the default for `<button>` inside `<form>` is `type="submit"`).

---

### 7.3 Frontend — `frontend/app/page.js`

The main page component. The `Home` function handles auth-state routing; `Dashboard`
contains all chat logic.

#### Auth State Restoration on Load

```javascript
export default function Home() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Runs only on mount (client-side), reads persisted session
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {}   // Ignore corrupted localStorage data
    }
    setAuthReady(true);
  }, []);

  if (!authReady) return null;          // Prevent flash of login page during hydration
  if (!user) return <AuthPage onLogin={handleLogin} />;
  return <Dashboard user={user} token={token} onLogout={handleLogout} />;
}
```

The `authReady` flag prevents a flash where the login page briefly appears even for
authenticated users (because `localStorage` is only readable on the client, not during
Next.js server rendering).

#### Smart Suggestions

```javascript
const MODIFICATION_PATTERNS = /\b(change|rename|modify|update|make it|switch|convert|color|axis|title|label)\b/i;

const suggestions = (() => {
  const dataQuestions = history
    .map((h) => h.text)
    .filter((t) => !MODIFICATION_PATTERNS.test(t));   // Exclude style modifications
  const combined = [...dataQuestions.slice(0, 4), ...DEFAULT_SUGGESTIONS];
  // User's recent data questions first, then defaults as fallback
  return combined.filter((s, i, arr) => arr.indexOf(s) === i).slice(0, 4);
  // Deduplicate and limit to 4 chips
})();
```

This IIFE (Immediately Invoked Function Expression) computes the suggestion chips on
every render. Recent user questions are prioritized because they reflect the user's
current analysis focus. Modification requests are excluded because "Change the color
to orange" is not a useful suggestion chip without context.

#### Question Submission

```javascript
const submitQuestion = useCallback(
  async (q) => {
    if (!q || loading) return;   // Prevent double-submission

    // Optimistic UI: show user message immediately, before awaiting the response
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    addToHistory(q);      // Persist to localStorage immediately
    setLoading(true);

    const backendUrl = `http://${window.location.hostname}:4000/api/query`;
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,  // JWT required by authMiddleware
      },
      body: JSON.stringify({ question: q, sessionId: "default" }),
    });

    const body = JSON.parse(await res.text());

    if (!res.ok) {
      // Show error bubble (red styling)
      setMessages((prev) => [...prev, { role: "error", text: body.error }]);
      return;
    }

    // Success: add assistant message with sql + vega + data
    setMessages((prev) => [...prev,
      { role: "assistant", sql: body.sql, vega: body.vega, data: body.data }
    ]);
  },
  [loading]
);
```

`useCallback` with `[loading]` as the dependency memoizes `submitQuestion` to prevent
unnecessary re-creation on every render. The `loading` dependency is required because
the function reads `loading` to prevent double-submission.

#### History Persistence

```javascript
const addToHistory = (question) => {
  setHistory((prev) => {
    const filtered = prev.filter((h) => h.text !== question);  // Remove duplicate
    const updated = [{ text: question, time: Date.now() }, ...filtered].slice(0, 50);
    // Prepend to front (most recent first), cap at 50 entries
    saveHistory(updated);   // Immediately write to localStorage
    return updated;
  });
};
```

The functional update pattern (`setHistory(prev => ...)`) ensures the state update
sees the latest value even in concurrent renders. Writing to `localStorage` inside
the state update function is intentional — it keeps the persisted and in-memory
states synchronized.

---

### 7.4 Frontend — `frontend/app/ChartCard.js`

The chart renderer is the most technically complex frontend component. It handles
Vega-Lite spec normalization, numeric type coercion, and fallback rendering.

#### Valid Mark Types

```javascript
const VALID_MARKS = new Set([
  "bar", "line", "area", "point", "circle", "square", "tick",
  "rect", "rule", "text", "arc", "boxplot", "trail", "geoshape",
]);
```

Vega-Lite v5 has a fixed set of mark types. The LLM occasionally generates marks like
`"stackedbar"`, `"piechart"`, or `"histogram"` that are not valid. The normalization
layer maps these to their correct equivalents.

#### Data Type Coercion

```javascript
function coerceData(rows, encoding) {
  // Find all fields marked as "quantitative" in the Vega-Lite encoding
  const quantFields = Object.values(encoding || {})
    .filter((e) => e?.type === "quantitative" && e?.field)
    .map((e) => e.field);

  if (quantFields.length === 0) return rows;   // No coercion needed

  return rows.map((row) => {
    const out = { ...row };
    for (const f of quantFields) {
      if (f in out && typeof out[f] === "string") {
        const n = Number(out[f]);
        if (!isNaN(n)) out[f] = n;   // Convert "42" → 42
      }
    }
    return out;
  });
}
```

MySQL's `mysql2` driver returns `BIGINT` values as JavaScript strings (e.g., `COUNT(*)`
returns `"42"` not `42`). Vega-Lite treats strings as nominal/ordinal data and refuses
to render them as quantitative bar heights. This coercion function fixes that by
converting string-typed numbers to actual numbers for any field declared `quantitative`
in the Vega spec.

#### Spec Normalization

```javascript
function normalizeSpec(spec) {
  let mark = spec.mark;
  const markType = typeof mark === "string" ? mark : mark?.type;

  // Fix 1: Invalid mark type → map to nearest valid mark
  if (markType && !VALID_MARKS.has(markType)) {
    const lower = markType.toLowerCase();
    if (lower.includes("pie") || lower.includes("donut")) mark = { type: "arc" };
    else if (lower.includes("bar")) mark = "bar";
    else if (lower.includes("line")) mark = "line";
    else if (lower.includes("area")) mark = "area";
    else mark = "bar";   // Default fallback
    spec.mark = mark;
  }

  // Fix 2: Mark object without type field (e.g., { color: "orange" })
  if (typeof spec.mark === "object" && spec.mark && !spec.mark.type) {
    spec.mark = "bar";
  }

  const resolvedMark = typeof spec.mark === "string" ? spec.mark : spec.mark?.type;
  const enc = spec.encoding || {};

  // Fix 3: Pie/arc charts use theta+color encoding, not x+y
  if (resolvedMark === "arc") {
    // LLM often generates arc charts with x/y encoding, which is wrong for Vega-Lite
    const catField = enc.x?.field || enc.color?.field;    // Category → color segments
    const numField = enc.y?.field || enc.theta?.field;    // Number → arc angle
    spec.encoding = {
      theta: { field: numField, type: "quantitative" },   // Arc angle
      color: { field: catField, type: "nominal" },        // Segment color
    };
    spec._isArc = true;   // Signal to set square dimensions (350×350)
    return spec;
  }

  // Fix 4: Add color encoding for multi-field queries (stacked/grouped charts)
  const hasColorField = enc.color?.field;
  const dataFields = Object.values(enc).map((e) => e?.field).filter(Boolean);
  if (!hasColorField && dataFields.length >= 3 && enc.x?.field && enc.y?.field) {
    const thirdField = dataFields.find((f) => f !== enc.x.field && f !== enc.y.field);
    if (thirdField) {
      enc.color = { field: thirdField, type: "nominal" };
    }
  }

  return spec;
}
```

#### Rendering with Fallback

```javascript
function ChartCard({ vega: spec, data }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!spec || !data || !containerRef.current) return;
    let cancelled = false;   // Cleanup flag for React strict mode double-effect

    (async () => {
      // Dynamic imports: Vega is large; load only when a chart is needed
      const vegaModule = await import("vega");
      const vegaLiteModule = await import("vega-lite");
      if (cancelled) return;

      async function tryRender(vegaSpec, chartData) {
        const compiled = vegaLiteModule.compile(vegaSpec);  // Vega-Lite → Vega spec
        const view = new vegaModule.View(
          vegaModule.parse(compiled.spec),
          { renderer: "svg", container: containerRef.current, hover: true }
        );
        await view.runAsync();
      }

      try {
        // Primary render: use normalized spec
        const normalized = normalizeSpec(JSON.parse(JSON.stringify(spec)));
        // Deep clone to avoid mutating the original spec in React state
        const isArc = normalized._isArc;
        delete normalized._isArc;

        const coerced = coerceData(data, normalized.encoding);
        const fullSpec = {
          ...normalized,
          data: { values: coerced },
          ...(isArc
            ? { width: 350, height: 350 }           // Square for pie
            : { width: 520, height: 300, autosize: { type: "fit" } }),
        };

        try {
          await tryRender(fullSpec, coerced);
        } catch (firstErr) {
          // Fallback render: strip down to simplest possible bar chart
          console.warn("Primary render failed, trying fallback:", firstErr.message);
          containerRef.current.innerHTML = "";
          const enc = normalized.encoding || {};
          if (enc.x?.field && enc.y?.field) {
            const fallback = {
              $schema: "https://vega.github.io/schema/vega-lite/v5.json",
              mark: "bar",
              data: { values: coerced },
              encoding: {
                x: enc.x,
                y: enc.y,
                ...(enc.color ? { color: enc.color } : {}),
              },
            };
            await tryRender(fallback, coerced);
          }
        }
      } catch (err) {
        // Final failure: show inline error message
        containerRef.current.innerHTML =
          `<p style="color: #ef4444;">Chart render error: ${err.message}</p>`;
      }
    })();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
      // Cleanup: cancel pending render if component unmounts
    };
  }, [spec, data]);   // Re-render when spec or data changes

  if (!spec) return null;
  return <div className="chart-container" ref={containerRef} />;
}

export default memo(ChartCard);
// memo: prevents re-rendering when parent re-renders but spec/data haven't changed
```

---

### 7.5 Frontend — `frontend/app/globals.css`

The entire application uses a single CSS file with CSS custom properties (design tokens)
for consistency.

#### Design Tokens

```css
:root {
  --bg: #f0f2f5;           /* Page background — light gray */
  --surface: #ffffff;      /* Cards, bubbles, sidebar */
  --border: #e2e6ea;       /* Borders and dividers */
  --text: #1a1d23;         /* Primary text — near-black */
  --text-secondary: #6b7280; /* Captions, labels — medium gray */
  --primary: #4f46e5;      /* Indigo — brand color, buttons, links */
  --primary-hover: #4338ca; /* Darker indigo for hover states */
  --primary-light: #eef2ff; /* Very light indigo for chip backgrounds */
  --user-bubble: #4f46e5;  /* User message bubble — same as primary */
  --user-text: #ffffff;    /* White text on user bubbles */
  --bot-bubble: #ffffff;   /* Bot message bubble — white card */
  --error: #ef4444;        /* Red-500 for errors */
  --error-bg: #fef2f2;     /* Very light red for error backgrounds */
  --code-bg: #f1f5f9;      /* Slate-100 for SQL code blocks */
  --radius: 16px;          /* Chat bubble radius */
  --radius-sm: 10px;       /* Form element radius */
  --shadow: 0 1px 3px rgba(0,0,0,0.08);   /* Subtle card shadow */
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.1); /* Stronger shadow for sidebar, dialogs */
}
```

#### Layout Architecture

The app uses two nested flex containers:

```css
.app-layout {
  display: flex;       /* Horizontal: sidebar | chat */
  height: 100vh;
  overflow: hidden;    /* Prevents body scroll; scrolling handled inside .chat-messages */
}

.chat-layout {
  display: flex;
  flex-direction: column;   /* Vertical: header | messages | input */
  height: 100vh;
  flex: 1;
}
```

The sidebar uses `position: fixed` with `transform: translateX(-100%)` (hidden) and
`transform: translateX(0)` (open), animated with `transition: transform 0.25s ease`.
This keeps it out of the document flow, allowing the chat area to use the full width.

#### Typing Indicator Animation

```css
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30%           { transform: translateY(-6px); opacity: 1; }
}

.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.30s; }
```

Three staggered bouncing dots create the familiar "AI is thinking" indicator. The
opacity change (0.4 → 1 → 0.4) adds a pulse effect to reinforce the motion.

---

### 7.6 Data Loader — `scripts/load_oulad.py`

```python
import pandas as pd
from sqlalchemy import create_engine
import os, sys

# Connection string from environment variable, with a sensible local default
DB_URL = os.environ.get("DB_URL", "mysql+pymysql://root@localhost:3306/oulad")
engine = create_engine(DB_URL)
csv_dir = "./data/oulad"

CHUNK_THRESHOLD = 500_000   # Files larger than this are loaded in chunks

files = [
    "courses.csv",             # 22 rows
    "assessments.csv",         # 206 rows
    "vle.csv",                 # 6,364 rows
    "studentInfo.csv",         # 32,593 rows
    "studentRegistration.csv", # 32,593 rows
    "studentAssessment.csv",   # 173,912 rows
    "studentVle.csv",          # 10,655,281 rows ← requires chunking
]

for f in files:
    path = os.path.join(csv_dir, f)
    if not os.path.exists(path):
        print("Missing:", path)
        continue

    table = f.replace(".csv", "")   # filename → table name (exact match)

    # Count rows without loading the whole file into memory
    row_count = sum(1 for _ in open(path)) - 1   # subtract header row

    if row_count > CHUNK_THRESHOLD:
        # Chunked loading: read 100,000 rows at a time
        chunks = pd.read_csv(path, chunksize=100_000)
        for i, chunk in enumerate(chunks):
            chunk.to_sql(
                table, engine,
                if_exists="append" if i > 0 else "replace",
                # First chunk: replace (create fresh table)
                # Subsequent chunks: append
                index=False    # Don't write pandas row index as a column
            )
    else:
        # Small file: load entirely into memory and write in one shot
        df = pd.read_csv(path)
        df.to_sql(table, engine, if_exists="replace", index=False)
```

**Why `if_exists="replace"` for the first chunk?** This drops and recreates the table,
ensuring a clean load if the script is re-run (idempotent behavior). Subsequent chunks
use `"append"` to add rows without dropping the table.

**Performance on `studentVle.csv`:** 10,655,281 rows in 107 chunks of 100,000 each.
Each chunk is typically written in 2-5 seconds, making the total load time approximately
5-9 minutes on typical hardware.

---

### 7.7 Infrastructure — `docker-compose.yml`

```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0           # Official MySQL 8.0 image
    environment:
      MYSQL_ROOT_PASSWORD: rootpass   # Password for root user
      MYSQL_DATABASE: oulad           # Database created automatically on first run
    ports:
      - "3306:3306"            # Map host port 3306 → container port 3306
    volumes:
      - mysql-data:/var/lib/mysql     # Persist data across container restarts

volumes:
  mysql-data:    # Named volume managed by Docker
```

This is an optional convenience for developers who don't have MySQL installed locally.
Running `docker compose up -d` starts MySQL 8.0 in the background with the OULAD
database pre-created and data directory persisted.

**Alternative:** Any MySQL 8.0 instance works — local install, Docker, or cloud (RDS, PlanetScale).
Update `.env` with the correct connection details.

---

### 7.8 Benchmark — `tests/tasks.json`

Ten benchmark queries adapted from the LAK'25 paper, covering 6 analytical categories.
Each entry includes the natural language question and the expected SQL skeleton for
correctness evaluation.

```json
[
  {
    "id": 1,
    "category": "Learner-related",
    "question": "Show distribution of students by highest_education",
    "expected_sql_skeleton": "SELECT highest_education, COUNT(*) FROM studentInfo GROUP BY highest_education"
    // Tests: basic GROUP BY on correct table, correct column location
  },
  {
    "id": 2,
    "category": "Action-related",
    "question": "Who are the 10 most active students based on total clicks in studentVle?",
    "expected_sql_skeleton": "SELECT id_student, SUM(sum_click) FROM studentVle GROUP BY id_student ORDER BY SUM(sum_click) DESC LIMIT 10"
    // Tests: SUM aggregation, ORDER BY DESC, user-specified LIMIT
  },
  {
    "id": 3,
    "category": "Content-related",
    "question": "What is the distribution of VLE activity types?",
    "expected_sql_skeleton": "SELECT activity_type, COUNT(*) FROM vle GROUP BY activity_type"
    // Tests: correct table selection (vle, not studentVle)
  },
  {
    "id": 4,
    "category": "Result-related",
    "question": "Show grade distribution by final_result across all modules",
    "expected_sql_skeleton": "SELECT final_result, COUNT(*) FROM studentInfo GROUP BY final_result"
    // Tests: final_result is ONLY in studentInfo (common LLM error: using wrong table)
  },
  {
    "id": 5,
    "category": "Context-related",
    "question": "Show peak student activity by week (based on date in studentVle)",
    "expected_sql_skeleton": "SELECT FLOOR(date/7) AS week, SUM(sum_click) FROM studentVle GROUP BY week ORDER BY week"
    // Tests: understanding that date is a day number, correct week computation
  },
  {
    "id": 6,
    "category": "Social-related",
    "question": "Are there any forum or collaborative activity types in the VLE data?",
    "expected_sql_skeleton": "SELECT activity_type, COUNT(*) FROM vle WHERE activity_type IN ('forumng','oucollaborate','ouelluminate') GROUP BY activity_type",
    "note": "OULAD has limited social/peer data; forumng is the closest proxy"
    // Tests: WHERE IN clause with domain-specific activity type names
  },
  {
    "id": 7,
    "category": "Learner-related",
    "question": "Show count of students by highest_education for module AAA presentation 2013J",
    "expected_sql_skeleton": "SELECT highest_education, COUNT(*) FROM studentInfo WHERE code_module='AAA' AND code_presentation='2013J' GROUP BY highest_education"
    // Tests: multi-condition WHERE clause with string literals
  },
  {
    "id": 8,
    "category": "Result-related",
    "question": "What is the average assessment score by module?",
    "expected_sql_skeleton": "SELECT code_module, AVG(score) FROM studentAssessment JOIN assessments ON studentAssessment.id_assessment = assessments.id_assessment GROUP BY code_module"
    // Tests: JOIN construction using explicit relationship from system prompt
  },
  {
    "id": 9,
    "category": "Action-related",
    "question": "Compare total clicks per module",
    "expected_sql_skeleton": "SELECT code_module, SUM(sum_click) FROM studentVle GROUP BY code_module"
    // Tests: simple aggregation, correct table
  },
  {
    "id": 10,
    "category": "Learner-related",
    "question": "Show the withdrawal rate by age band",
    "expected_sql_skeleton": "SELECT age_band, SUM(CASE WHEN final_result='Withdrawn' THEN 1 ELSE 0 END)/COUNT(*) FROM studentInfo GROUP BY age_band"
    // Tests: CASE WHEN for conditional aggregation, division for rate computation
  }
]
```

---

## 8. API Reference

The backend exposes 5 REST endpoints. All endpoints return JSON.

### `POST /api/auth/register`

Create a new user account.

**Request body:**
```json
{
  "name": "Alice Smith",
  "email": "alice@university.edu",
  "password": "securepassword",
  "role": "instructor"
}
```

**Response 201:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "name": "Alice Smith", "email": "alice@university.edu", "role": "instructor" }
}
```

**Response 400:** Missing required fields
**Response 409:** Email already registered

---

### `POST /api/auth/login`

Authenticate an existing user.

**Request body:**
```json
{
  "email": "alice@university.edu",
  "password": "securepassword"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "name": "Alice Smith", "email": "alice@university.edu", "role": "instructor" }
}
```

**Response 401:** Invalid email or password

---

### `GET /api/auth/me`

Return the current user from JWT.

**Headers:** `Authorization: Bearer <token>`

**Response 200:**
```json
{
  "user": { "id": 1, "email": "alice@university.edu", "role": "instructor", "name": "Alice Smith" }
}
```

---

### `POST /api/query`

Submit a natural language question. Returns SQL, Vega-Lite spec, and query results.

**Headers:** `Authorization: Bearer <token>`

**Request body:**
```json
{
  "question": "Show distribution of students by highest_education",
  "sessionId": "default"
}
```

**Response 200:**
```json
{
  "sql": "SELECT highest_education, COUNT(*) AS cnt FROM studentInfo GROUP BY highest_education LIMIT 1000",
  "vega": {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "title": "Students by Education Level",
    "mark": "bar",
    "encoding": {
      "x": { "field": "highest_education", "type": "nominal" },
      "y": { "field": "cnt", "type": "quantitative" }
    }
  },
  "data": [
    { "highest_education": "HE Qualification", "cnt": "14163" },
    { "highest_education": "A Level or Equivalent", "cnt": "8085" },
    ...
  ]
}
```

**Response 400:** Missing question field
**Response 401:** Missing or invalid JWT
**Response 500:** LLM/SQL failure after all retries

---

### `GET /api/health`

Check database connectivity.

**Response 200:**
```json
{ "status": "ok", "schema": true }
```

**Response 500:**
```json
{ "status": "error", "error": "Connection refused" }
```

---

### `GET /api/schema`

Return the database schema description used in LLM prompts.

**Response 200:**
```json
{
  "schema": "assessments: code_module (varchar), ...\ncourses: code_module (varchar), ..."
}
```

---

## 9. LLM Prompt Engineering

The system prompt is the central design artifact of this project. It must:

1. Tell the LLM its role and task
2. Provide the full database schema (dynamically injected)
3. Specify JOIN relationships explicitly (LLMs often guess wrong join conditions)
4. Enumerate categorical values (prevents misspelling in WHERE clauses)
5. Constrain the output format to strict JSON
6. Provide few-shot examples for both data queries and chart modifications
7. Handle the chart modification use case (reuse SQL, modify only the Vega spec)

### Complete System Prompt

```
You generate MySQL queries and Vega-Lite charts for a learning analytics database.

SCHEMA:
assessments: code_module (varchar), code_presentation (varchar), id_assessment (int), assessment_type (varchar), date (int), weight (float)
courses: code_module (varchar), code_presentation (varchar), module_presentation_length (int)
studentAssessment: id_assessment (int), id_student (int), date_submitted (int), is_banked (tinyint), score (float)
studentInfo: code_module (varchar), code_presentation (varchar), id_student (int), gender (varchar), region (varchar), highest_education (varchar), imd_band (varchar), age_band (varchar), num_of_prev_attempts (int), studied_credits (int), disability (varchar), final_result (varchar)
studentRegistration: code_module (varchar), code_presentation (varchar), id_student (int), date_registration (int), date_unregistration (int)
studentVle: code_module (varchar), code_presentation (varchar), id_student (int), id_site (int), date (int), sum_click (int)
users: id (int), name (varchar), email (varchar), password_hash (varchar), role (enum), created_at (timestamp)
vle: id_site (int), code_module (varchar), code_presentation (varchar), activity_type (varchar), week_from (int), week_to (int)

JOINS: studentAssessment→assessments ON id_assessment | studentVle→vle ON id_site,code_module,code_presentation | any student table→courses ON code_module,code_presentation

RULES:
- final_result, gender, highest_education are ONLY in studentInfo
- date columns are relative day numbers (not calendar dates)
- final_result values: 'Pass','Fail','Withdrawn','Distinction'
- Always add a LIMIT clause. Use the number the user specifies (e.g. "top 10" → LIMIT 10), otherwise default to LIMIT 1000
- Return ONLY valid JSON, nothing else

OUTPUT FORMAT:
{"sql":"SELECT ...","vega":{"$schema":"https://vega.github.io/schema/vega-lite/v5.json","title":"...","mark":"bar","encoding":{"x":{"field":"...","type":"nominal"},"y":{"field":"...","type":"quantitative"}}}}

EXAMPLE:
User: Show count of students by highest_education
{"sql":"SELECT highest_education, COUNT(*) AS cnt FROM studentInfo GROUP BY highest_education LIMIT 1000","vega":{"$schema":"https://vega.github.io/schema/vega-lite/v5.json","title":"Students by Education","mark":"bar","encoding":{"x":{"field":"highest_education","type":"nominal"},"y":{"field":"cnt","type":"quantitative"}}}}

EXAMPLE:
User: Show total clicks per week for module BBB 2013J as a line chart
{"sql":"SELECT FLOOR(date/7) AS week, SUM(sum_click) AS clicks FROM studentVle WHERE code_module='BBB' AND code_presentation='2013J' GROUP BY week ORDER BY week LIMIT 1000","vega":{"$schema":"https://vega.github.io/schema/vega-lite/v5.json","title":"Weekly Clicks BBB 2013J","mark":"line","encoding":{"x":{"field":"week","type":"quantitative"},"y":{"field":"clicks","type":"quantitative"}}}}

CHART MODIFICATIONS:
If the user asks to change a color, chart type, or title of the previous chart, reuse the SAME sql and modify the vega spec.
- Change color: add "color":{"value":"<color>"} to encoding, or set "mark":{"type":"bar","color":"<color>"}
- Change chart type: update the mark (bar, line, area, point, arc)
- Change title: update the title field

EXAMPLE:
User: change the color to orange
{"sql":"<same sql as before>","vega":{"$schema":"https://vega.github.io/schema/vega-lite/v5.json","title":"<same title>","mark":{"type":"bar","color":"orange"},"encoding":{"x":{"field":"...","type":"nominal"},"y":{"field":"...","type":"quantitative"}}}}

Return ONLY the JSON object for the user's question.
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Dynamic schema injection | Schema always reflects actual DB state; no manual maintenance |
| Explicit JOIN paths | `llama3.1:8b` frequently generates incorrect JOIN conditions without hints |
| Column location rules | Without the hint, the model queries `final_result` from `studentVle` (does not exist) |
| Enumerate `final_result` values | Prevents `'Withdraw'` (wrong) vs `'Withdrawn'` (correct) typos |
| "LIMIT unless user specifies" rule | Original "always LIMIT 1000" caused the model to ignore "top 10" requests |
| Two few-shot examples | One bar chart, one line chart — sufficient to ground the output format |
| Chart modification example | Without this, the model would regenerate SQL for style-only requests |
| `format: "json"` in Ollama options | Most important reliability fix — prevents prose wrapping the JSON |

---

## 10. SQL Safety & Security

### Query Validation Pipeline

```
LLM output (raw string)
       │
       ▼
extractJSON() → strip fences, find { }, repair truncated
       │
       ▼
parsed.sql (string)
       │
       ▼
validateSQL():
  1. trimmed.toUpperCase().startsWith("SELECT")? → else throw
  2. FORBIDDEN regex test? → if match, throw
  3. return cleaned sql (no trailing semicolons)
       │
       ▼
pool.query(safeSql)  ← parameterized connection, no string interpolation
       │
       ▼
rows[] returned to frontend
```

### Threat Model

| Threat | Mitigation |
|--------|------------|
| LLM generates `DROP TABLE studentInfo` | `validateSQL` requires SELECT as first keyword |
| LLM generates `SELECT 1; DELETE FROM users` | FORBIDDEN regex catches `DELETE`; no multi-statement support |
| LLM generates `SELECT * FROM users` (leaks passwords) | Not blocked by current implementation — future work: table allowlist |
| Full table scan on 10.6M rows | LIMIT clause rule in system prompt; default LIMIT 1000 |
| User provides malicious `question` parameter | User input is only passed as a `content` string to the LLM, never interpolated into SQL directly; the LLM generates the SQL |
| JWT token forgery | `jwt.verify` checks signature with `JWT_SECRET` |
| Password brute force | bcrypt's cost factor (10 rounds, ~100ms) makes brute force impractical |
| Sensitive data in version control | `.env` is in `.gitignore`; passwords are hashed |

### Known Limitations

- No table allowlist: a malicious or confused LLM could query the `users` table and
  return password hashes (though bcrypt hashes are not recoverable, they shouldn't be
  exposed). Future work: add a table allowlist to the validation layer.
- No rate limiting on `/api/query`: a user could exhaust LLM resources with rapid requests.
- Conversation history is in-memory: server restarts clear all sessions.

---

## 11. Benchmark Evaluation

### Methodology

Ten queries from `tests/tasks.json` were submitted through the web interface using
`llama3.1:8b` with `temperature: 0`. Each query was evaluated for:
- **SQL correctness:** Does the generated SQL match the expected SQL skeleton's intent?
- **Visualization appropriateness:** Is the chart type and encoding semantically correct?
- **Execution success:** Does the SQL execute without MySQL errors?

### Results

| # | Question (abbreviated) | SQL Correct | Chart Correct | Notes |
|---|------------------------|-------------|---------------|-------|
| 1 | Distribution by highest_education | ✓ | ✓ Bar chart | Correct table selection |
| 2 | 10 most active students by clicks | ✓ | ✓ Bar chart | Correct SUM + ORDER BY + LIMIT 10 |
| 3 | VLE activity type distribution | ✓ | ✓ Bar chart | Correct table (vle, not studentVle) |
| 4 | Grade distribution by final_result | ✓ | ✓ Bar chart | Correct table (studentInfo) |
| 5 | Peak activity by week | ✓ | ✓ Line chart | FLOOR(date/7) computed correctly |
| 6 | Forum/collaborative activity types | ✓ | ✓ Bar chart | WHERE IN with correct activity names |
| 7 | Students by education for AAA 2013J | ✓ | ✓ Bar chart | Multi-condition WHERE correct |
| 8 | Average score by module | ✓ | ✓ Bar chart | JOIN on id_assessment correct |
| 9 | Total clicks per module | ✓ | ✓ Bar chart | Correct GROUP BY |
| 10 | Withdrawal rate by age band | ✓ | ✓ Bar chart | CASE WHEN + division correct |

**10/10 queries succeeded** on `llama3.1:8b` with the engineered prompt.

### Observed LLM Behaviors

**Strengths:**
- Correctly identifies which table contains `final_result` (reinforced by system prompt)
- Generates proper JOINs when needed (query 8)
- Correctly interprets "week" as `FLOOR(date/7)` (reinforced by system prompt)
- Respects user-specified LIMIT values ("top 10" → LIMIT 10)

**Occasional Failures (resolved by retry):**
- Generates `"stackedbar"` as a mark type (fixed by `ChartCard.js` normalization)
- Returns truncated JSON for very complex specs (fixed by `extractJSON` repair)
- Misidentifies table for `gender`/`age_band` on first attempt (fixed by retry error feedback)

---

## 12. Project Timeline & Milestones

| Milestone | Planned | Actual | Status |
|-----------|---------|--------|--------|
| Signed Proposal | Feb 28 | Mar 9 | Completed (minor delay — revision cycles) |
| System Architecture Finalized | Mar 10 | Mar 10 | On time |
| Database Schema Complete | Mar 15 | Mar 15 | On time |
| Dataset Integration | Mar 20 | Mar 26 | +6 days (chunked loading discovery) |
| Frontend Prototype | Mar 25 | Mar 30 | +5 days (auth flow added) |
| Backend APIs Functional | Apr 5 | Mar 30 | **6 days early** |
| AI Integration Complete | Apr 12 | Mar 30 | **13 days early** |
| SQL + Visualization Generation | Apr 18 | Apr 25 | +7 days (spec normalization work) |
| Integration Testing | Apr 25 | Apr 25 | On time |
| Analytics Dashboard Complete | May 1 | Apr 29 | **2 days early** |
| Final Testing | May 10 | May 4 | **6 days early** |
| Final Submission | May 15 | May 4 | **11 days early** |

---

## 13. Challenges & Solutions

### Challenge 1: LLM Returning Invalid or Truncated JSON

**Problem:** `llama3.1:8b` without constraints would frequently:
- Wrap the JSON in markdown fences (` ```json `)
- Prepend explanatory text ("Here is the answer:")
- Truncate the response before closing all braces (especially for complex Vega specs)

**Solution (layered approach):**
1. Added `format: "json"` to the Ollama API call — this is the most impactful fix,
   forcing the model's tokenizer to only emit valid JSON tokens
2. Increased `num_predict` from the default to 1024 to prevent truncation
3. Compressed the system prompt to leave more token budget for the response
4. Implemented `extractJSON()` with markdown stripping and brace-counting repair

**Impact:** Reduced first-attempt JSON parse failures from ~30% to ~5%.

---

### Challenge 2: 10.6 Million Row Dataset Load Failure

**Problem:** Attempting to load `studentVle.csv` (443 MB, 10.6M rows) with
`df = pd.read_csv(path); df.to_sql(...)` caused Python to run out of memory
(killed by the OS) and MySQL to timeout on very large single transactions.

**Solution:** Implemented chunked loading in `load_oulad.py`:
- Detect files over 500,000 rows using a line count
- Use `pd.read_csv(path, chunksize=100_000)` to process 100,000 rows at a time
- Use `if_exists="replace"` on the first chunk, `"append"` on subsequent chunks

**Impact:** `studentVle.csv` now loads successfully in approximately 7 minutes.

---

### Challenge 3: Invalid Vega-Lite Specs from the LLM

**Problem:** The LLM generated several classes of invalid Vega-Lite specifications:
- Invalid mark types: `"stackedbar"`, `"piechart"`, `"histogram"`
- Pie charts with `x`/`y` encoding (correct Vega-Lite is `theta`/`color` for `arc` mark)
- Missing `color` encoding for queries with 3+ fields
- Mark objects like `{"type": null}` or `{}` (mark without a type)

**Solution:** Built the `normalizeSpec()` function in `ChartCard.js` as a pre-processing
step before rendering, with substring matching for common misspellings, encoding rewiring
for arc charts, and a fallback renderer that strips to the simplest possible bar chart.

**Impact:** Chart rendering success rate improved from ~70% to ~97%.

---

### Challenge 4: MySQL BIGINT Returned as Strings

**Problem:** `COUNT(*)` and `SUM()` in MySQL return `BIGINT` values. The `mysql2`
JavaScript driver returns these as JavaScript strings (e.g., `"42"` not `42`).
Vega-Lite's type system treated these as nominal/ordinal strings and refused to
render them as bar heights (quantitative fields).

**Solution:** Added `coerceData()` in `ChartCard.js`: for any encoding field declared
as `type: "quantitative"`, convert string values to numbers using `Number(value)`,
checking for `isNaN` before committing the conversion.

**Impact:** All COUNT/SUM/AVG aggregation results now render correctly as bar heights,
line points, and arc angles.

---

### Challenge 5: LIMIT Clause Conflict with User-Specified Counts

**Problem:** The initial system prompt rule was:
```
Always add LIMIT 1000 to prevent large result sets.
```
This caused the model to literally always add `LIMIT 1000`, even when the user
asked for "the top 10 most active students" — the model would generate `LIMIT 1000`
instead of `LIMIT 10`.

**Solution:** Changed the rule to:
```
Always add a LIMIT clause. Use the number the user specifies
(e.g. "top 10" → LIMIT 10), otherwise default to LIMIT 1000.
```

**Impact:** User-specified limits are now respected correctly.

---

## 14. Ethics & Responsible AI Usage

### Data Ethics

| Concern | Assessment | Mitigation Applied |
|---------|------------|-------------------|
| Privacy of student data | Low — OULAD is fully anonymized, no PII | Only anonymized integer IDs in dataset |
| User credential security | Low | Passwords bcrypt-hashed; JWT expires 24h; `.env` in `.gitignore` |
| SQL injection via LLM | Medium | SELECT-only validation; forbidden keyword regex; parameterized queries |
| LLM hallucination in SQL | Medium | Generated SQL visible to user; retry with error correction; View SQL button |
| Algorithmic bias | Low-Medium | LLM generates SQL, not interpretations; raw data returned; user controls analysis |
| Misinterpretation of results | Medium | "View SQL" + "View data table" enable verification; row count shown |

### Responsible AI Principles Demonstrated

**1. Transparency**
Every chart response includes a collapsible "View SQL" section showing the exact query
executed. Users can verify that the data matches their question before drawing conclusions.

**2. Human Oversight**
The system is a tool that generates queries, not an autonomous decision-maker. Users
review the output, can ask follow-up questions to refine results, and can see the raw
data table to spot anomalies.

**3. Safety**
Multiple layers prevent the LLM from modifying data: SQL validation (SELECT-only),
forbidden keyword filtering, and parameterized query execution. The database user
could additionally be restricted to SELECT-only privileges in production.

**4. Privacy**
Passwords are never stored or transmitted in plain text. The JWT payload contains only
non-sensitive fields (id, name, email, role). The `.env` file is excluded from version
control, preventing credential leakage.

**5. Accountability**
Conversation history is maintained per session, enabling a review of what questions were
asked and what SQL was generated. In production, interaction logs could be stored in the
database for audit purposes.

### Ethics Assessment Summary (from Proposal, Table 4)

Key findings from the 28-question ethics assessment:
- Question 9 (Would users be upset if data was given to someone else?): **YES** — mitigated
  by keeping data local and not sharing with third parties
- Questions 3/12/20/22 (potential misuse, bias): **MAYBE** — addressed through user
  transparency features and read-only access
- All harm/privacy/discrimination questions: **NO** under normal operating conditions

---

## 15. Future Work

### Near-term Enhancements

1. **Dashboard Panel** — Allow users to pin and arrange generated charts into a persistent
   multi-chart dashboard. Charts could be saved with titles and organized in a grid layout.
   Implementation: store chart configs (sql + vega spec) in the database, render a
   separate `/dashboard` page with drag-and-drop arrangement.

2. **Role-based Feature Differentiation** — Currently both students and instructors see the
   same interface. Future versions could give instructors access to class-wide analytics
   and question logs, while students see only individual-level data.

3. **Cloud Deployment** — Deploy frontend to Vercel and backend + MySQL to AWS/Railway.
   This would make the application accessible without local setup.

4. **Multi-model Support** — The `callLLM` function can be extended to support multiple
   backends (OpenAI GPT-4, Anthropic Claude, Google Gemini) with a model selector in the UI.
   The `package.json` already includes `openai`, `@anthropic-ai/sdk`, and `@google/generative-ai`.

### Research Directions

5. **Interaction Logging & Analysis** — Store all user questions, generated SQL, and
   user satisfaction signals to analyze patterns in how instructors and students query
   educational data. This closes the loop with the original research question of the
   LAK'25 paper.

6. **Prompt Template Library** — Pre-built question templates organized by pedagogical
   purpose (e.g., "Identify at-risk students", "Compare module engagement"), making the
   tool accessible to users unfamiliar with what questions are possible.

7. **Evaluation Rubric for SQL Quality** — Automated evaluation of generated SQL against
   expected skeletons from `tasks.json`, enabling systematic comparison of different LLMs
   and prompt strategies.

---

## 16. References

1. Wang Z., Lin W., Hu X. (2025). *Self-service Teacher-facing Learning Analytics Dashboard
   with Large Language Models.* Proceedings of the 15th International Learning Analytics
   and Knowledge Conference (LAK'25), pp. 824–830.
   doi: [10.1145/3706468.3706491](https://doi.org/10.1145/3706468.3706491)

2. Kuzilek J., Hlosta M., Zdrahal Z. (2017). *Open University Learning Analytics dataset.*
   Scientific Data, 4:170171.
   doi: [10.1038/sdata.2017.171](https://doi.org/10.1038/sdata.2017.171)

3. Satyanarayan A., Moritz D., Wongsuphasawat K., Heer J. (2017). *Vega-Lite: A Grammar
   of Interactive Graphics.* IEEE Transactions on Visualization and Computer Graphics,
   23(1), pp. 341–350.

4. Meta AI. (2024). *Llama 3.1: Open Foundation and Fine-Tuned Large Language Models.*
   [https://ai.meta.com/blog/meta-llama-3-1/](https://ai.meta.com/blog/meta-llama-3-1/)

5. Ollama. (2024). *Run Llama, Mistral, Gemma, and other models locally.*
   [https://ollama.com](https://ollama.com)

6. Next.js Documentation. (2024). *React Framework for the Web.*
   [https://nextjs.org/docs](https://nextjs.org/docs)

7. OWASP. (2023). *OWASP Top Ten — SQL Injection.*
   [https://owasp.org/www-community/attacks/SQL_Injection](https://owasp.org/www-community/attacks/SQL_Injection)

---

*Document prepared by Saumya Gupta — Spring 2026 Capstone, under the guidance of Professor Dr. Xiao Hu.*
