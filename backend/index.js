require("dotenv").config({ path: "../.env" });
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

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

// ---------------------------------------------------------------------------
// Auth: users table + routes
// ---------------------------------------------------------------------------
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

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  const userRole = (role === "instructor") ? "instructor" : "student";
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), hash, userRole]
    );
    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: userRole };
    res.status(201).json({ token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

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
  return `You generate MySQL queries and Vega-Lite charts for a learning analytics database.

SCHEMA:
${schemaDescription}

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

Return ONLY the JSON object for the user's question.`;
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
      format: "json",
      options: { temperature: 0, num_predict: 1024 },
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

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to fix truncated JSON by closing open braces/brackets
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
    // Close any dangling strings, then brackets/braces
    let repaired = cleaned;
    if (inString) repaired += '"';
    repaired += "]".repeat(Math.max(0, openBrackets));
    repaired += "}".repeat(Math.max(0, open));
    return JSON.parse(repaired);
  }
}

// ---------------------------------------------------------------------------
// Main query endpoint with retry logic
// ---------------------------------------------------------------------------
const MAX_RETRIES = 2;

app.post("/api/query", authMiddleware, async (req, res) => {
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
Promise.all([loadSchema(), initUsersTable()])
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`Backend listening on 0.0.0.0:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to load schema:", err);
    process.exit(1);
  });
