import React from "react";
import type { Palette } from "./theme";

export interface TimelineZoomProps { value: number; onChange: (value: number) => void; onFit: () => void; palette: Palette; label?: string; id?: string; fitLabel?: string; fitAria?: string }

export function TimelineZoom({ value, onChange, onFit, palette, label = "Zoom", id = "history-zoom", fitLabel = "Full take", fitAria = "Show full take" }: TimelineZoomProps) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, height: 48 }}>
    <label htmlFor={id} style={{ color: palette.muted, fontFamily: "Inter Tight", fontSize: 12 }}>{label}</label>
    <input id={id} aria-label={id === "history-zoom" ? "Timeline zoom" : `${label} zoom`} aria-valuetext={value < 1 ? "Full timeline" : `${Math.round(value)} percent detail`} type="range" min={0} max={100} step={1} value={value} onChange={event => onChange(Number(event.target.value))} style={{ flex: 1, minWidth: 48, height: 48, margin: 0, accentColor: palette.ink, cursor: "ew-resize" }} />
    <button type="button" aria-label={fitAria} onClick={onFit} style={{ height: 48, padding: "0 8px", border: 0, borderRadius: 6, background: "transparent", color: palette.ink, fontFamily: "Inter Tight", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>{fitLabel}</button>
  </div>;
}
