"use client";

import { useEffect, useRef, memo } from "react";

const VALID_MARKS = new Set([
  "bar", "line", "area", "point", "circle", "square", "tick",
  "rect", "rule", "text", "arc", "boxplot", "trail", "geoshape",
]);

function coerceData(rows, encoding) {
  const quantFields = Object.values(encoding || {})
    .filter((e) => e?.type === "quantitative" && e?.field)
    .map((e) => e.field);
  if (quantFields.length === 0) return rows;
  return rows.map((row) => {
    const out = { ...row };
    for (const f of quantFields) {
      if (f in out && typeof out[f] === "string") {
        const n = Number(out[f]);
        if (!isNaN(n)) out[f] = n;
      }
    }
    return out;
  });
}

function normalizeSpec(spec) {
  let mark = spec.mark;
  const markType = typeof mark === "string" ? mark : mark?.type;

  if (markType && !VALID_MARKS.has(markType)) {
    const lower = markType.toLowerCase();
    if (lower.includes("pie") || lower.includes("donut")) mark = { type: "arc" };
    else if (lower.includes("bar")) mark = "bar";
    else if (lower.includes("line")) mark = "line";
    else if (lower.includes("area")) mark = "area";
    else mark = "bar";
    spec.mark = mark;
  }

  if (typeof spec.mark === "object" && spec.mark && !spec.mark.type) {
    spec.mark = "bar";
  }

  const resolvedMark = typeof spec.mark === "string" ? spec.mark : spec.mark?.type;
  const enc = spec.encoding || {};

  if (resolvedMark === "arc") {
    const catField = enc.x?.field || enc.color?.field;
    const numField = enc.y?.field || enc.theta?.field;
    spec.encoding = {
      theta: { field: numField, type: "quantitative" },
      color: { field: catField, type: "nominal" },
    };
    spec._isArc = true;
    return spec;
  }

  const hasColorField = enc.color?.field;
  const dataFields = Object.values(enc)
    .map((e) => e?.field)
    .filter(Boolean);

  if (!hasColorField && dataFields.length >= 3 && enc.x?.field && enc.y?.field) {
    const thirdField = dataFields.find((f) => f !== enc.x.field && f !== enc.y.field);
    if (thirdField) {
      enc.color = { field: thirdField, type: "nominal" };
    }
  }

  return spec;
}

function ChartCard({ vega: spec, data }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!spec || !data || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      const vegaModule = await import("vega");
      const vegaLiteModule = await import("vega-lite");

      if (cancelled) return;

      async function tryRender(vegaSpec, chartData) {
        const compiled = vegaLiteModule.compile(vegaSpec);
        const view = new vegaModule.View(
          vegaModule.parse(compiled.spec),
          { renderer: "svg", container: containerRef.current, hover: true }
        );
        await view.runAsync();
      }

      try {
        const normalized = normalizeSpec(JSON.parse(JSON.stringify(spec)));
        const isArc = normalized._isArc;
        delete normalized._isArc;

        const coerced = coerceData(data, normalized.encoding);

        const fullSpec = {
          ...normalized,
          data: { values: coerced },
          ...(isArc
            ? { width: 350, height: 350 }
            : { width: 520, height: 300, autosize: { type: "fit", contains: "padding" } }),
        };
        delete fullSpec.data?.name;

        try {
          await tryRender(fullSpec, coerced);
        } catch (firstErr) {
          // Fallback: force mark to "bar" with only x/y encoding
          console.warn("Primary render failed, trying fallback:", firstErr.message);
          if (containerRef.current) containerRef.current.innerHTML = "";

          const enc = normalized.encoding || {};
          const xField = enc.x?.field;
          const yField = enc.y?.field;

          if (xField && yField) {
            const fallback = {
              $schema: "https://vega.github.io/schema/vega-lite/v5.json",
              title: normalized.title || "Chart",
              mark: "bar",
              data: { values: coerced },
              width: 520,
              height: 300,
              autosize: { type: "fit", contains: "padding" },
              encoding: {
                x: enc.x,
                y: enc.y,
                ...(enc.color?.value ? { color: enc.color } : {}),
                ...(enc.color?.field ? { color: enc.color } : {}),
              },
            };
            await tryRender(fallback, coerced);
          } else {
            throw firstErr;
          }
        }
      } catch (err) {
        console.error("Vega render error:", err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<p style="color: #ef4444; padding: 0.5rem 0;">Chart render error: ${err.message}</p>`;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [spec, data]);

  if (!spec) return null;

  return <div className="chart-container" ref={containerRef} />;
}

export default memo(ChartCard);
