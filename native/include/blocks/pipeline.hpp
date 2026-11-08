#pragma once

#include "blocks/events.hpp"
#include "blocks/midi_parser.hpp"
#include "blocks/spsc_queue.hpp"

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <mutex>
#include <vector>

namespace blocks {

struct ReplayItem {
  int64_t elapsedNs = 0;
  EngineEvent event{};
};

// Multi-producer ingest, then one serializer thread owns parsing and is the
// only producer of the audio and capture SPSC queues. The audio callback is
// the consumer of the audio queue and must not take the ingest mutex.
class Pipeline {
 public:
  bool pushChunk(const uint8_t* data, size_t size, int64_t sourceTimestampNs, bool timestampMissing,
                 int64_t receiptTimestampNs, uint32_t portId, uint32_t sessionId, EventOrigin origin);

  void serializeAvailable();
  void setStreamGeneration(uint32_t generation);
  void setSustainController(uint8_t cc);
  void resetParser();
  void requestPanic(EventOrigin origin);

  bool peekAudio(EngineEvent& event);
  void popAudio();
  bool popCapture(EngineEvent& event);

  void setReplay(std::vector<ReplayItem> items, int64_t startNs);
  void clearReplay();
  void feedReplay(int64_t nowNs);

  uint64_t overflowCount() const { return overflowCount_.load(std::memory_order_acquire); }
  uint64_t discontinuityCount() const { return discontinuityCount_.load(std::memory_order_acquire); }
  uint64_t droppedCaptureCount() const { return droppedCapture_.load(std::memory_order_acquire); }
  uint64_t lateCount() const { return lateCount_.load(std::memory_order_acquire); }
  uint64_t staleCount() const { return staleCount_.load(std::memory_order_acquire); }
  bool instrumentPanicPending() const { return instrumentPanic_.load(std::memory_order_acquire); }
  bool consumeInstrumentPanic() { return instrumentPanic_.exchange(false, std::memory_order_acq_rel); }
  void addLate(uint64_t count) { lateCount_.fetch_add(count, std::memory_order_relaxed); }
  void addStale(uint64_t count) { staleCount_.fetch_add(count, std::memory_order_relaxed); }
  uint8_t sustainController() const { return sustainCc_; }
  uint32_t sysexBytesIgnored() const { return parser_.sysexBytesIgnored(); }

 private:
  struct EmitContext {
    Pipeline* self;
    const IngestChunk* chunk;
  };

  static void onParsed(const ParsedMidi& message, void* user);
  void acceptParsed(const ParsedMidi& message, const IngestChunk& chunk);
  void noteActivity(const EngineEvent& event, bool reachedAudio);
  void emitSyntheticReleases(EventOrigin origin);
  bool popIngest(IngestChunk& chunk);

  MidiByteParser parser_;
  std::mutex ingestMu_;
  IngestChunk ingest_[kIngestCapacity]{};
  uint32_t ingestHead_ = 0;
  uint32_t ingestTail_ = 0;
  uint32_t ingestCount_ = 0;

  SpscQueue<EngineEvent, kAudioQueueCapacity> audio_;
  SpscQueue<EngineEvent, kCaptureQueueCapacity> capture_;

  bool sounding_[16][128]{};
  bool keyDown_[16][128]{};
  bool pedal_[16]{};
  uint8_t sustainCc_ = kDefaultSustainCc;
  uint64_t sequence_ = 0;
  std::atomic<uint32_t> streamGeneration_{1};

  std::mutex replayMu_;
  std::vector<ReplayItem> replay_;
  size_t replayIndex_ = 0;
  int64_t replayStartNs_ = 0;
  bool replayActive_ = false;

  std::atomic<uint64_t> overflowCount_{0};
  std::atomic<uint64_t> discontinuityCount_{0};
  std::atomic<uint64_t> droppedCapture_{0};
  std::atomic<uint64_t> lateCount_{0};
  std::atomic<uint64_t> staleCount_{0};
  std::atomic<bool> instrumentPanic_{false};
  std::atomic<int> pendingPanic_{0};
};

}  // namespace blocks
