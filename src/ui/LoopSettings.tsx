import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Palette } from "./theme";
import type { FixedBars } from "./loop-assist";

export function LoopLengthControl({ bars, onPress, palette: c, open }: { bars: FixedBars | null; onPress: () => void; palette: Palette; open: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Cut length, ${bars ? `${bars} bars` : "Free"}`} accessibilityState={{ expanded: open }} aria-expanded={open} dataSet={{ loopSettings: "true" }} onPress={onPress} style={{ width: 64, flexShrink: 0, minHeight: 48, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: c.card, borderColor: open ? c.ink : c.line, borderWidth: 1, borderRadius: 10 }}><Text style={{ color: c.ink, fontFamily: "Inter Tight", fontSize: 13 }}>{bars ? `${bars} bars` : "Free"} ▾</Text></Pressable>;
}

export function LoopSettings({ bars, onBars, onReset, onCut, palette: c, tempoPreview, onUndo, canEdit = true }: {
  bars: FixedBars | null; onBars: (bars: FixedBars | null) => void;
  onReset: () => void; onCut: () => void; palette: Palette; tempoPreview?: number | null; onUndo?: () => void; canEdit?: boolean;
}) {
  const action = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={{ opacity: disabled ? .4 : 1, flex: 1, minHeight: 48, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.line, borderRadius: 8 }}><Text style={{ color: c.ink, fontFamily: "Inter Tight", fontSize: 14 }}>{label}</Text></Pressable>;
  return <View style={{ gap: 8 }}>
    <View role="group" accessibilityLabel="Cut length" style={{ flexDirection: "row", gap: 4 }}>{([4, 8, null] as const).map(value => <Pressable key={String(value)} accessibilityRole="button" accessibilityLabel={value ? `Use ${value} bars` : "Use free range"} aria-pressed={bars === value} onPress={() => onBars(value)} style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: bars === value ? c.ink : c.line, backgroundColor: bars === value ? c.ink : c.card, borderRadius: 8 }}><Text style={{ color: bars === value ? c.bg : c.ink, fontFamily: "Inter Tight", fontSize: 14 }}>{value ? `${value} bars` : "Free"}</Text></Pressable>)}</View>
    {canEdit && <><Text style={{ color: c.muted, fontFamily: "Inter Tight", fontSize: 12 }}>{bars ? tempoPreview ? `Cut: ${bars} bars → ${Number(tempoPreview.toFixed(2))} BPM` : `Cut: ${bars} bars at the sketch tempo` : "Cut: keep the selected range"}</Text>
    <View style={{ flexDirection: "row", gap: 8 }}>{action("Reset loop", onReset, bars === null)}{action("Cut range", onCut)}{onUndo && action("Undo range", onUndo)}</View></>}
  </View>;
}
