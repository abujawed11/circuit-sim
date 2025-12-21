import React from "react";

export default function AnalogResultsPanel({ result, onClose }) {
  if (!result) return null;

  const { ok, warnings, errors, netlist, results } = result;

  return (
    <div className="absolute top-16 right-4 w-96 max-h-[80vh] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-950">
        <h3 className="font-semibold text-neutral-200">Analog Simulation</h3>
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
            {/* Node Voltages */}
            {results.dc.nodeVoltages && results.dc.nodeVoltages.length > 0 && (
              <div>
                <div className="font-semibold text-neutral-300 text-xs mb-2">Node Voltages (DC)</div>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-700 text-neutral-500">
                      <th className="py-1">Node</th>
                      <th className="py-1">Voltage (V)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.dc.nodeVoltages.map(({ node, voltage }) => (
                      <tr key={node} className="border-b border-neutral-800 font-mono text-neutral-300">
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
                    <tr className="border-b border-neutral-700 text-neutral-500">
                      <th className="py-1">Element</th>
                      <th className="py-1">Current (A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.dc.elementCurrents.map(({ element, current }) => (
                      <tr key={element} className="border-b border-neutral-800 font-mono text-neutral-300">
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
            <div className="font-semibold text-neutral-300 text-xs mb-2">Transient Analysis (Preview)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-neutral-700 text-neutral-500">
                    <th className="py-1 px-2">Time (s)</th>
                    {Object.keys(results.tran.series).map(sig => (
                        <th key={sig} className="py-1 px-2">{sig}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.tran.time.slice(0, 20).map((t, i) => (
                    <tr key={i} className="border-b border-neutral-800 font-mono text-neutral-300">
                      <td className="py-1 px-2">{t.toExponential(3)}</td>
                      {Object.keys(results.tran.series).map(sig => (
                          <td key={sig} className="py-1 px-2">
                              {results.tran.series[sig][i]?.toExponential(3)}
                          </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.tran.time.length > 20 && (
                  <div className="text-xs text-neutral-500 mt-1 italic">
                      ... {results.tran.time.length - 20} more rows
                  </div>
              )}
            </div>
          </div>
        )}

        {/* Netlist Preview (Collapsible) */}
        <details className="text-xs text-neutral-400">
          <summary className="cursor-pointer hover:text-neutral-300">Show Netlist</summary>
          <pre className="mt-2 p-2 bg-black rounded border border-neutral-800 overflow-x-auto text-[10px] leading-tight">
            {netlist}
          </pre>
        </details>
        
        {results?.raw && (
             <details className="text-xs text-neutral-400">
              <summary className="cursor-pointer hover:text-neutral-300">Show Raw Output</summary>
              <pre className="mt-2 p-2 bg-black rounded border border-neutral-800 overflow-x-auto text-[10px] leading-tight">
                {results.raw}
              </pre>
            </details>
        )}

      </div>
    </div>
  );
}
