"use client";

import { useState, useRef, useCallback } from "react";
import "./globals.css";
import ChartCard from "./ChartCard";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState([]);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const q = question.trim();
      if (!q || loading) return;

      setError(null);
      setLoading(true);

      try {
        const backendUrl = `http://${window.location.hostname}:4000/api/query`;
        const res = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, sessionId: "default" }),
        });

        const text = await res.text();
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          setError(`Server returned invalid response: ${text.slice(0, 200)}`);
          return;
        }

        if (!res.ok) {
          setError(body.error || "Something went wrong");
          return;
        }

        setTurns((prev) => [...prev, { question: q, ...body }]);
        setQuestion("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [question, loading]
  );

  return (
    <div className="container">
      <header>
        <h1>Learning Analytics Dashboard</h1>
        <p>
          Ask questions about student data in natural language — powered by
          OULAD &amp; LLM
        </p>
      </header>

      <form className="query-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="query-input"
          type="text"
          placeholder="e.g. Show count of students by highest_education for module AAA"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button className="query-btn" type="submit" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error && <div className="error-box">{error}</div>}

      <div className="history">
        {turns.map((t, i) => (
          <div key={i} className="turn">
            <div className="turn-question">Q: {t.question}</div>

            {/* Chart */}
            <ChartCard vega={t.vega} data={t.data} />

            {/* SQL */}
            <div className="card">
              <div className="card-header">Generated SQL</div>
              <div className="card-body">
                <pre className="sql-block">{t.sql}</pre>
              </div>
            </div>

            {/* Data table */}
            {t.data && t.data.length > 0 && (
              <div className="card">
                <div className="card-header">
                  Data ({t.data.length} row{t.data.length !== 1 ? "s" : ""})
                </div>
                <div className="card-body">
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {Object.keys(t.data[0]).map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.data.slice(0, 100).map((row, ri) => (
                          <tr key={ri}>
                            {Object.values(row).map((v, ci) => (
                              <td key={ci}>{v == null ? "—" : String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
