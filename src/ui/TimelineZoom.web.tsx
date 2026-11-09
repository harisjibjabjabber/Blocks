import React from "react";
import type { Palette } from "./theme";

export interface TimelineZoomProps { value: number; onChange: (value: number) => void; onFit: () => void; palette: Palette }

export function TimelineZoom({ value, onChange, onFit, palette }: TimelineZoomProps) {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, height: 48 }}>
    <label htmlFor="history-zoom" style={{ color: palette.muted, fontFamily: "Inter Tight", fontSize: 12 }}>Zoom</label>
    <input id="history-zoom" aria-label="Timeline zoom" aria-valuetext={value < 1 ? "Full timeline" : `${Math.round(value)} percent detail`} type="range" min={0} max={100} step={1} value={value} onChange={event => onChange(Number(event.target.value))} style={{ flex: 1, minWidth: 48, height: 48, margin: 0, accentColor: palette.ink, cursor: "ew-resize" }} />
    <button type="button" aria-label="Show full take" onClick={onFit} style={{ height: 48, padding: "0 8px", border: 0, borderRadius: 6, background: "transparent", color: palette.ink, fontFamily: "Inter Tight", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>Full take</button>
  </div>;
}
