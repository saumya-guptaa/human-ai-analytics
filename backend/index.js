require("dotenv").config({ path: "../.env" });
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

let schemaDescription = "";
let allowedIdentifiers = new Set();

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

  schemaDescription = Object.entries(grouped)
    .map(([t, cols]) => `${t}: ${cols.join(", ")}`)
    .join("\n");

  console.log("Schema loaded:\n" + schemaDescription);
}

// ---------------------------------------------------------------------------
// SQL safety
// ---------------------------------------------------------------------------
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|CALL|SET)\b/i;

function validateSQL(sql) {
  const trimmed = sql.trim().replace(/;+$/, "");
  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    throw new Error("Only SELECT queries are allowed.");
  }
  if (FORBIDDEN.test(trimmed)) {
    throw new Error("Query contains forbidden keywords.");
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// System prompt with few-shot examples and explicit table relationships
// ---------------------------------------------------------------------------
function buildSystemPrompt() {
  return `You are a teacher-facing data analyst. You help instructors explore student data in a MySQL database.

DATABASE SCHEMA:
${schemaDescription}

TABLE RELATIONSHIPS:
- studentInfo has: code_module, code_presentation, id_student, gender, region, highest_education, imd_band, age_band, num_of_prev_attempts, studied_credits, disability, final_result
- studentAssessment has: id_assessment, id_student, date_submitted, is_banked, score
- assessments has: code_module, code_presentation, id_assessment, assessment_type, date, weight
- studentVle has: code_module, code_presentation, id_student, id_site, date, sum_click
- vle has: id_site, code_module, code_presentation, activity_type, week_from, week_to
- studentRegistration has: code_module, code_presentation, id_student, date_registration, date_unregistration
- courses has: code_module, code_presentation, module_presentation_length
- JOIN studentAssessment to assessments ON id_assessment
- JOIN studentVle to vle ON id_site, code_module, code_presentation
- JOIN any student table to courses ON code_module, code_presentation

CRITICAL RULES:
- final_result and gender and highest_education are ONLY in studentInfo (NOT in studentRegistration or other tables)
- date columns are relative day numbers (not calendar dates)
- final_result values: 'Pass', 'Fail', 'Withdrawn', 'Distinction'
- Always add LIMIT 1000
- Return ONLY a JSON object, no text before or after

OUTPUT FORMAT — return exactly this structure as valid JSON:
{"sql": "SELECT ...", "vega": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "title": "...", "mark": "bar", "encoding": {"x": {"field": "...", "type": "nominal"}, "y": {"field": "...", "type": "quantitative"}}}}

EXAMPLES:

User: Show count of students by highest_education
{"sql": "SELECT highest_education, COUNT(*) AS student_count FROM studentInfo GROUP BY highest_education LIMIT 1000", "vega": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "title": "Students by Highest Education", "mark": "bar", "encoding": {"x": {"field": "highest_education", "type": "nominal"}, "y": {"field": "student_count", "type": "quantitative"}}}}

User: Show a pie chart of students by final_result
{"sql": "SELECT final_result, COUNT(*) AS student_count FROM studentInfo GROUP BY final_result LIMIT 1000", "vega": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "title": "Students by Final Result", "mark": {"type": "arc"}, "encoding": {"theta": {"field": "student_count", "type": "quantitative"}, "color": {"field": "final_result", "type": "nominal"}}}}

User: Show count of students by final_result stacked by gender
{"sql": "SELECT final_result, gender, COUNT(*) AS student_count FROM studentInfo GROUP BY final_result, gender LIMIT 1000", "vega": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "title": "Students by Final Result and Gender", "mark": "bar", "encoding": {"x": {"field": "final_result", "type": "nominal"}, "y": {"field": "student_count", "type": "quantitative", "stack": true}, "color": {"field": "gender", "type": "nominal"}}}}

User: Show total clicks per week for module BBB presentation 2013J as a line chart
{"sql": "SELECT FLOOR(date / 7) AS week, SUM(sum_click) AS total_clicks FROM studentVle WHERE code_module = 'BBB' AND code_presentation = '2013J' GROUP BY week ORDER BY week LIMIT 1000", "vega": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "title": "Weekly Clicks for BBB 2013J", "mark": "line", "encoding": {"x": {"field": "week", "type": "quantitative"}, "y": {"field": "total_clicks", "type": "quantitative"}}}}

Now answer the user's question. Return ONLY the JSON object.`;
}

// ---------------------------------------------------------------------------
// Conversation history
// ---------------------------------------------------------------------------
const MAX_TURNS = 6;
const sessions = new Map();

function getHistory(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId);
}

function addTurn(sessionId, role, content) {
  const hist = getHistory(sessionId);
  hist.push({ role, content });
  if (hist.length > MAX_TURNS * 2) hist.splice(0, 2);
}

// ---------------------------------------------------------------------------
// Call Ollama
// ---------------------------------------------------------------------------
async function callLLM(messages) {
  const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
      messages,
      stream: false,
      options: { temperature: 0 },
    }),
  });

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text();
    throw new Error(`Ollama error (${ollamaRes.status}): ${errText}`);
  }

  const body = await ollamaRes.json();
  return body.message.content.trim();
}

// ---------------------------------------------------------------------------
// Extract JSON from LLM response (handles markdown fences, leading text)
// ---------------------------------------------------------------------------
function extractJSON(raw) {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Main query endpoint with retry logic
// ---------------------------------------------------------------------------
const MAX_RETRIES = 2;

app.post("/api/query", async (req, res) => {
  const { question, sessionId = "default" } = req.body;
  if (!question) return res.status(400).json({ error: "question is required" });

  try {
    addTurn(sessionId, "user", question);
    const history = getHistory(sessionId);

    const baseMessages = [
      { role: "system", content: buildSystemPrompt() },
      ...history,
    ];

    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let messages = [...baseMessages];

      if (attempt > 0 && lastError) {
        messages.push({
          role: "user",
          content: `The previous response caused an error: "${lastError}". Please fix the SQL and return valid JSON only. Remember: final_result, gender, highest_education are ONLY in the studentInfo table.`,
        });
      }

      let raw;
      try {
        raw = await callLLM(messages);
      } catch (err) {
        lastError = err.message;
        continue;
      }

      let parsed;
      try {
        parsed = extractJSON(raw);
      } catch {
        lastError = "Invalid JSON returned";
        console.log(`Attempt ${attempt + 1}: invalid JSON -`, raw.slice(0, 200));
        continue;
      }

      const { sql, vega } = parsed;
      if (!sql || !vega) {
        lastError = "Response missing sql or vega keys";
        continue;
      }

      let safeSql;
      try {
        safeSql = validateSQL(sql);
      } catch (err) {
        lastError = err.message;
        continue;
      }

      let rows;
      try {
        [rows] = await pool.query(safeSql);
      } catch (err) {
        lastError = err.message;
        console.log(`Attempt ${attempt + 1}: SQL error - ${err.message}`);
        continue;
      }

      addTurn(sessionId, "assistant", JSON.stringify(parsed));
      return res.json({ sql: safeSql, vega, data: rows });
    }

    return res.status(500).json({
      error: `Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`,
    });
  } catch (err) {
    console.error("Query error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", schema: !!schemaDescription });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.get("/api/schema", (_req, res) => {
  res.json({ schema: schemaDescription });
});

const PORT = process.env.PORT || 4000;
loadSchema()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`Backend listening on 0.0.0.0:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to load schema:", err);
    process.exit(1);
  });
