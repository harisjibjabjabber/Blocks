import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Palette } from "./theme";

export interface TimelineZoomProps { value: number; onChange: (value: number) => void; onFit: () => void; palette: Palette; label?: string; id?: string; fitLabel?: string; fitAria?: string }
export function TimelineZoom({ value, onChange, onFit, palette, label = "Zoom", fitLabel = "Full take", fitAria = "Show full take" }: TimelineZoomProps) {
  return <View style={{ flexDirection: "row", alignItems: "center", height: 48, gap: 6 }}><Text style={{ color: palette.muted }}>{label}</Text>{[-10, 10].map(step => <Pressable key={step} accessibilityRole="button" accessibilityLabel={step < 0 ? "Zoom out time" : "Zoom in time"} onPress={() => onChange(Math.max(0, Math.min(100, value + step)))} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Text style={{ color: palette.ink }}>{step < 0 ? "−" : "+"}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel={fitAria} onPress={onFit} style={{ flex: 1, height: 48, justifyContent: "center" }}><Text style={{ color: palette.ink }}>{fitLabel}</Text></Pressable></View>;
}
