# Human-AI Analytics Dashboard

A self-service learning analytics dashboard that lets instructors and students explore educational data using **natural language**. The system translates plain-English questions into SQL queries via an LLM, executes them against MySQL, and renders interactive Vega-Lite charts — all through a conversational chatbot interface.

Built on the **Open University Learning Analytics Dataset (OULAD)** and inspired by the LAK'25 paper:

> Wang Z., Lin W., Hu X. *Self-service Teacher-facing Learning Analytics Dashboard with Large Language Models.* Proceedings of the 15th International Learning Analytics and Knowledge Conference (LAK'25), pp. 824–830. doi: [10.1145/3706468.3706491](https://dl.acm.org/doi/10.1145/3706468.3706491#sec-4)

## Features

- **Natural language to SQL** — Ask questions in plain English; the LLM generates and executes SQL
- **Auto-generated visualizations** — Bar charts, line charts, pie charts, area charts via Vega-Lite
- **Conversational interaction** — Follow-up questions, chart modifications ("change color to orange", "make it a line chart")
- **JWT authentication** — Secure login/register with role-based access (student / instructor)
- **Query history** — Sidebar with persistent question history and smart suggestion chips
- **SQL safety** — Only SELECT queries allowed; forbidden keyword filtering; row limits
- **Chart normalization** — Automatic fix-up of invalid LLM-generated Vega-Lite specs

## Architecture

```
Browser → Next.js frontend (:3000)
              ↕
         Express backend (:4000)
           ├── JWT authentication (bcrypt + jsonwebtoken)
           ├── Ollama LLM (:11434) — NL → SQL + Vega-Lite spec
           └── MySQL (:3306) — OULAD data + users table
```

## Prerequisites

- **Node.js ≥ 20** (recommended via nvm)
- **MySQL 8.0** (local install or via Docker)
- **Ollama** with `llama3.1:8b` model (for LLM inference)
- **Python 3** with pandas, sqlalchemy, pymysql, cryptography (for data loading)

## Quick Start

### 1. Start MySQL

If using Docker:

```bash
docker compose up -d
```

Or use an existing local MySQL instance.

### 2. Download & load OULAD data

The dataset is **not included** in this repository due to its size (~443 MB). Download it from the official source:

1. Go to the [Open University Learning Analytics Dataset](https://analyse.kmi.open.ac.uk/open-dataset) page
2. Click **"Download dataset"** to get the zip file
3. Extract the CSV files into the `data/oulad/` directory:

```bash
mkdir -p data/oulad
unzip /path/to/downloaded/dataset.zip -d data/oulad/
```

You should end up with these 7 files inside `data/oulad/`:

```
courses.csv          (22 rows)
assessments.csv      (206 rows)
vle.csv              (6,364 rows)
studentInfo.csv      (32,593 rows)
studentRegistration.csv  (32,593 rows)
studentAssessment.csv    (173,912 rows)
studentVle.csv       (10,655,281 rows)
```

Then load them into MySQL:

```bash
pip3 install pandas sqlalchemy pymysql cryptography
python3 scripts/load_oulad.py
```

The loader automatically chunks large files (like `studentVle.csv`) to avoid memory issues.

> **Citation:** Kuzilek J., Hlosta M., Zdrahal Z. *Open University Learning Analytics dataset.* Sci. Data 4:170171 doi: [10.1038/sdata.2017.171](https://doi.org/10.1038/sdata.2017.171) (2017). Licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

### 3. Start Ollama

```bash
ollama pull llama3.1:8b
ollama serve
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=oulad
PORT=4000
JWT_SECRET=your-secret-key-here
```

### 5. Start backend

```bash
cd backend
npm install
node index.js
```

The backend will auto-create the `users` table on first startup.

### 6. Start frontend

```bash
cd frontend
npm install
npm run dev
```

### 7. Open the app

Go to **http://localhost:3000**, register an account (choose student or instructor role), and start asking questions.

**Example queries to try:**

- "Show distribution of students by highest_education"
- "Who are the 10 most active students by total clicks?"
- "Show a pie chart of students by final_result"
- "Compare total clicks per module"
- "Show peak student activity by week for module BBB 2013J"

## Project Structure

```
├── .env.example                 # Environment variable template
├── .gitignore                   # Git ignore rules
├── docker-compose.yml           # MySQL 8.0 service (optional)
├── data/oulad/                  # OULAD CSV files (download separately)
├── scripts/
│   └── load_oulad.py            # CSV → MySQL loader (auto-chunks large files)
├── backend/
│   ├── package.json             # Backend dependencies
│   └── index.js                 # Express API server
│                                  ├── JWT auth (register/login/middleware)
│                                  ├── Ollama LLM integration
│                                  ├── SQL generation & safety validation
│                                  └── Conversation history management
├── frontend/
│   ├── package.json             # Frontend dependencies
│   ├── next.config.js           # Next.js configuration
│   └── app/
│       ├── layout.js            # Root layout
│       ├── page.js              # Chat dashboard + history sidebar
│       ├── auth.js              # Login/register page
│       ├── ChartCard.js         # Vega-Lite chart renderer + spec normalizer
│       └── globals.css          # Styles
├── tests/
│   └── tasks.json               # 10 benchmark NL queries (LAK'25 adapted)
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account (name, email, password, role) |
| POST | `/api/auth/login` | No | Login, returns JWT token |
| GET | `/api/auth/me` | Yes | Get current user from token |
| POST | `/api/query` | Yes | Submit NL question, returns SQL + Vega spec + data |
| GET | `/api/health` | No | Health check (DB connectivity) |
| GET | `/api/schema` | No | Returns database schema description |

## SQL Safety

- Only `SELECT` statements are allowed
- Queries are checked against a forbidden keyword list (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, etc.)
- Schema introspection provides context to the LLM
- Results are limited (user-specified or default 1000 rows)
- Retry logic with error correction (up to 3 attempts)

## Benchmark Tasks

See `tests/tasks.json` for 10 benchmark queries adapted from the LAK'25 paper, covering:

| Category | Example |
|----------|---------|
| Learner-related | Distribution by highest education, withdrawal rates by age |
| Action-related | Most active students, total clicks per module |
| Content-related | VLE activity type distribution |
| Result-related | Grade distribution, average scores by module |
| Context-related | Peak activity by week |
| Social-related | Forum and collaborative activity types |

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Next.js 14 |
| Backend | Node.js + Express |
| Database | MySQL 8.0 |
| LLM | Ollama (llama3.1:8b) |
| Visualization | Vega-Lite |
| Authentication | JWT (bcryptjs + jsonwebtoken) |
| Version Control | GitHub |

## Security Caveats

- The LLM generates SQL that is executed against your database. While safety checks are in place, always review generated SQL before trusting results in production.
- The `.env` file contains credentials and secrets — never commit it to version control.
- JWT tokens expire after 24 hours.
- Change the default `JWT_SECRET` before any deployment.
