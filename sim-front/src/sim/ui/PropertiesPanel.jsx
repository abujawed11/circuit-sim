import React, { useMemo } from "react";
import { KIND } from "../model/types";
import { ANALOG_DOMAIN, ANALOG_KIND } from "../analog/model/analogTypes";

function Icon({ name, className = "w-4 h-4", title }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : "presentation",
  };

  const paths = {
    settings: (
      <>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="2" />
        <path d="M19.4 15a8.7 8.7 0 0 0 .1-2l2-1.4-2-3.4-2.3.7a7.8 7.8 0 0 0-1.6-1l-.3-2.4H10.7L10.4 7a7.8 7.8 0 0 0-1.6 1L6.5 7.3l-2 3.4 2 1.4a8.7 8.7 0 0 0 0 2l-2 1.4 2 3.4 2.3-.7c.5.4 1 .7 1.6 1l.3 2.4h3.9l.3-2.4c.6-.3 1.1-.6 1.6-1l2.3.7 2-3.4-2-1.4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />,
    chip: (
      <>
        <path d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2M3 15h2M19 9h2M19 15h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 7h10v10H7V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    tag: (
      <>
        <path d="M3 12V7a2 2 0 0 1 2-2h5l11 11-7 7L3 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
    info: (
      <>
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 10v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 7h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
    sine: <path d="M2 12c3 0 3-8 6-8s3 16 6 16 3-8 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    dc: (
      <>
        <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      </>
    ),
    resistor: <path d="M3 12h3l2-4 4 8 4-8 2 4h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    capacitor: <path d="M7 6v12M17 6v12M3 12h4M17 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    inductor: <path d="M3 12h2c0-3 2-5 4-5s4 2 4 5 2 5 4 5 4-2 4-5h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    bolt: <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    clock: (
      <>
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    delay: (
      <>
        <path d="M4 7h10a6 6 0 1 1 0 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 7v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 15v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    sliders: (
      <>
        <path d="M6 21V10M6 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0V3M12 21v-6m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0V3M18 21V8m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  };

  return <svg {...common}>{title && <title>{title}</title>}{paths[name]}</svg>;
}

function Section({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/35 shadow-[0_0_0_1px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800/60">
        <span className="text-neutral-300"><Icon name={icon} className="w-4 h-4" /></span>
        <div className="text-xs font-semibold tracking-wide text-neutral-200 uppercase">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Label({ children }) {
  return <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{children}</div>;
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl bg-neutral-950/60 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition font-mono ${className}`}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl bg-neutral-950/60 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition font-mono ${className}`}
    >
      {children}
    </select>
  );
}

function HelpRow({ icon = "info", children }) {
  return (
    <div className="mt-2 flex items-start gap-2 text-xs text-neutral-500">
      <span className="mt-0.5 text-neutral-500"><Icon name={icon} className="w-4 h-4" /></span>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-0.5 text-[11px] font-mono text-neutral-300">
      {children}
    </span>
  );
}

// Extracted Editors to prevent re-creation on render

const VacEditor = ({ comp, onChange }) => {
  // Parse SPICE SIN(...) string
  const params = useMemo(() => {
    const valStr = comp.props?.value;
    const m = (valStr || "").match(/^SIN\s*\((.*)\)$/i);
    if (!m) return { offset: 0, amp: 5, freq: "1k", delay: 0, damping: 0 };
    const parts = m[1].trim().split(/\s+/);
    return {
      offset: parts[0] ?? 0,
      amp: parts[1] ?? 5,
      freq: parts[2] ?? "1k",
      delay: parts[3] ?? 0,
      damping: parts[4] ?? 0,
    };
  }, [comp.props?.value]);

  const updateSineValue = (field, newValue) => {
    const next = { ...params, [field]: newValue };
    const val = `SIN(${next.offset} ${next.amp} ${next.freq} ${next.delay} ${next.damping})`;
    onChange("value", val, false);
  };

  return (
    <Section title="AC Source" icon="sine">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Amplitude (V)</Label><span className="text-neutral-500"><Icon name="bolt" className="w-4 h-4" /></span></div>
          <Input value={params.amp} onChange={(e) => updateSineValue("amp", e.target.value)} placeholder="5" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Offset (V)</Label><span className="text-neutral-500"><Icon name="sliders" className="w-4 h-4" /></span></div>
          <Input value={params.offset} onChange={(e) => updateSineValue("offset", e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between"><Label>Frequency</Label><span className="text-neutral-500"><Icon name="sine" className="w-4 h-4" /></span></div>
        <Input value={params.freq} onChange={(e) => updateSineValue("freq", e.target.value)} placeholder="1k" />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Delay (s)</Label><span className="text-neutral-500"><Icon name="clock" className="w-4 h-4" /></span></div>
          <Input value={params.delay} onChange={(e) => updateSineValue("delay", e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Damping</Label><span className="text-neutral-500"><Icon name="sliders" className="w-4 h-4" /></span></div>
          <Input value={params.damping} onChange={(e) => updateSineValue("damping", e.target.value)} placeholder="0" />
        </div>
      </div>
      <HelpRow>Raw SPICE: <span className="text-neutral-400 font-mono break-all">{comp.props?.value}</span></HelpRow>
    </Section>
  );
};

const AnalogValueEditor = ({ comp, onChange }) => {
  const parsed = useMemo(() => {
    const valStr = comp.props?.value;
    const m = (valStr || "").match(/^([\d.]+)([pnumkMG]?)$/);
    if (!m) return { num: valStr || "", suffix: "" };
    return { num: m[1], suffix: m[2] };
  }, [comp.props?.value]);

  const updateAnalogValue = (num, suffix) => {
    const val = `${num}${suffix}`;
    onChange("value", val, false);
  };

  const unit = comp.kind === ANALOG_KIND.R ? "Ohms" : comp.kind === ANALOG_KIND.C ? "Farads" : comp.kind === ANALOG_KIND.L ? "Henries" : comp.kind === ANALOG_KIND.VDC ? "Volts" : "";
  const title = comp.kind === ANALOG_KIND.R ? "Resistor" : comp.kind === ANALOG_KIND.C ? "Capacitor" : comp.kind === ANALOG_KIND.L ? "Inductor" : comp.kind === ANALOG_KIND.VDC ? "DC Source" : "Analog";
  const iconName = comp.kind === ANALOG_KIND.R ? "resistor" : comp.kind === ANALOG_KIND.C ? "capacitor" : comp.kind === ANALOG_KIND.L ? "inductor" : comp.kind === ANALOG_KIND.VDC ? "dc" : "sliders";

  return (
    <Section title={title} icon={iconName}>
      <div className="space-y-2">
        <Label>Value</Label>
        <div className="flex gap-2">
          <Input type="number" step="any" value={parsed.num} onChange={(e) => updateAnalogValue(e.target.value, parsed.suffix)} placeholder="10" className="flex-1 min-w-10" />
          <Select value={parsed.suffix} onChange={(e) => updateAnalogValue(parsed.num, e.target.value)} className="max-w-10">
            <option value="">-</option>
            <option value="p">p</option>
            <option value="n">n</option>
            <option value="u">u</option>
            <option value="m">m</option>
            <option value="k">k</option>
            <option value="M">M</option>
            <option value="G">G</option>
          </Select>
        </div>
        {unit && <HelpRow>Unit: <span className="text-neutral-400 font-semibold">{unit}</span></HelpRow>}
      </div>
    </Section>
  );
};

const ClockEditor = ({ comp, onChange }) => {
  const interval = comp.state?.interval ?? 1000;
  const hz = interval ? (1000 / interval).toFixed(1) : "1.0";

  return (
    <Section title="Clock" icon="clock">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Interval (ms)</Label>
          <Input type="number" min="10" step="10" value={interval} onChange={(e) => onChange("interval", parseInt(e.target.value) || 100, true)} />
        </div>
        <div className="space-y-2">
          <Label>Frequency (Hz)</Label>
          <Input type="number" min="0.1" step="0.1" value={hz} onChange={(e) => {
            const nextHz = parseFloat(e.target.value) || 1;
            const ms = Math.max(10, Math.round(1000 / nextHz));
            onChange("interval", ms, true);
          }} />
          <div className="text-[11px] text-neutral-500 text-right">Approximate</div>
        </div>
      </div>
    </Section>
  );
};

const BufferDelayEditor = ({ comp, onChange }) => {
  const ticks = comp.props?.delay ?? 2;
  return (
    <Section title="Buffer Delay" icon="delay">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Delay (ticks)</Label>
          <Input type="number" min="1" max="100" value={ticks} onChange={(e) => onChange("delay", parseInt(e.target.value) || 1, false)} />
        </div>
        <div className="space-y-2">
          <Label>Delay (ms)</Label>
          <Input type="number" min="50" step="50" value={ticks * 50} onChange={(e) => {
            const ms = parseInt(e.target.value) || 50;
            const nextTicks = Math.max(1, Math.round(ms / 50));
            onChange("delay", nextTicks, false);
          }} />
          <div className="text-[11px] text-neutral-500 text-right">1 tick = 50ms</div>
        </div>
      </div>
    </Section>
  );
};

export default function PropertiesPanel({ selection, circuit, updateComponent, onClose }) {
  if (selection.compIds.length !== 1) {
    return (
      <div className="w-80 border-l border-neutral-800 bg-neutral-950/80 backdrop-blur p-6 text-neutral-500 text-sm flex flex-col justify-center items-center h-full text-center">
        <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-300">
          <Icon name="settings" className="w-5 h-5" />
        </div>
        <div className="font-semibold text-neutral-300 mb-1">No selection</div>
        <div className="text-neutral-500">Select a single component to edit properties.</div>
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

  const getCompVisual = (comp) => {
    const isAnalog = comp.domain === ANALOG_DOMAIN;
    if (isAnalog) {
      if (comp.kind === ANALOG_KIND.VAC) return { icon: "sine", label: "VAC" };
      if (comp.kind === ANALOG_KIND.VDC) return { icon: "dc", label: "VDC" };
      if (comp.kind === ANALOG_KIND.R) return { icon: "resistor", label: "R" };
      if (comp.kind === ANALOG_KIND.C) return { icon: "capacitor", label: "C" };
      if (comp.kind === ANALOG_KIND.L) return { icon: "inductor", label: "L" };
      return { icon: "sliders", label: "AN" };
    }
    if (comp.kind === KIND.CLOCK) return { icon: "clock", label: "CLK" };
    if (comp.kind === KIND.BUFFER) return { icon: "delay", label: "BUF" };
    return { icon: "chip", label: "IC" };
  };

  const { icon: compIcon, label: compShort } = getCompVisual(comp);
  const analogHasEditableValue = comp.domain === ANALOG_DOMAIN && ![ANALOG_KIND.GND, ANALOG_KIND.VOLTMETER, ANALOG_KIND.AMMETER].includes(comp.kind);

  return (
    <div
      className="w-80 border-l border-neutral-800 bg-neutral-950/90 backdrop-blur flex flex-col h-full shadow-2xl relative z-50 flex-shrink-0"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <span className="text-neutral-300"><Icon name="settings" className="w-5 h-5" /></span>
          <div className="font-semibold text-neutral-100 text-base tracking-tight">Properties</div>
        </div>
        {typeof onClose === "function" && (
          <button onClick={onClose} className="text-neutral-400 hover:text-white hover:bg-neutral-800 transition w-9 h-9 flex items-center justify-center rounded-xl border border-transparent hover:border-neutral-700" title="Close">
            <Icon name="close" className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-center text-neutral-200">
              <Icon name={compIcon} className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold text-neutral-100 truncate">{comp.kind}</div>
                <Badge>{compShort}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                  <Icon name="tag" className="w-4 h-4" />
                  <span className="text-neutral-400">Ref</span>
                </span>
                <Badge>{comp.ref || `#${comp.id.slice(0, 4)}`}</Badge>
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                  <Icon name="chip" className="w-4 h-4" />
                  <span className="text-neutral-400">ID</span>
                </span>
                <Badge>{comp.id.slice(0, 8)}</Badge>
              </div>
            </div>
          </div>
        </div>

        {comp.domain === ANALOG_DOMAIN && (
          <>
            {comp.kind === ANALOG_KIND.VAC ? (
              <VacEditor comp={comp} onChange={handleChange} />
            ) : analogHasEditableValue ? (
              <AnalogValueEditor comp={comp} onChange={handleChange} />
            ) : (
              <Section title="Info" icon="info">
                <div className="text-sm text-neutral-300">
                  {comp.kind === ANALOG_KIND.VOLTMETER ? "Voltmeter measures potential difference." : comp.kind === ANALOG_KIND.AMMETER ? "Ammeter measures series current." : "Reference node (0V)."}
                </div>
              </Section>
            )}
          </>
        )}

        {comp.kind === KIND.CLOCK && <ClockEditor comp={comp} onChange={handleChange} />}
        {comp.kind === KIND.BUFFER && <BufferDelayEditor comp={comp} onChange={handleChange} />}
      </div>
    </div>
  );
}