import React from "react";
import type { Palette } from "./theme";
export interface SelectControlProps { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void; palette: Palette; disabled?: boolean }
export function SelectControl({ label, value, options, onChange, palette, disabled }: SelectControlProps) {
  return <select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} style={{ minHeight: 48, minWidth: 80, maxWidth: "100%", padding: "0 10px", border: `1px solid ${palette.line}`, borderRadius: 10, background: palette.card, color: palette.ink, fontFamily: "Inter Tight, sans-serif", fontSize: 14, cursor: "pointer", colorScheme: palette.bg === "#0A0C0F" ? "dark" : "light" }}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
