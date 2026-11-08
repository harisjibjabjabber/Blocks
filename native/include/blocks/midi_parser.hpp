#pragma once

#include "blocks/events.hpp"

#include <cstddef>
#include <cstdint>

namespace blocks {

int expectedDataLength(int status);

// MIDI 1.0 byte parser. Fragments may span feeds. Running status is honored.
// Realtime bytes (0xF8–0xFF) are emitted without clearing running status.
// System Exclusive is counted and discarded. It is never emitted.
class MidiByteParser {
 public:
  using Emit = void (*)(const ParsedMidi& message, void* user);

  void reset();
  void feed(const uint8_t* data, size_t count, Emit emit, void* user);

  uint32_t sysexBytesIgnored() const { return sysexBytesIgnored_; }
  uint32_t dataBytesIgnored() const { return dataBytesIgnored_; }

 private:
  void consume(uint8_t byte, Emit emit, void* user);
  void emitCurrent(Emit emit, void* user, bool runningStatus);

  int runningStatus_ = 0;
  int status_ = 0;
  int need_ = 0;
  int got_ = 0;
  bool collecting_ = false;
  bool currentUsedRunning_ = false;
  bool inSysex_ = false;
  uint8_t data_[2]{};
  uint32_t sysexBytesIgnored_ = 0;
  uint32_t dataBytesIgnored_ = 0;
};

}  // namespace blocks
