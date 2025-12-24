import React, { useState } from "react";
import TransientPlot from "../analog/ui/TransientPlot";

export default function AnalogResultsPanel({ result, onClose }) {
  const { ok, warnings, errors, netlist, results, meters } = result || {};
  const [selectedTraceNames, setSelectedTraceNames] = useState(null); // null = use defaults

  const tranData = (() => {
    if (results?.analysis !== "tran" || !results?.tran) return null;

    // Preferred backend shape: { x, series: [{name,y}] }
    if (Array.isArray(results.tran.series) && Array.isArray(results.tran.x)) {
      return { x: results.tran.x, series: results.tran.series };
    }

    // Back-compat backend shape: { time, series: {name: []} }
    if (Array.isArray(results.tran.time) && results.tran.series && typeof results.tran.series === "object") {
      const series = Object.entries(results.tran.series).map(([name, y]) => ({ name, y }));
      return { x: results.tran.time, series };
    }

    // Back-compat fallback: { time, seriesMap: {name: []} }
    if (
      Array.isArray(results.tran.time) &&
      results.tran.seriesMap &&
      typeof results.tran.seriesMap === "object"
    ) {
      const series = Object.entries(results.tran.seriesMap).map(([name, y]) => ({ name, y }));
      return { x: results.tran.time, series };
    }

    return null;
  })();

  const availableTraceNames = tranData?.series ? tranData.series.map((s) => s.name).filter(Boolean) : [];

  const defaultSelectedTraceNames = (() => {
    const volts = availableTraceNames.filter((n) => String(n).toLowerCase().startsWith("v("));
    const currents = availableTraceNames.filter((n) => {
      const s = String(n).toLowerCase();
      return s.startsWith("i(") || (s.startsWith("@") && s.endsWith("[i]"));
    });
    return volts.length > 0 ? [...volts, ...currents.slice(0, 2)] : availableTraceNames.slice(0, 6);
  })();

  const effectiveSelectedTraceNames = selectedTraceNames ?? defaultSelectedTraceNames;

  const toggleTrace = (name) => {
    setSelectedTraceNames((prev) => {
      const base = prev ?? defaultSelectedTraceNames;
      return base.includes(name) ? base.filter((n) => n !== name) : [...base, name];
    });
  };

  if (!result) return null;

  return (
    <div className="absolute top-16 right-4 w-96 max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-950">
        <h3 className="font-semibold text-zinc-200">Analog Simulation</h3>
        <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
      </div>

      <div className="p-4 overflow-auto flex-1 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          Status:
          <span className={ok ? "text-green-400" : "text-red-400 font-bold"}>
            {ok ? "OK" : "Failed"}
          </span>
        </div>

        {/* Errors */}
        {errors && errors.length > 0 && (
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-200 space-y-1">
            <div className="font-semibold text-red-400">Errors:</div>
            {errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg text-xs text-yellow-200 space-y-1">
            <div className="font-semibold text-yellow-400">Warnings:</div>
            {warnings.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        {/* Results: OP / DC */}
        {results?.analysis === "op" && results.dc && (
          <div className="space-y-4">
            {/* Meters */}
            {(meters?.voltmeters?.length > 0 || meters?.ammeters?.length > 0) && (
              <div>
                <div className="font-semibold text-neutral-300 text-xs mb-2">Meters</div>

                {meters?.voltmeters?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-neutral-400 mb-1">Voltmeters</div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-700 text-neutral-500">
                          <th className="py-1">Ref</th>
                          <th className="py-1">V (V)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meters.voltmeters.map(({ ref, voltage }, i) => (
                          <tr key={`${ref || "VM"}_${i}`} className="border-b border-zinc-800 font-mono text-neutral-300">
                            <td className="py-1">{ref || "VM"}</td>
                            <td className="py-1">{typeof voltage === "number" ? voltage.toFixed(4) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {meters?.ammeters?.length > 0 && (
                  <div>
                    <div className="text-xs text-neutral-400 mb-1">Ammeters</div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-700 text-neutral-500">
                          <th className="py-1">Ref</th>
                          <th className="py-1">I (A)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meters.ammeters.map(({ ref, current }, i) => (
                          <tr key={`${ref || "VA"}_${i}`} className="border-b border-zinc-800 font-mono text-neutral-300">
                            <td className="py-1">{ref || "VA"}</td>
                            <td className="py-1">{typeof current === "number" ? current.toExponential(4) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Node Voltages */}
            {results.dc.nodeVoltages && results.dc.nodeVoltages.length > 0 && (
              <div>
                <div className="font-semibold text-neutral-300 text-xs mb-2">Node Voltages (DC)</div>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-700 text-neutral-500">
                      <th className="py-1">Node</th>
                      <th className="py-1">Voltage (V)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.dc.nodeVoltages.map(({ node, voltage }) => (
                      <tr key={node} className="border-b border-zinc-800 font-mono text-neutral-300">
                        <td className="py-1">{node}</td>
                        <td className="py-1">{typeof voltage === 'number' ? voltage.toFixed(4) : voltage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Element Currents */}
            {results.dc.elementCurrents && results.dc.elementCurrents.length > 0 && (
              <div>
                <div className="font-semibold text-neutral-300 text-xs mb-2">Element Currents (DC)</div>
                <div className="text-[10px] text-neutral-500 mb-1">
                  (Positive = current entering first pin)
                </div>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-700 text-neutral-500">
                      <th className="py-1">Element</th>
                      <th className="py-1">Current (A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.dc.elementCurrents.map(({ element, current }) => (
                      <tr key={element} className="border-b border-zinc-800 font-mono text-neutral-300">
                        <td className="py-1">{element}</td>
                        <td className="py-1">{typeof current === 'number' ? current.toExponential(4) : current}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Results: TRAN */}
        {results?.analysis === "tran" && results.tran && (
          <div>
            {(meters?.voltmeters?.length > 0 || meters?.ammeters?.length > 0) && (
              <div className="mb-4">
                <div className="font-semibold text-neutral-300 text-xs mb-2">Meters (Last Sample)</div>
                {meters?.voltmeters?.length > 0 && (
                  <div className="text-xs text-neutral-400 mb-1">
                    Voltmeters:{" "}
                    {meters.voltmeters
                      .map((m) => `${m.ref || "VM"}=${typeof m.voltage === "number" ? m.voltage.toFixed(4) : "—"}V`)
                      .join("  ")}
                  </div>
                )}
                {meters?.ammeters?.length > 0 && (
                  <div className="text-xs text-neutral-400">
                    Ammeters:{" "}
                    {meters.ammeters
                      .map((m) => `${m.ref || "VA"}=${typeof m.current === "number" ? m.current.toExponential(3) : "—"}A`)
                      .join("  ")}
                  </div>
                )}
              </div>
            )}
            <div className="font-semibold text-neutral-300 text-xs mb-2">Transient Analysis (Preview)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-700 text-neutral-500">
                    <th className="py-1 px-2">Time (s)</th>
                    {(() => {
                      const names = Array.isArray(results.tran.series)
                        ? results.tran.series.map((s) => s.name)
                        : Object.keys(results.tran.series || {});
                      return names.map((sig) => (
                        <th key={sig} className="py-1 px-2">
                          {sig}
                        </th>
                      ));
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {(results.tran.time || results.tran.x || []).slice(0, 20).map((t, i) => (
                    <tr key={i} className="border-b border-zinc-800 font-mono text-neutral-300">
                      <td className="py-1 px-2">{t.toExponential(3)}</td>
                      {(() => {
                        if (Array.isArray(results.tran.series)) {
                          return results.tran.series.map((s) => (
                            <td key={s.name} className="py-1 px-2">
                              {s.y?.[i]?.toExponential?.(3)}
                            </td>
                          ));
                        }
                        const keys = Object.keys(results.tran.series || {});
                        return keys.map((sig) => (
                          <td key={sig} className="py-1 px-2">
                            {results.tran.series[sig][i]?.toExponential(3)}
                          </td>
                        ));
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
              {((results.tran.time || results.tran.x || []).length > 20) && (
                <div className="text-xs text-neutral-500 mt-1 italic">
                  ... {(results.tran.time || results.tran.x || []).length - 20} more rows
                </div>
              )}
            </div>

            <details className="mt-4 text-xs text-neutral-400" open>
              <summary className="cursor-pointer hover:text-neutral-300">Transient Plot</summary>
              {!tranData ? (
                <div className="mt-2 text-neutral-500">Run transient analysis to see plot.</div>
              ) : (
                <div className="mt-2 space-y-3">
                  <div className="max-h-28 overflow-auto border border-zinc-800 rounded p-2 bg-black/30">
                    <div className="text-[11px] text-neutral-500 mb-1">Traces</div>
                    <div className="grid grid-cols-1 gap-1">
                      {availableTraceNames.map((name) => (
                        <label key={name} className="flex items-center gap-2 text-[11px]">
                          <input
                            type="checkbox"
                            checked={effectiveSelectedTraceNames.includes(name)}
                            onChange={() => toggleTrace(name)}
                          />
                          <span className="font-mono text-zinc-200">{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <TransientPlot x={tranData.x} series={tranData.series} selectedNames={effectiveSelectedTraceNames} />
                </div>
              )}
            </details>
          </div>
        )}

        {/* Netlist Preview (Collapsible) */}
        <details className="text-xs text-neutral-400">
          <summary className="cursor-pointer hover:text-neutral-300">Show Netlist</summary>
          <pre className="mt-2 p-2 bg-black rounded border border-zinc-800 overflow-x-auto text-[10px] leading-tight">
            {netlist}
          </pre>
        </details>

        {results?.raw && (
          <details className="text-xs text-neutral-400">
            <summary className="cursor-pointer hover:text-neutral-300">Show Raw Output</summary>
            <pre className="mt-2 p-2 bg-black rounded border border-zinc-800 overflow-x-auto text-[10px] leading-tight">
              {results.raw}
            </pre>
          </details>
        )}

      </div>
    </div>
  );
}
