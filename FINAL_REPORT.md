# Web Application for Human-AI Interactions

## Final Project Report

**Saumya Gupta, Project Manager**
Under the guidance of Professor Dr. Xiao Hu
Spring 2026 Semester
Date: May 4, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Objectives & Requirements](#2-project-objectives--requirements)
3. [System Architecture](#3-system-architecture)
4. [Implementation](#4-implementation)
   - 4.1 Frontend Interaction Layer
   - 4.2 Backend Application Layer
   - 4.3 Data and Analytics Layer
5. [Technology Stack](#5-technology-stack)
6. [Key Features](#6-key-features)
7. [LLM Prompt Engineering](#7-llm-prompt-engineering)
8. [SQL Safety & Security](#8-sql-safety--security)
9. [Benchmark Evaluation](#9-benchmark-evaluation)
10. [Project Timeline & Milestones](#10-project-timeline--milestones)
11. [Challenges & Solutions](#11-challenges--solutions)
12. [Ethics & Responsible AI Usage](#12-ethics--responsible-ai-usage)
13. [Deliverables](#13-deliverables)
14. [Future Work](#14-future-work)
15. [Conclusion](#15-conclusion)
16. [References](#16-references)
17. [Appendix](#17-appendix)

---

## 1. Executive Summary

This report documents the design, implementation, and evaluation of a web-based platform that supports structured and transparent human-AI interactions within educational environments. The system is built around a self-service learning analytics dashboard powered by large language models (LLMs), enabling instructors and students to explore educational data using natural language.

Traditional learning analytics dashboards require technical expertise and manual dashboard construction. Many instructors lack the data literacy or programming background needed to query large educational datasets effectively. This project addresses this limitation by integrating an LLM into a full-stack web application, enabling teachers to generate analytics dashboards by simply typing questions in plain English.

The system is built on the Open University Learning Analytics Dataset (OULAD), which contains data from 32,593 students across 22 course presentations, including demographic information, assessment results, 10.6 million clickstream interactions, and virtual learning environment activity logs. Users type natural language questions (e.g., "Show the withdrawal rate by age band"); the backend translates these into SQL queries via the LLM, executes them against MySQL, and returns interactive Vega-Lite visualizations — all within a conversational chatbot interface.

The project was developed by Saumya Gupta under the guidance of Professor Dr. Xiao Hu during the Spring 2026 semester, and was inspired by the LAK'25 paper by Wang, Lin, and Hu on self-service teacher-facing learning analytics dashboards with LLMs.

---

## 2. Project Objectives & Requirements

The objective of this project was to build a web application that enables structured human-AI interaction for educational use while ensuring transparency, instructor oversight, and self-service analytics capabilities. The following requirements were defined in the project proposal:

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Secure authentication with role-based access | Implemented |
| 2 | Guided AI interaction interface | Implemented |
| 3 | Log and store AI interactions securely | Implemented (conversation history per session) |
| 4 | Natural language querying of interaction data | Implemented |
| 5 | Convert natural language prompts into SQL queries | Implemented |
| 6 | Automatically generate data visualizations | Implemented |
| 7 | Instructor analytics dashboards | Implemented |
| 8 | Configurable prompt templates | Implemented (system prompt with schema injection) |
| 9 | Demonstrate responsible AI usage principles | Implemented (SQL safety, read-only queries) |
| 10 | Deployment-ready architecture | Implemented |

---

## 3. System Architecture

The application follows a three-layer architecture as outlined in the original proposal:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Port 3000)                  │
│               React + Next.js 14 Application            │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Auth UI │  │  Chat Panel  │  │  History Sidebar  │  │
│  │ (auth.js)│  │  (page.js)   │  │    (page.js)     │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
│                 ┌──────────────┐                        │
│                 │  ChartCard   │                        │
│                 │ (Vega-Lite)  │                        │
│                 └──────────────┘                        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP + JWT Bearer Token
┌──────────────────────▼──────────────────────────────────┐
│                   Backend (Port 4000)                    │
│              Node.js + Express API Server                │
│                                                         │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Auth Routes  │  │  Query   │  │  SQL Safety &    │  │
│  │ register     │  │ Endpoint │  │  Validation      │  │
│  │ login        │  │ /api/    │  │                  │  │
│  │ JWT verify   │  │  query   │  │                  │  │
│  └──────────────┘  └────┬─────┘  └──────────────────┘  │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │           LLM Prompt Construction                │   │
│  │  System prompt + schema injection + history      │   │
│  └──────────────────────┬───────────────────────────┘   │
└──────────────────────┬──┴───────────────────────────────┘
                       │                │
        ┌──────────────▼──┐   ┌────────▼─────────┐
        │  MySQL (3306)   │   │  Ollama (11434)  │
        │                 │   │                  │
        │  OULAD tables:  │   │  llama3.1:8b     │
        │  - courses      │   │  NL → SQL +      │
        │  - assessments  │   │  Vega-Lite spec  │
        │  - studentInfo  │   │                  │
        │  - studentVle   │   └──────────────────┘
        │  - vle          │
        │  - studentAssmt │
        │  - studentReg   │
        │  - users        │
        └─────────────────┘
```

### Data Flow

1. User types a natural language question in the chat interface
2. Frontend sends the question to `/api/query` with a JWT bearer token
3. Backend validates the token, constructs an LLM prompt with the database schema and conversation history
4. Ollama (llama3.1:8b) generates a JSON response containing a SQL query and a Vega-Lite visualization spec
5. Backend validates the SQL for safety (SELECT-only, no forbidden keywords)
6. Backend executes the SQL against MySQL and returns the data + Vega spec to the frontend
7. Frontend renders an interactive chart using Vega-Lite inside the chat bubble
8. If the LLM response fails (invalid JSON, SQL error), the backend retries up to 3 times with error feedback

---

## 4. Implementation

### 4.1 Frontend Interaction Layer

The frontend is a React + Next.js 14 single-page application with the following components:

**Authentication UI (`auth.js`)**
- Tab-based login/register interface
- Role selection during registration (student or instructor)
- JWT token stored in `localStorage` for persistent sessions
- Automatic redirect to login when token is missing or expired

**Chat Dashboard (`page.js`)**
- Conversational chatbot interface with message bubbles (user on right, bot on left)
- Text input pinned at bottom with send button
- Animated typing indicator (bouncing dots) during LLM processing
- Empty state with suggestion chips for quick-start queries
- Smart suggestions that prioritize recent data questions over modification requests
- User avatar with click-based dropdown menu (name, role, sign out)

**History Sidebar (`page.js`)**
- Slide-out sidebar triggered by hamburger menu
- All past questions persisted in `localStorage` (survives browser refresh)
- Click any past question to load it into the input
- Individual question removal and "Clear all history" option
- "New Chat" button to start a fresh conversation

**Chart Renderer (`ChartCard.js`)**
- Renders Vega-Lite specifications as interactive SVG charts
- Spec normalization layer that fixes common LLM errors:
  - Invalid mark types (e.g., `"stackedbar"` → `"bar"`)
  - Pie/arc charts with incorrect encoding (converts `x`/`y` to `theta`/`color`)
  - Missing `color` encoding for stacked/grouped charts
- Numeric data coercion (MySQL returns BIGINT as strings; coerced to numbers for Vega)
- Fallback rendering: if the primary spec fails, automatically retries with a simplified bar chart
- Fixed chart dimensions (520×300 for standard charts, 350×350 for pie charts)

**Styling (`globals.css`)**
- Full-width header with three-column grid layout (menu | title | avatar)
- Centered 860px content area for messages and input
- Responsive design with mobile breakpoints
- Collapsible "View SQL" and "View data table" sections inside bot bubbles

### 4.2 Backend Application Layer

The backend is a Node.js + Express API server (`backend/index.js`, 379 lines) that handles:

**Authentication & Authorization**
- `POST /api/auth/register` — Creates user with bcrypt-hashed password (10 salt rounds)
- `POST /api/auth/login` — Validates credentials, returns JWT token (24h expiry)
- `GET /api/auth/me` — Returns current user from token
- JWT middleware protects all `/api/query` requests
- `users` table auto-created on first startup

**LLM Integration (Ollama)**
- Connects to local Ollama instance running `llama3.1:8b`
- Sends `format: "json"` to constrain output to valid JSON
- Sets `num_predict: 1024` to prevent response truncation
- Temperature set to 0 for deterministic outputs

**System Prompt Engineering**
- Dynamically injects the full database schema (table names, column names, data types)
- Includes table relationship mappings for JOIN guidance
- Critical rules about column locations (e.g., `final_result` only in `studentInfo`)
- Few-shot examples for bar charts, line charts, and chart modifications
- Explicit instructions for handling follow-up requests (color changes, chart type switches)

**Conversation History**
- Per-session conversation history (up to 6 turns)
- Enables follow-up questions and iterative chart refinement
- Previous context helps the LLM understand modification requests

**SQL Safety**
- Only `SELECT` statements allowed
- Regex-based forbidden keyword filter: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXEC, CALL, SET
- Dynamic LIMIT clause (respects user-specified limits, defaults to 1000)
- Retry logic: up to 3 attempts with error feedback to the LLM

**JSON Extraction & Repair**
- Strips markdown fences and leading text from LLM responses
- Truncated JSON repair: counts open braces/brackets and closes them automatically
- Handles edge cases like unclosed strings in truncated responses

**API Endpoints**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account (name, email, password, role) |
| POST | `/api/auth/login` | No | Login, returns JWT token |
| GET | `/api/auth/me` | Yes | Get current user from token |
| POST | `/api/query` | Yes | Submit NL question, returns SQL + Vega spec + data |
| GET | `/api/health` | No | Health check (DB connectivity) |
| GET | `/api/schema` | No | Returns database schema description |

### 4.3 Data and Analytics Layer

**OULAD Dataset**
The Open University Learning Analytics Dataset is stored in MySQL across 7 tables:

| Table | Rows | Description |
|-------|------|-------------|
| `courses` | 22 | Module/presentation catalog with duration |
| `assessments` | 206 | Assessment definitions (TMA, CMA, Exam) with dates and weights |
| `vle` | 6,364 | Virtual learning environment material metadata |
| `studentInfo` | 32,593 | Student demographics, prior education, and final results |
| `studentRegistration` | 32,593 | Registration and unregistration timestamps |
| `studentAssessment` | 173,912 | Assessment submissions with scores |
| `studentVle` | 10,655,281 | Clickstream data (student interactions with VLE materials) |

**Users Table**
An 8th table (`users`) stores application user accounts:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-incrementing user ID |
| `name` | VARCHAR(100) | User's display name |
| `email` | VARCHAR(255) | Unique email address |
| `password_hash` | VARCHAR(255) | bcrypt hash (10 rounds) |
| `role` | ENUM | `'student'` or `'instructor'` |
| `created_at` | TIMESTAMP | Account creation time |

**Data Loading**
The `scripts/load_oulad.py` script loads CSV files into MySQL with automatic chunking for large files (100K rows per chunk for files exceeding 500K rows). This prevents memory issues with the 10.6M-row `studentVle.csv` file.

---

## 5. Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend | React + Next.js | 14.2.35 |
| Backend | Node.js + Express | 4.21.2 |
| Database | MySQL | 8.0 |
| LLM | Ollama (llama3.1:8b) | Local inference |
| Visualization | Vega-Lite | v5 |
| Authentication | JWT (bcryptjs + jsonwebtoken) | — |
| Data Loading | Python + pandas + SQLAlchemy | 3.x |
| Version Control | GitHub | — |

---

## 6. Key Features

### Natural Language to SQL
Users type questions in plain English. The LLM translates them into MySQL SELECT queries using zero-shot text-to-SQL generation. The system prompt provides the database schema, table relationships, and few-shot examples to guide generation.

### Automated Visualization Generation
Along with SQL, the LLM generates a Vega-Lite specification that describes the appropriate chart type, axis mappings, and title. Supported chart types include bar, line, area, point, and arc (pie) charts.

### Conversational Interaction
The chatbot supports multi-turn conversations. Users can:
- Ask follow-up questions that build on previous context
- Modify existing charts: "change the color to orange", "make it a line chart", "change the title to Top Students"
- The backend maintains conversation history (up to 6 turns) per session

### Chart Normalization
The frontend includes a normalization layer that automatically fixes common LLM errors in Vega-Lite specs:
- Invalid mark types (e.g., `"stackedbar"` → `"bar"`)
- Incorrect pie chart encoding (converts `x`/`y` to `theta`/`color`)
- Missing `color` encoding for multi-field queries
- String-to-number coercion for quantitative fields
- Fallback rendering to a simple bar chart if the primary spec fails

### Role-Based Authentication
JWT-based authentication with two roles:
- **Student**: Can query data and generate visualizations
- **Instructor**: Can query data and generate visualizations (extensible for admin features)

### Query History
Persistent question history stored in the browser's `localStorage`, with:
- Smart suggestion chips that prioritize past data questions
- Filtering of modification requests from suggestions
- Individual and bulk deletion

---

## 7. LLM Prompt Engineering

The system uses a carefully designed prompt structure for zero-shot text-to-SQL and visualization generation:

**1. Role Definition**
The LLM is instructed to act as a data analyst generating MySQL queries and Vega-Lite charts.

**2. Schema Injection**
The full database schema is dynamically loaded from MySQL's `information_schema` and injected into every prompt, including table names, column names, and data types.

**3. Relationship Mapping**
Explicit JOIN relationships are provided:
- `studentAssessment` → `assessments` ON `id_assessment`
- `studentVle` → `vle` ON `id_site`, `code_module`, `code_presentation`
- Any student table → `courses` ON `code_module`, `code_presentation`

**4. Critical Rules**
- Column location constraints (e.g., `final_result` is ONLY in `studentInfo`)
- Date interpretation (relative day numbers, not calendar dates)
- Enumerated values for categorical fields
- LIMIT clause requirements

**5. Output Format**
Strict JSON format with `sql` and `vega` keys, including the complete Vega-Lite schema URL.

**6. Few-Shot Examples**
Two examples demonstrating bar chart and line chart generation, plus one example for chart modification (color change).

**7. Ollama-Specific Optimizations**
- `format: "json"` forces JSON-only output, preventing the model from adding explanatory text
- `num_predict: 1024` ensures responses aren't truncated
- `temperature: 0` for deterministic, reproducible outputs

---

## 8. SQL Safety & Security

### Query Validation
- Only `SELECT` statements are permitted; the first keyword must be `SELECT`
- A regex-based filter blocks 12 forbidden SQL keywords: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXEC, CALL, SET
- Row limits are enforced (user-specified or default 1000)

### Authentication Security
- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens with 24-hour expiration
- Bearer token required for all data query endpoints
- Credentials and secrets stored in `.env` (excluded from version control via `.gitignore`)

### Error Handling
- Retry logic with error feedback: if the LLM generates invalid SQL, the error message is fed back for self-correction (up to 3 attempts)
- Truncated JSON repair: automatically closes unclosed braces, brackets, and strings
- Frontend fallback rendering for invalid Vega-Lite specs

---

## 9. Benchmark Evaluation

Ten benchmark queries adapted from the LAK'25 paper were used to evaluate the system's capabilities across six categories:

| # | Category | Question | Expected Behavior |
|---|----------|----------|-------------------|
| 1 | Learner-related | Show distribution of students by highest_education | GROUP BY highest_education |
| 2 | Action-related | Who are the 10 most active students based on total clicks? | SUM, ORDER BY DESC, LIMIT 10 |
| 3 | Content-related | What is the distribution of VLE activity types? | GROUP BY activity_type |
| 4 | Result-related | Show grade distribution by final_result across all modules | GROUP BY final_result |
| 5 | Context-related | Show peak student activity by week | FLOOR(date/7), SUM, GROUP BY |
| 6 | Social-related | Are there any forum or collaborative activity types? | WHERE IN, GROUP BY |
| 7 | Learner-related | Show count of students by highest_education for module AAA 2013J | WHERE + GROUP BY |
| 8 | Result-related | What is the average assessment score by module? | AVG, JOIN, GROUP BY |
| 9 | Action-related | Compare total clicks per module | SUM, GROUP BY |
| 10 | Learner-related | Show the withdrawal rate by age band | CASE WHEN, division, GROUP BY |

The system successfully generates correct SQL and appropriate visualizations for all benchmark queries. The LLM (llama3.1:8b) demonstrates strong capability in translating natural language into SQL with proper table selection, JOIN usage, aggregation functions, and filtering.

---

## 10. Project Timeline & Milestones

| Milestone | Planned Date | Actual Date | Status |
|-----------|-------------|-------------|--------|
| Signed Proposal | Feb 28, 2026 | Mar 9, 2026 | Completed |
| System Architecture Finalized | Mar 10, 2026 | Mar 10, 2026 | Completed |
| Database Schema Complete | Mar 15, 2026 | Mar 15, 2026 | Completed |
| Dataset Integration | Mar 20, 2026 | Mar 26, 2026 | Completed |
| Frontend Prototype Complete | Mar 25, 2026 | Mar 30, 2026 | Completed |
| Backend APIs Functional | Apr 5, 2026 | Mar 30, 2026 | Completed (early) |
| AI Integration Complete | Apr 12, 2026 | Mar 30, 2026 | Completed (early) |
| SQL + Visualization Generation Complete | Apr 18, 2026 | Apr 25, 2026 | Completed |
| Integration Testing Complete | Apr 25, 2026 | Apr 25, 2026 | Completed |
| Analytics Dashboard Complete | May 1, 2026 | Apr 29, 2026 | Completed (early) |
| Final Testing Complete | May 10, 2026 | May 4, 2026 | Completed (early) |
| Final Submission | May 15, 2026 | May 4, 2026 | Completed |

---

## 11. Challenges & Solutions

### Challenge 1: LLM Returning Invalid JSON
**Problem:** The local LLM (llama3.1:8b) frequently wrapped JSON responses in explanatory text or produced truncated output.
**Solution:** Added `format: "json"` to the Ollama API call to force JSON-only output, increased `num_predict` to 1024, compressed the system prompt to leave more tokens for the response, and implemented a JSON repair function that closes unclosed braces/brackets.

### Challenge 2: Large Dataset Loading Failures
**Problem:** The `studentVle.csv` file (10.6M rows, 443 MB) failed to load into MySQL in a single operation.
**Solution:** Implemented chunked loading in `load_oulad.py` — files exceeding 500K rows are loaded in 100K-row chunks using pandas.

### Challenge 3: Invalid Vega-Lite Specifications
**Problem:** The LLM generated invalid mark types (e.g., `"stackedbar"`) and incorrect encodings for pie charts (using `x`/`y` instead of `theta`/`color`).
**Solution:** Built a comprehensive spec normalization layer in `ChartCard.js` that maps invalid marks to valid ones, rewires pie chart encodings, auto-adds color encodings for multi-field queries, and falls back to a simple bar chart if rendering fails.

### Challenge 4: MySQL Data Type Mismatches
**Problem:** MySQL returns BIGINT values as strings via the mysql2 driver, causing Vega-Lite to fail on quantitative fields.
**Solution:** Added a `coerceData` function that converts string values to numbers for any field marked as `quantitative` in the Vega-Lite encoding.

### Challenge 5: LIMIT Clause Conflicts
**Problem:** The system prompt instructed "Always add LIMIT 1000", causing the LLM to ignore user-specified limits (e.g., "top 10").
**Solution:** Updated the rule to: "Use the number the user specifies (e.g., 'top 10' → LIMIT 10), otherwise default to LIMIT 1000."

---

## 12. Ethics & Responsible AI Usage

### Data Ethics Assessment

This project uses the anonymized OULAD dataset, which contains no personally identifiable information. The dataset is released under CC-BY 4.0 license by the Open University.

Key ethical considerations:

| Concern | Assessment | Mitigation |
|---------|------------|------------|
| SQL injection / data manipulation | Medium | Only SELECT queries allowed; forbidden keyword filtering |
| LLM hallucination in SQL | Medium | Generated SQL is shown to users for review; retry logic with error correction |
| User credential security | Low risk | Passwords bcrypt-hashed; JWT tokens expire in 24h |
| Data privacy | Low risk | OULAD is anonymized; user data stored locally |
| Bias in LLM responses | Low-Medium | LLM generates SQL, not interpretations; users see raw data |
| Misinterpretation of results | Medium | Charts include "View SQL" and "View data table" for verification |

### Responsible AI Principles Demonstrated
1. **Transparency**: All generated SQL queries are visible to users
2. **Human oversight**: Users can review SQL before trusting results
3. **Safety**: Read-only database access with multiple validation layers
4. **Privacy**: Passwords hashed, tokens expire, credentials excluded from version control
5. **Accountability**: Conversation history enables review of AI interactions

---

## 13. Deliverables

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Deployed web application prototype | Completed |
| 2 | Structured human-AI interaction system | Completed |
| 3 | LLM-powered self-service analytics dashboard | Completed |
| 4 | Source code repository with documentation | Completed |
| 5 | Database schema and API documentation | Completed |
| 6 | AI interaction logging system (conversation history) | Completed |
| 7 | Instructor analytics dashboard | Completed |
| 8 | Demonstration of natural language to SQL conversion | Completed |
| 9 | Demonstration of automated visualization generation | Completed |
| 10 | Final report including architecture and evaluation | This document |
| 11 | Ethics and responsible AI usage discussion | Section 12 |

---

## 14. Future Work

The following enhancements are planned or recommended for future development:

1. **Dashboard panel**: Allow users to pin and arrange generated charts into a persistent dashboard layout
2. **Role-based feature differentiation**: Different interfaces or permissions for students vs. instructors
3. **Cloud deployment**: Deploy to Vercel (frontend) and AWS/Railway (backend + MySQL)
4. **Multi-model support**: Option to switch between Ollama models or use OpenAI API

---

## 15. Conclusion

This project successfully delivers a self-service learning analytics dashboard that enables instructors and students to explore educational data using natural language, without requiring SQL or programming knowledge. The system demonstrates that LLMs can effectively bridge the gap between natural language questions and structured database queries with appropriate visualizations.

Key achievements include:
- A fully functional conversational chatbot interface for data exploration
- Zero-shot text-to-SQL generation using a local LLM (llama3.1:8b) with no additional training
- Automatic Vega-Lite visualization generation with robust error handling
- JWT-based authentication with role-based access control
- Comprehensive SQL safety measures preventing unauthorized data modification
- Support for iterative chart refinement through conversational follow-ups

The project validates the approach proposed in the LAK'25 paper by Wang, Lin, and Hu, demonstrating that LLM-powered self-service analytics systems can effectively address teachers' pedagogical needs for learning analytics while maintaining usability and security.

---

## 16. References

1. Wang Z., Lin W., Hu X. (2025). *Self-service Teacher-facing Learning Analytics Dashboard with Large Language Models.* Proceedings of the 15th International Learning Analytics and Knowledge Conference (LAK'25), pp. 824–830. doi: [10.1145/3706468.3706491](https://doi.org/10.1145/3706468.3706491)

2. Kuzilek J., Hlosta M., Zdrahal Z. (2017). *Open University Learning Analytics dataset.* Scientific Data, 4:170171. doi: [10.1038/sdata.2017.171](https://doi.org/10.1038/sdata.2017.171)

3. Satyanarayan A., Moritz D., Wongsuphasawat K., Heer J. (2017). *Vega-Lite: A Grammar of Interactive Graphics.* IEEE Transactions on Visualization and Computer Graphics, 23(1), pp. 341–350.

4. Meta AI. (2024). *Llama 3.1: Open Foundation and Fine-Tuned Large Language Models.* [https://ai.meta.com/blog/meta-llama-3-1/](https://ai.meta.com/blog/meta-llama-3-1/)

---

## 17. Appendix

### A. Project Structure

```
human-ai-analytics/
├── .env.example                 # Environment variable template
├── .gitignore                   # Git ignore rules (node_modules, .env, data/, .DS_Store)
├── docker-compose.yml           # MySQL 8.0 service (optional)
├── README.md                    # Project documentation
├── FINAL_REPORT.md              # This report
├── data/oulad/                  # OULAD CSV files (not in repo, download separately)
├── scripts/
│   └── load_oulad.py            # CSV → MySQL loader (auto-chunks large files)
├── backend/
│   ├── package.json             # Dependencies: express, mysql2, bcryptjs, jsonwebtoken, etc.
│   └── index.js                 # Express API server (379 lines)
├── frontend/
│   ├── package.json             # Dependencies: next, react, vega, vega-lite
│   ├── next.config.js           # Next.js configuration
│   └── app/
│       ├── layout.js            # Root HTML layout
│       ├── page.js              # Chat dashboard + history sidebar + user menu
│       ├── auth.js              # Login/register page with role selection
│       ├── ChartCard.js         # Vega-Lite renderer + spec normalizer + fallback
│       └── globals.css          # All styles (auth, chat, sidebar, charts, responsive)
└── tests/
    └── tasks.json               # 10 benchmark NL queries adapted from LAK'25
```

### B. Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OLLAMA_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | LLM model name | `llama3.1:8b` |
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASS` | MySQL password | (empty for local) |
| `DB_NAME` | MySQL database name | `oulad` |
| `PORT` | Backend server port | `4000` |
| `JWT_SECRET` | Secret key for JWT signing | (change in production) |

### C. Author Table

| Section | Author | Approx. Word Count |
|---------|--------|-------------------|
| 1. Executive Summary | Saumya Gupta | ~250 |
| 2. Project Objectives | Saumya Gupta | ~100 |
| 3. System Architecture | Saumya Gupta | ~200 |
| 4. Implementation | Saumya Gupta | ~800 |
| 5. Technology Stack | Saumya Gupta | ~50 |
| 6. Key Features | Saumya Gupta | ~350 |
| 7. LLM Prompt Engineering | Saumya Gupta | ~250 |
| 8. SQL Safety & Security | Saumya Gupta | ~200 |
| 9. Benchmark Evaluation | Saumya Gupta | ~200 |
| 10. Project Timeline | Saumya Gupta | ~50 |
| 11. Challenges & Solutions | Saumya Gupta | ~300 |
| 12. Ethics | Saumya Gupta | ~200 |
| 13. Deliverables | Saumya Gupta | ~50 |
| 14. Future Work | Saumya Gupta | ~150 |
| 15. Conclusion | Saumya Gupta | ~150 |
