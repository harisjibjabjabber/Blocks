#pragma once

#include <cstddef>
#include <cstdint>

namespace blocks {

// Pinned queue depths. Usable SPSC depth is one less than the capacity.
constexpr size_t kIngestCapacity = 256;
constexpr size_t kAudioQueueCapacity = 256;
constexpr size_t kCaptureQueueCapacity = 4096;
constexpr int kVoiceCount = 16;
constexpr int kMaxChunkBytes = 256;
constexpr uint8_t kDefaultSustainCc = 64;
// Events this far behind the callback are counted and not started.
// This is a drop window so a stall cannot become an overdue burst.
// It is not a latency measurement and not the 1-frame conversion bound.
constexpr int64_t kLateDropGraceNs = 20000000;  // 20 ms

enum class EventOrigin : uint8_t {
  RawMidi = 1,
  Touch = 2,
  SyntheticOverflowRelease = 3,
  SyntheticDisconnectRelease = 4,
  SyntheticLifecycleRelease = 5,
};

enum class MidiKind : uint8_t {
  NoteOn = 1,
  NoteOff = 2,
  ControlChange = 3,
  PitchBend = 4,
  ProgramChange = 5,
  ChannelPressure = 6,
  PolyPressure = 7,
  SystemRealtime = 8,
  SystemCommon = 9,
};

struct ParsedMidi {
  MidiKind kind = MidiKind::SystemCommon;
  uint8_t channel = 0;
  uint8_t data1 = 0;
  uint8_t data2 = 0;
  uint8_t raw[3]{};
  uint8_t rawLength = 0;
  bool runningStatus = false;
  bool velocityZero = false;
};

struct IngestChunk {
  uint8_t bytes[kMaxChunkBytes]{};
  uint16_t length = 0;
  int64_t sourceTimestampNs = 0;
  int64_t receiptTimestampNs = 0;
  bool timestampMissing = false;
  uint32_t portId = 0;
  uint32_t sessionId = 0;
  EventOrigin origin = EventOrigin::RawMidi;
};

struct EngineEvent {
  EventOrigin origin = EventOrigin::RawMidi;
  MidiKind kind = MidiKind::NoteOff;
  uint8_t channel = 0;
  uint8_t data1 = 0;
  uint8_t data2 = 0;
  uint8_t raw[3]{};
  uint8_t rawLength = 0;
  bool velocityZero = false;
  bool timestampMissing = false;
  int64_t sourceTimestampNs = 0;
  int64_t receiptTimestampNs = 0;
  uint64_t sequence = 0;
  uint32_t portId = 0;
  uint32_t sessionId = 0;
  uint32_t streamGeneration = 0;
};

struct FrameMapView {
  uint32_t generation = 0;
  int64_t anchorNs = 0;
  int64_t anchorFrame = 0;
  int32_t sampleRate = 0;
};

}  // namespace blocks
