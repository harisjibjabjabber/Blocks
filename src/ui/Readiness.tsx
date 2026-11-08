import React from "react";
import { Text, View } from "react-native";
import { readinessText } from "../domain/readiness";

export function ReadinessStrip({ audioState, showContext }: { audioState: string; showContext: boolean }) {
  const view = readinessText(audioState);
  return (
    <View>
      <Text style={{ color: "#E8EAED", fontSize: 16 }}>{view.chip}</Text>
      {showContext ? <Text style={{ color: "#A0A7B1", marginTop: 4, fontSize: 14 }}>{view.line}</Text> : null}
    </View>
  );
}
