import React, { useEffect, useRef, useState } from "react";
import { ENVELOPE_RANGES } from "../audio/instruments";
import { ENVELOPE_CONTROLS, envelopeDialUnit, envelopeDialValue, envelopeValueLabel, stepEnvelopeDial, type EnvelopeParameter, type SynthControlsProps } from "./synth-controls";

export type { SynthControlsProps } from "./synth-controls";

export function SynthControls({ palette, envelope, onChange }: SynthControlsProps) {
  const latest = useRef(envelope);
  latest.current = envelope;
  const change = (key: EnvelopeParameter, value: number) => {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    onChange(next);
  };
  return <div role="group" aria-label="Envelope" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, width: "100%" }}>
    {ENVELOPE_CONTROLS.map(({ key, label }) => <EnvelopeDial key={key} parameter={key} label={label} value={envelope[key]} palette={palette} onChange={value => change(key, value)} />)}
  </div>;
}

function EnvelopeDial({ parameter, label, value, palette: c, onChange }: {
  parameter: EnvelopeParameter; label: string; value: number; palette: SynthControlsProps["palette"]; onChange: (value: number) => void;
}) {
  const drag = useRef<{ id: number; y: number; unit: number; original: number } | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const canceledByEscape = useRef(false);
  const change = useRef(onChange);
  change.current = onChange;
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);
  const unit = envelopeDialUnit(parameter, value);
  const [min, max] = ENVELOPE_RANGES[parameter];
  const valueText = envelopeValueLabel(parameter, value);
  function finish(cancel: boolean) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (cancel) change.current(current.original);
    setActive(false);
    if (element.current?.hasPointerCapture(current.id)) element.current.releasePointerCapture(current.id);
  }
  useEffect(() => {
    const blur = () => finish(true);
    const hidden = () => { if (document.hidden) finish(true); };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  const angle = -135 + unit * 270;
  const point = (degrees: number, radius = 25) => ({ x: 32 + radius * Math.sin(degrees * Math.PI / 180), y: 32 - radius * Math.cos(degrees * Math.PI / 180) });
  const first = point(-135), last = point(135), current = point(angle), needle = point(angle, 15);
  return <div style={{ minWidth: 0, textAlign: "center", color: c.ink, fontFamily: '"Inter Tight", sans-serif' }}>
    <div style={{ fontSize: 12, lineHeight: "18px" }}>{label}</div>
    <div ref={element} role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText} aria-orientation="vertical" data-envelope-dial={parameter}
      onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); finish(true); }}
      onPointerDown={event => {
        if (drag.current || (event.pointerType !== "touch" && event.button !== 0)) return;
        event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
        drag.current = { id: event.pointerId, y: event.clientY, unit, original: value };
        event.currentTarget.setPointerCapture(event.pointerId); setActive(true);
      }}
      onPointerMove={event => {
        const currentDrag = drag.current;
        if (!currentDrag || currentDrag.id !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        const next = currentDrag.unit + (currentDrag.y - event.clientY) / (event.shiftKey ? 800 : 160);
        change.current(envelopeDialValue(parameter, next));
      }}
      onPointerUp={event => { if (drag.current?.id === event.pointerId) { event.stopPropagation(); finish(false); } }}
      onPointerCancel={event => { if (drag.current?.id === event.pointerId) finish(true); }}
      onLostPointerCapture={() => finish(true)}
      onKeyDown={event => {
        if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); canceledByEscape.current = true; finish(true); return; }
        const steps: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
        if (!(event.key in steps) && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault(); event.stopPropagation();
        const next = event.key === "Home" ? min : event.key === "End" ? max : stepEnvelopeDial(parameter, value, steps[event.key] * (event.shiftKey ? .002 : .01));
        change.current(next);
      }}
      onKeyUp={event => {
        if (event.key === "Escape" && canceledByEscape.current) { event.preventDefault(); event.stopPropagation(); canceledByEscape.current = false; }
      }}
      style={{ minWidth: 48, height: 64, maxWidth: 72, margin: "0 auto", borderRadius: 10, outline: focused ? `1px solid ${c.ink}` : "none", outlineOffset: 0, touchAction: "none", userSelect: "none", cursor: active ? "ns-resize" : "grab" }}>
      <svg viewBox="0 0 64 64" width="100%" height="64" aria-hidden="true" style={{ display: "block", pointerEvents: "none" }}>
        <path d={`M ${first.x} ${first.y} A 25 25 0 1 1 ${last.x} ${last.y}`} fill="none" stroke={c.line} strokeWidth="3" strokeLinecap="round" />
        {unit > 0 && <path d={`M ${first.x} ${first.y} A 25 25 0 ${unit > 2 / 3 ? 1 : 0} 1 ${current.x} ${current.y}`} fill="none" stroke={c.accent} strokeWidth="3" strokeLinecap="round" />}
        <circle cx="32" cy="32" r="19" fill={c.card} stroke={active ? c.ink : c.line} strokeWidth="1.5" />
        <line x1="32" y1="32" x2={needle.x} y2={needle.y} stroke={c.ink} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="32" r="2" fill={c.ink} />
      </svg>
    </div>
    <div aria-hidden="true" style={{ color: c.muted, fontSize: 11, lineHeight: "18px", fontFamily: '"Geist Mono", monospace', whiteSpace: "nowrap" }}>{valueText}</div>
  </div>;
}
