#pragma once

// Public parameter values for blocks.ep.fm.v1 as implemented in this slice.
// They are the code's contract, not an audition and not a claim that the
// Android and web renders match sample for sample.
namespace blocks::ep_fm {

constexpr const char* kPresetId = "blocks.ep.fm.v1";
constexpr const char* kDisplayName = "Procedural electric piano";
constexpr float kTuningA4Hz = 440.f;
constexpr float kVelocityCurve = 1.5f;
constexpr float kModulatorRatio = 1.f;
constexpr float kModIndexAtFullVelocity = 2.4f;
constexpr float kModIndexSustain = 0.35f;
constexpr float kAttackSeconds = 0.003f;
constexpr float kDecaySeconds = 1.1f;
constexpr float kSustainLevel = 0.55f;
constexpr float kReleaseSeconds = 0.22f;
constexpr float kTremoloRateHz = 4.8f;
constexpr float kTremoloDepth = 0.15f;
constexpr float kOutputGainDb = -9.f;
constexpr int kPitchBendSemitoneRange = 2;

}  // namespace blocks::ep_fm
