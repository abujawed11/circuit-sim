import React from "react";
import { KIND } from "../model/types";
import { ANALOG_DOMAIN, ANALOG_KIND } from "../analog/model/analogTypes";

export default function PropertiesPanel({ selection, circuit, updateComponent, onClose }) {
  if (selection.compIds.length !== 1) {
    return (
      <div className="w-64 border-l border-neutral-800 bg-neutral-950/60 p-4 text-neutral-500 text-sm">
        Select a single component to edit properties.
      </div>
    );
  }

  const compId = selection.compIds[0];
  const comp = circuit.components.find((c) => c.id === compId);

  if (!comp) return null;

  const handleChange = (field, value, isState = false) => {
    const nextComp = structuredClone(comp);

    if (isState) {
      if (!nextComp.state) nextComp.state = {};
      nextComp.state[field] = value;
    } else {
      if (!nextComp.props) nextComp.props = {};
      nextComp.props[field] = value;
    }

    updateComponent(nextComp);
  };

  const parseAnalogValue = (valStr) => {
    const m = (valStr || "").match(/^([\d.]+)([pnumkMG]?)$/);
    if (!m) return { num: valStr, suffix: "" };
    return { num: m[1], suffix: m[2] };
  };

  const updateAnalogValue = (num, suffix) => {
    const val = `${num}${suffix}`;
    handleChange("value", val, false);
  };

  const analogHasEditableValue =
    comp.domain === ANALOG_DOMAIN &&
    ![ANALOG_KIND.GND, ANALOG_KIND.VOLTMETER, ANALOG_KIND.AMMETER].includes(comp.kind);

  return (
    <div className="w-64 border-l border-neutral-800 bg-neutral-950/60 backdrop-blur flex flex-col h-full">
      <div className="p-4 border-b border-neutral-800 font-semibold text-neutral-200 flex items-center justify-between">
        <div>Properties</div>
        {typeof onClose === "function" && (
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-100 transition w-8 h-8 flex items-center justify-center rounded hover:bg-neutral-800"
            title="Close"
            aria-label="Close properties"
          >
            A-
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase">Type</label>
          <div className="text-sm text-neutral-300 bg-neutral-900 px-2 py-1.5 rounded border border-neutral-800">
            {comp.kind}
          </div>
          {comp.ref && <div className="text-xs text-neutral-500 mt-1">Ref: {comp.ref}</div>}
        </div>

        {comp.domain === ANALOG_DOMAIN && (
          <div className="space-y-3">
            {analogHasEditableValue ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-500 uppercase">Value</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      value={parseAnalogValue(comp.props?.value).num}
                      onChange={(e) =>
                        updateAnalogValue(e.target.value, parseAnalogValue(comp.props?.value).suffix)
                      }
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
                      placeholder="10"
                    />
                    <select
                      value={parseAnalogValue(comp.props?.value).suffix}
                      onChange={(e) =>
                        updateAnalogValue(parseAnalogValue(comp.props?.value).num, e.target.value)
                      }
                      className="w-16 bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
                    >
                      <option value="">-</option>
                      <option value="p">p (pico)</option>
                      <option value="n">n (nano)</option>
                      <option value="u">u (micro)</option>
                      <option value="m">m (milli)</option>
                      <option value="k">k (kilo)</option>
                      <option value="M">M (mega)</option>
                      <option value="G">G (giga)</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-neutral-500">
                  Unit:
                  {comp.kind === ANALOG_KIND.R
                    ? " Ohms (Ω)"
                    : comp.kind === ANALOG_KIND.C
                      ? " Farads (F)"
                      : comp.kind === ANALOG_KIND.L
                        ? " Henries (H)"
                        : comp.kind === ANALOG_KIND.VDC
                          ? " Volts (V)"
                          : ""}
                </div>
              </>
            ) : (
              <div className="text-xs text-neutral-500">
                {comp.kind === ANALOG_KIND.VOLTMETER
                  ? "Voltmeter (no editable value)"
                  : comp.kind === ANALOG_KIND.AMMETER
                    ? "Ammeter (ideal 0V sense source)"
                    : "Ground"}
              </div>
            )}
          </div>
        )}

        {comp.kind === KIND.CLOCK && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500 uppercase">Interval (ms)</label>
              <input
                type="number"
                min="10"
                step="10"
                value={comp.state?.interval ?? 1000}
                onChange={(e) => handleChange("interval", parseInt(e.target.value) || 100, true)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500 uppercase">Frequency (Hz)</label>
              <div className="text-xs text-neutral-400 mb-1">Approximate</div>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={comp.state?.interval ? (1000 / comp.state.interval).toFixed(1) : "1.0"}
                onChange={(e) => {
                  const hz = parseFloat(e.target.value) || 1;
                  const ms = Math.round(1000 / hz);
                  handleChange("interval", ms, true);
                }}
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
              />
            </div>
          </>
        )}

        {comp.kind === KIND.BUFFER && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500 uppercase">Delay (Ticks)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={comp.props?.delay ?? 2}
                onChange={(e) => handleChange("delay", parseInt(e.target.value) || 1, false)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500 uppercase">Delay (ms)</label>
              <div className="text-xs text-neutral-400 mb-1">1 tick = 50ms</div>
              <input
                type="number"
                min="50"
                step="50"
                value={(comp.props?.delay ?? 2) * 50}
                onChange={(e) => {
                  const ms = parseInt(e.target.value) || 50;
                  const ticks = Math.max(1, Math.round(ms / 50));
                  handleChange("delay", ticks, false);
                }}
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
              />
            </div>
          </>
        )}

        {comp.kind === KIND.TIMER_555 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-500 uppercase">Pulse Width (ms)</label>
            <input
              type="number"
              min="50"
              step="50"
              value={comp.props?.pulseMs ?? 800}
              onChange={(e) => handleChange("pulseMs", parseInt(e.target.value) || 100, false)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
            />
          </div>
        )}
      </div>
    </div>
  );
}

