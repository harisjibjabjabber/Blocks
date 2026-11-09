import React from "react";
import type { Palette } from "./theme";
export function LayerVolume({ label, value, onChange, palette }: { label: string; value: number; onChange: (value: number) => void; palette: Palette }) {
 return <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 48, color: palette.ink, fontSize: 12 }}>Volume<input aria-label={label} aria-valuetext={`${value}%`} type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1, minWidth: 48, height: 48, accentColor: palette.ink }} /><span style={{ width: 32 }}>{value}%</span></label>;
}
