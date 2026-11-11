import React, { useMemo, useRef } from "react";
import { PanResponder, Text, View } from "react-native";
import { ENVELOPE_RANGES } from "../audio/instruments";
import { ENVELOPE_CONTROLS, envelopeDialUnit, envelopeDialValue, envelopeValueLabel, stepEnvelopeDial, type EnvelopeParameter, type SynthControlsProps } from "./synth-controls";

export type { SynthControlsProps } from "./synth-controls";

/** Native fallback; physical-device acceptance remains separate from web QA. */
export function SynthControls({ palette, envelope, onChange }: SynthControlsProps) {
  return <View accessibilityLabel="Envelope" style={{ flexDirection: "row", gap: 8 }}>{ENVELOPE_CONTROLS.map(({ key, label }) => <NativeDial key={key} parameter={key} label={label} value={envelope[key]} palette={palette} onChange={value => onChange({ ...envelope, [key]: value })} />)}</View>;
}

function NativeDial({ parameter, label, value, palette: c, onChange }: { parameter: EnvelopeParameter; label: string; value: number; palette: SynthControlsProps["palette"]; onChange: (value: number) => void }) {
  const latest = useRef({ value, onChange }); latest.current = { value, onChange };
  const original = useRef(value);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { original.current = latest.current.value; },
    onPanResponderMove: (_, gesture) => latest.current.onChange(envelopeDialValue(parameter, envelopeDialUnit(parameter, original.current) - gesture.dy / 160)),
    onPanResponderTerminate: () => latest.current.onChange(original.current),
  }), [parameter]);
  const [min, max] = ENVELOPE_RANGES[parameter];
  return <View style={{ flex: 1, alignItems: "center", minWidth: 48 }}>
    <Text style={{ color: c.ink, fontSize: 12 }}>{label}</Text>
    <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value, text: envelopeValueLabel(parameter, value) }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={event => onChange(stepEnvelopeDial(parameter, value, event.nativeEvent.actionName === "increment" ? .01 : -.01))} style={{ height: 64, width: 56, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: c.accent, backgroundColor: c.card, alignItems: "center", transform: [{ rotate: `${-135 + envelopeDialUnit(parameter, value) * 270}deg` }] }}><View style={{ marginTop: 4, width: 3, height: 15, borderRadius: 2, backgroundColor: c.ink }} /></View>
    </View>
    <Text style={{ color: c.muted, fontSize: 11 }}>{envelopeValueLabel(parameter, value)}</Text>
  </View>;
}
