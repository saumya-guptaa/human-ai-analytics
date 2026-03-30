# Human-AI Analytics Dashboard

A natural-language-to-SQL learning analytics dashboard built on the **Open University Learning Analytics Dataset (OULAD)**. Instructors type questions in plain English; the system generates SQL queries via an LLM, executes them against MySQL, and renders interactive Vega-Lite charts.

Inspired by the LAK'25 paper on AI-assisted teacher dashboards.

## Architecture

```
User (browser)  →  Next.js frontend (:3000)
                        ↕ /api proxy
                   Express backend (:4000)
                        ↕ OpenAI API (GPT-4o-mini)
                        ↕ MySQL (:3306, OULAD data)
```

## Prerequisites

- **Docker** (for MySQL)
- **Node.js ≥ 20** (recommended via nvm)
- **Python 3** with pandas, sqlalchemy, pymysql, cryptography (for data loading)
- **OpenAI API key**

## Quick Start

### 1. Start MySQL

```bash
docker compose up -d
```

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
courses.csv, assessments.csv, studentInfo.csv,
studentRegistration.csv, studentAssessment.csv,
studentVle.csv, vle.csv
```

Then load them into MySQL:

```bash
pip3 install pandas sqlalchemy pymysql cryptography
python3 scripts/load_oulad.py
```

> **Citation:** Kuzilek J., Hlosta M., Zdrahal Z. *Open University Learning Analytics dataset.* Sci. Data 4:170171 doi: [10.1038/sdata.2017.171](https://doi.org/10.1038/sdata.2017.171) (2017). Licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY
```

### 4. Start backend

```bash
cd backend
npm install
node index.js
```

### 5. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### 6. Try a query

> Show count of students by highest_education for module AAA presentation 2013J

## Project Structure

```
├── .env.example              # Environment template
├── docker-compose.yml        # MySQL 8.0 service
├── data/oulad/               # OULAD CSV files (download separately, see above)
├── scripts/load_oulad.py     # CSV → MySQL loader
├── backend/
│   └── index.js              # Express API server
├── frontend/
│   └── app/
│       ├── layout.js         # Root layout
│       ├── page.js           # Main dashboard page
│       ├── ChartCard.js      # Vega-Lite chart renderer
│       └── globals.css       # Styles
├── tests/
│   └── tasks.json            # Benchmark NL queries (LAK'25 adapted)
└── README.md
```

## SQL Safety

- Only `SELECT` statements are allowed
- Queries are checked against a forbidden keyword list (INSERT, UPDATE, DELETE, DROP, ALTER, etc.)
- Schema introspection builds an allowlist of valid table/column names
- Results are limited to 1000 rows

## Benchmark Tasks

See `tests/tasks.json` for 10 benchmark queries adapted from the LAK'25 paper, covering:
- Learner-related (education distribution, withdrawal rates)
- Action-related (click activity, most active students)
- Content-related (VLE activity types)
- Result-related (grade distribution, average scores)
- Context-related (peak activity by week)
- Social-related (forum/collaborative activities)

## Safety Caveats

- The LLM generates SQL that is executed against your database. While safety checks are in place, always review generated SQL before trusting results in production.
- The `.env` file contains credentials — never commit it to version control.
