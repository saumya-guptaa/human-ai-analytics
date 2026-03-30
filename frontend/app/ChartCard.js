"use client";

import { useEffect, useRef, memo } from "react";

function ChartCard({ vega: spec, data }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!spec || !data || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      const vegaModule = await import("vega");
      const vegaLiteModule = await import("vega-lite");

      if (cancelled) return;

      try {
        const fullSpec = {
          ...spec,
          data: { values: data },
          width: "container",
          autosize: { type: "fit", contains: "padding" },
        };
        delete fullSpec.data?.name;

        const compiled = vegaLiteModule.compile(fullSpec);
        const view = new vegaModule.View(
          vegaModule.parse(compiled.spec),
          {
            renderer: "svg",
            container: containerRef.current,
            hover: true,
          }
        );
        await view.runAsync();
      } catch (err) {
        console.error("Vega render error:", err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<p style="color: #ef4444; padding: 1rem;">Chart render error: ${err.message}</p>`;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [spec, data]);

  if (!spec) return null;

  return (
    <div className="card">
      <div className="card-header">Chart</div>
      <div className="chart-container" ref={containerRef} />
    </div>
  );
}

export default memo(ChartCard);
