import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Palette } from "./theme";
export interface SelectControlProps { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void; palette: Palette; disabled?: boolean }
export function SelectControl({ label, value, options, onChange, palette, disabled }: SelectControlProps) {
  const [open, setOpen] = useState(false);
  return <View><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setOpen(!open)} style={{ minHeight: 48, padding: 12, backgroundColor: palette.card }}><Text style={{ color: palette.ink }}>{options.find(option => option.value === value)?.label}</Text></Pressable>{open && options.map(option => <Pressable key={option.value} onPress={() => { onChange(option.value); setOpen(false); }} style={{ minHeight: 48, padding: 12 }}><Text style={{ color: palette.ink }}>{option.label}</Text></Pressable>)}</View>;
}
