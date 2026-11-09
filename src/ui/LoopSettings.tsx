import React from "react";
import { Pressable, Text, View } from "react-native";
import { SelectControl } from "./SelectControl";
import type { Palette } from "./theme";
import type { FixedBars } from "./loop-assist";

export function LoopSettings({ bars, onBars, onReset, onCut, palette: c, tempoPreview, onUndo }: {
  bars: FixedBars | null; onBars: (bars: FixedBars | null) => void;
  onReset: () => void; onCut: () => void; palette: Palette; tempoPreview?: number | null; onUndo?: () => void;
}) {
  const action = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={{ opacity: disabled ? .4 : 1, flex: 1, minHeight: 48, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.line, borderRadius: 8 }}><Text style={{ color: c.ink, fontFamily: "Inter Tight", fontSize: 14 }}>{label}</Text></Pressable>;
  return <View style={{ gap: 8 }}>
    <SelectControl label="Cut length" value={bars === null ? "free" : String(bars)} options={[{ value: "4", label: "Cut as 4 bars" }, { value: "8", label: "Cut as 8 bars" }, { value: "free", label: "Free range" }]} onChange={value => onBars(value === "free" ? null : Number(value) as FixedBars)} palette={c} />
    <Text style={{ color: c.muted, fontFamily: "Inter Tight", fontSize: 12 }}>{bars ? tempoPreview ? `Cut: ${bars} bars → ${Number(tempoPreview.toFixed(2))} BPM` : `Cut: ${bars} bars at the sketch tempo` : "Cut: keep the selected range"}</Text>
    <View style={{ flexDirection: "row", gap: 8 }}>{action("Reset loop", onReset, bars === null)}{action("Cut range", onCut)}{onUndo && action("Undo range", onUndo)}</View>
  </View>;
}
