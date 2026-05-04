"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import "./globals.css";
import ChartCard from "./ChartCard";
import AuthPage from "./auth";

const DEFAULT_SUGGESTIONS = [
  "Show distribution of students by highest_education",
  "Who are the 10 most active students by total clicks?",
  "Show grade distribution by final_result",
  "Compare total clicks per module",
  "Show a pie chart of students by final_result",
  "What is the average assessment score by module?",
  "Show the withdrawal rate by age band",
  "Show peak student activity by week",
];

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("queryHistory") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem("queryHistory", JSON.stringify(history));
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {}
    }
    setAuthReady(true);
  }, []);

  const handleLogin = (u, t) => { setUser(u); setToken(t); };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  if (!authReady) return null;
  if (!user) return <AuthPage onLogin={handleLogin} />;

  return <Dashboard user={user} token={token} onLogout={handleLogout} />;
}

function Dashboard({ user, token, onLogout }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, loading]);

  const addToHistory = (question) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.text !== question);
      const updated = [{ text: question, time: Date.now() }, ...filtered].slice(0, 50);
      saveHistory(updated);
      return updated;
    });
  };

  const MODIFICATION_PATTERNS = /\b(change|rename|modify|update|make it|switch|convert|color|axis|title|label)\b/i;

  const suggestions = (() => {
    const dataQuestions = history
      .map((h) => h.text)
      .filter((t) => !MODIFICATION_PATTERNS.test(t));
    const combined = [...dataQuestions.slice(0, 4), ...DEFAULT_SUGGESTIONS];
    return combined.filter((s, i, arr) => arr.indexOf(s) === i).slice(0, 4);
  })();

  const submitQuestion = useCallback(
    async (q) => {
      if (!q || loading) return;

      setMessages((prev) => [...prev, { role: "user", text: q }]);
      setInput("");
      addToHistory(q);
      setLoading(true);

      try {
        const backendUrl = `http://${window.location.hostname}:4000/api/query`;
        const res = await fetch(backendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question: q, sessionId: "default" }),
        });

        const text = await res.text();
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: "error", text: "Invalid response from server." },
          ]);
          return;
        }

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            { role: "error", text: body.error || "Something went wrong" },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", sql: body.sql, vega: body.vega, data: body.data },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: err.message },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading]
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      submitQuestion(input.trim());
    },
    [input, submitQuestion]
  );

  const startNewChat = () => {
    setMessages([]);
  };

  const removeHistoryItem = (text) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.text !== text);
      saveHistory(updated);
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2>History</h2>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            &times;
          </button>
        </div>

        <button className="new-chat-btn" onClick={() => { startNewChat(); setSidebarOpen(false); }}>
          + New Chat
        </button>

        {history.length === 0 ? (
          <p className="sidebar-empty">No questions yet. Start asking!</p>
        ) : (
          <>
            <div className="history-list">
              {history.map((h, i) => (
                <div key={i} className="history-item">
                  <button
                    className="history-text"
                    onClick={() => {
                      setInput(h.text);
                      setSidebarOpen(false);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    title={h.text}
                  >
                    {h.text}
                  </button>
                  <button
                    className="history-remove"
                    onClick={() => removeHistoryItem(h.text)}
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button className="clear-history-btn" onClick={clearHistory}>
              Clear all history
            </button>
          </>
        )}
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main chat area */}
      <div className="chat-layout">
        <div className="chat-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} title="History">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div>
            <h1>Learning Analytics Dashboard</h1>
            <p>Ask questions about student data in natural language</p>
          </div>
          <UserMenu user={user} onLogout={onLogout} />
        </div>

        <div className="chat-messages-wrapper">
        <div className="chat-messages">
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">&#128300;</div>
              <h2>What would you like to explore?</h2>
              <p>Try asking about students, assessments, or engagement patterns.</p>
              <div className="suggestion-chips">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="chip"
                    onClick={() => submitQuestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="msg msg-user">
                  <div className="bubble bubble-user">{msg.text}</div>
                </div>
              );
            }

            if (msg.role === "error") {
              return (
                <div key={i} className="msg msg-bot">
                  <div className="bubble bubble-error">{msg.text}</div>
                </div>
              );
            }

            return (
              <div key={i} className="msg msg-bot">
                <div className="bubble bubble-bot">
                  <ChartCard vega={msg.vega} data={msg.data} />

                  {msg.data && msg.data.length > 0 && (
                    <p className="data-summary">
                      {msg.data.length} row{msg.data.length !== 1 ? "s" : ""} returned
                    </p>
                  )}

                  <div className="bot-actions">
                    <Details summary="View SQL">
                      <pre className="sql-block">{msg.sql}</pre>
                    </Details>

                    {msg.data && msg.data.length > 0 && (
                      <Details summary="View data table">
                        <div className="data-table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                {Object.keys(msg.data[0]).map((col) => (
                                  <th key={col}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.data.slice(0, 100).map((row, ri) => (
                                <tr key={ri}>
                                  {Object.values(row).map((v, ci) => (
                                    <td key={ci}>{v == null ? "\u2014" : String(v)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="msg msg-bot">
              <div className="bubble bubble-bot typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        </div>

        <div className="chat-input-wrapper">
        <div className="chat-input-bar">
          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder="Ask about student data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button className="send-btn" type="submit" disabled={loading || !input.trim()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="user-info" ref={menuRef}>
      <span className="user-badge" onClick={() => setOpen(!open)} title={user.email}>
        {user.name?.charAt(0).toUpperCase()}
      </span>
      {open && (
        <div className="user-menu">
          <span className="user-name">{user.name}</span>
          <span className="user-role">{user.role}</span>
          <button className="logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function Details({ summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="details-block">
      <button className="details-toggle" onClick={() => setOpen(!open)}>
        <span className={`details-arrow ${open ? "open" : ""}`}>&#9654;</span>
        {summary}
      </button>
      {open && <div className="details-content">{children}</div>}
    </div>
  );
}
