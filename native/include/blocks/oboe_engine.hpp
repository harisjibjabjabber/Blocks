#pragma once

#include "blocks/events.hpp"
#include "blocks/pipeline.hpp"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace blocks {

struct EngineStats {
  bool audioRunning = false;
  int32_t sampleRate = 0;
  int32_t sharingMode = -1;
  int32_t performanceMode = -1;
  int32_t xruns = 0;
  uint32_t generation = 0;
  uint64_t overflow = 0;
  uint64_t discontinuity = 0;
  uint64_t late = 0;
  uint64_t stale = 0;
  uint64_t droppedCapture = 0;
  int voices = 0;
  std::string audioError;
};

class OboeEngine {
 public:
  OboeEngine();
  ~OboeEngine();
  OboeEngine(const OboeEngine&) = delete;
  OboeEngine& operator=(const OboeEngine&) = delete;

  bool enqueue(const uint8_t* data, size_t size, int64_t sourceNs, bool missing, int64_t receiptNs, uint32_t portId,
               uint32_t sessionId, EventOrigin origin);
  bool startAudio();
  void stopAudio(EventOrigin releaseOrigin);
  void setSustainController(uint8_t cc);
  void panic(EventOrigin origin);
  void replay(const std::vector<ReplayItem>& items);
  void stopReplay();
  std::string pollCapture(int maxEvents);
  EngineStats stats();

 private:
  struct Impl;
  Impl* impl_;
};

OboeEngine& engine();

}  // namespace blocks
