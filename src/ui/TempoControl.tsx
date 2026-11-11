import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Palette } from "./theme";

export interface TempoControlProps {
  value: number;
  onChange: (bpm: number) => void;
  palette: Palette;
  min?: number;
  max?: number;
  onValuePress?: () => void;
  valueLabel?: string;
  caption?: string;
}

/** Immediate tempo steps; the value remains readable without opening an input. */
export function TempoControl({ value, onChange, palette: c, min = 1, max = Number.MAX_SAFE_INTEGER, onValuePress, valueLabel, caption = "BPM" }: TempoControlProps) {
  const step = (amount: number) => {
    const next = Math.max(min, Math.min(max, Math.round((value + amount) * 100) / 100));
    if (next !== value) onChange(next);
  };
  const valueContent = <><Text style={{ color: c.ink, fontFamily: "Geist Mono", fontSize: 14, fontWeight: "600" }}>{Number(value.toFixed(2))}</Text><Text style={{ color: c.muted, fontFamily: "Inter Tight", fontSize: 9 }}>{caption}</Text></>;
  return <View accessibilityLabel="Tempo" style={{ width: 156, flexShrink: 0, height: 48, flexDirection: "row", alignItems: "stretch", backgroundColor: c.card, borderRadius: 10 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Decrease BPM" disabled={value <= min} accessibilityState={{ disabled: value <= min }} onPress={() => step(-1)} style={{ width: 48, height: 48, borderWidth: 1, borderColor: c.line, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, justifyContent: "center", alignItems: "center", opacity: value <= min ? .4 : 1 }}><Text style={{ color: c.ink, fontSize: 22 }}>−</Text></Pressable>
    {onValuePress ? <Pressable accessibilityRole="button" accessibilityLabel={valueLabel ?? "Tempo settings"} onPress={onValuePress} style={{ width: 60, height: 48, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, justifyContent: "center", alignItems: "center" }}>{valueContent}</Pressable> : <View accessibilityRole="adjustable" accessibilityLabel={`${value} BPM`} accessibilityValue={{ min, max, now: value }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={event => step(event.nativeEvent.actionName === "increment" ? 1 : -1)} style={{ width: 60, height: 48, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, justifyContent: "center", alignItems: "center" }}>{valueContent}</View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Increase BPM" disabled={value >= max} accessibilityState={{ disabled: value >= max }} onPress={() => step(1)} style={{ width: 48, height: 48, borderWidth: 1, borderColor: c.line, borderTopRightRadius: 10, borderBottomRightRadius: 10, justifyContent: "center", alignItems: "center", opacity: value >= max ? .4 : 1 }}><Text style={{ color: c.ink, fontSize: 22 }}>+</Text></Pressable>
  </View>;
}
