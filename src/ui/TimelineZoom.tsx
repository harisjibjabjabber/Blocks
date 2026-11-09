import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Palette } from "./theme";

export interface TimelineZoomProps { value: number; onChange: (value: number) => void; onFit: () => void; palette: Palette }
export function TimelineZoom({ value, onChange, onFit, palette }: TimelineZoomProps) {
  return <View style={{ flexDirection: "row", alignItems: "center", height: 48, gap: 12 }}><Text style={{ color: palette.muted }}>Zoom</Text>{[-10, 10].map(step => <Pressable key={step} accessibilityRole="button" accessibilityLabel={step < 0 ? "Zoom out time" : "Zoom in time"} onPress={() => onChange(Math.max(0, Math.min(100, value + step)))} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Text style={{ color: palette.ink }}>{step < 0 ? "−" : "+"}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Show full take" onPress={onFit} style={{ flex: 1, height: 48, justifyContent: "center" }}><Text style={{ color: palette.ink }}>Full take</Text></Pressable></View>;
}
