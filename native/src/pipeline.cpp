#include "blocks/pipeline.hpp"

#include <cstring>

namespace blocks {
namespace {

EngineEvent makeRelease(const EngineEvent& sounding, EventOrigin origin, uint64_t sequence, uint32_t generation) {
  EngineEvent event;
  event.origin = origin;
  event.kind = MidiKind::NoteOff;
  event.channel = sounding.channel;
  event.data1 = sounding.data1;
  event.data2 = 0;
  event.rawLength = 0;
  event.timestampMissing = true;
  event.sourceTimestampNs = 0;
  event.receiptTimestampNs = sounding.receiptTimestampNs;
  event.sequence = sequence;
  event.portId = sounding.portId;
  event.sessionId = sounding.sessionId;
  event.streamGeneration = generation;
  return event;
}

}  // namespace

bool Pipeline::pushChunk(const uint8_t* data, size_t size, int64_t sourceTimestampNs, bool timestampMissing,
                         int64_t receiptTimestampNs, uint32_t portId, uint32_t sessionId, EventOrigin origin) {
  if (data == nullptr || size == 0) {
    return true;
  }
  bool storedAll = true;
  size_t offset = 0;
  while (offset < size) {
    IngestChunk chunk;
    const size_t length = size - offset > static_cast<size_t>(kMaxChunkBytes) ? static_cast<size_t>(kMaxChunkBytes)
                                                                              : size - offset;
    std::memcpy(chunk.bytes, data + offset, length);
    chunk.length = static_cast<uint16_t>(length);
    chunk.sourceTimestampNs = sourceTimestampNs;
    chunk.receiptTimestampNs = receiptTimestampNs;
    chunk.timestampMissing = timestampMissing;
    chunk.portId = portId;
    chunk.sessionId = sessionId;
    chunk.origin = origin;
    {
      std::lock_guard<std::mutex> lock(ingestMu_);
      if (ingestCount_ >= kIngestCapacity) {
        overflowCount_.fetch_add(1, std::memory_order_relaxed);
        pendingPanic_.store(static_cast<int>(EventOrigin::SyntheticOverflowRelease), std::memory_order_release);
        storedAll = false;
        break;
      }
      ingest_[ingestTail_] = chunk;
      ingestTail_ = (ingestTail_ + 1u) % static_cast<uint32_t>(kIngestCapacity);
      ++ingestCount_;
    }
    offset += length;
  }
  return storedAll;
}

bool Pipeline::popIngest(IngestChunk& chunk) {
  std::lock_guard<std::mutex> lock(ingestMu_);
  if (ingestCount_ == 0) {
    return false;
  }
  chunk = ingest_[ingestHead_];
  ingestHead_ = (ingestHead_ + 1u) % static_cast<uint32_t>(kIngestCapacity);
  --ingestCount_;
  return true;
}

void Pipeline::onParsed(const ParsedMidi& message, void* user) {
  auto* context = static_cast<EmitContext*>(user);
  context->self->acceptParsed(message, *context->chunk);
}

void Pipeline::acceptParsed(const ParsedMidi& message, const IngestChunk& chunk) {
  if (message.kind == MidiKind::SystemRealtime || message.kind == MidiKind::SystemCommon) {
    return;
  }
  EngineEvent event;
  event.origin = chunk.origin;
  event.kind = message.kind;
  event.channel = message.channel;
  event.data1 = message.data1;
  event.data2 = message.data2;
  event.rawLength = message.rawLength;
  if (message.rawLength > 0) {
    std::memcpy(event.raw, message.raw, message.rawLength);
  }
  event.velocityZero = message.velocityZero;
  event.timestampMissing = chunk.timestampMissing;
  event.sourceTimestampNs = chunk.sourceTimestampNs;
  event.receiptTimestampNs = chunk.receiptTimestampNs;
  event.sequence = ++sequence_;
  event.portId = chunk.portId;
  event.sessionId = chunk.sessionId;
  event.streamGeneration = streamGeneration_.load(std::memory_order_acquire);

  const bool reachedAudio = audio_.push(event);
  if (!reachedAudio) {
    overflowCount_.fetch_add(1, std::memory_order_relaxed);
    pendingPanic_.store(static_cast<int>(EventOrigin::SyntheticOverflowRelease), std::memory_order_release);
  } else {
    noteActivity(event, true);
  }
  if (!capture_.push(event)) {
    droppedCapture_.fetch_add(1, std::memory_order_relaxed);
  }
}

void Pipeline::noteActivity(const EngineEvent& event, bool reachedAudio) {
  if (!reachedAudio || event.channel > 15) {
    return;
  }
  if (event.kind == MidiKind::NoteOn && !event.velocityZero && event.data2 > 0) {
    keyDown_[event.channel][event.data1] = true;
    sounding_[event.channel][event.data1] = true;
    return;
  }
  if (event.kind == MidiKind::NoteOff || (event.kind == MidiKind::NoteOn && (event.velocityZero || event.data2 == 0))) {
    keyDown_[event.channel][event.data1] = false;
    if (!pedal_[event.channel]) {
      sounding_[event.channel][event.data1] = false;
    }
    return;
  }
  if (event.kind == MidiKind::ControlChange && event.data1 == sustainCc_) {
    const bool down = event.data2 >= 64;
    if (pedal_[event.channel] && !down) {
      pedal_[event.channel] = false;
      for (int note = 0; note < 128; ++note) {
        if (!keyDown_[event.channel][note]) {
          sounding_[event.channel][note] = false;
        }
      }
    } else {
      pedal_[event.channel] = down;
    }
  }
}

void Pipeline::emitSyntheticReleases(EventOrigin origin) {
  instrumentPanic_.store(true, std::memory_order_release);
  for (uint8_t channel = 0; channel < 16; ++channel) {
    for (uint8_t note = 0; note < 128; ++note) {
      if (!sounding_[channel][note] && !keyDown_[channel][note]) {
        continue;
      }
      EngineEvent basis;
      basis.channel = channel;
      basis.data1 = note;
      basis.receiptTimestampNs = 0;
      basis.portId = 0;
      basis.sessionId = 0;
      EngineEvent release = makeRelease(basis, origin, ++sequence_, streamGeneration_.load(std::memory_order_acquire));
      if (!capture_.push(release)) {
        droppedCapture_.fetch_add(1, std::memory_order_relaxed);
      }
      audio_.push(release);
      sounding_[channel][note] = false;
      keyDown_[channel][note] = false;
    }
    pedal_[channel] = false;
  }
  discontinuityCount_.fetch_add(1, std::memory_order_relaxed);
}

void Pipeline::serializeAvailable() {
  IngestChunk chunk;
  while (popIngest(chunk)) {
    EmitContext context{this, &chunk};
    parser_.feed(chunk.bytes, chunk.length, &Pipeline::onParsed, &context);
  }
  const int panic = pendingPanic_.exchange(0, std::memory_order_acq_rel);
  if (panic != 0) {
    emitSyntheticReleases(static_cast<EventOrigin>(panic));
  }
}

void Pipeline::setStreamGeneration(uint32_t generation) { streamGeneration_.store(generation, std::memory_order_release); }

void Pipeline::setSustainController(uint8_t cc) { sustainCc_ = cc; }

void Pipeline::resetParser() { parser_.reset(); }

void Pipeline::requestPanic(EventOrigin origin) {
  pendingPanic_.store(static_cast<int>(origin), std::memory_order_release);
}

bool Pipeline::peekAudio(EngineEvent& event) { return audio_.peek(event); }

void Pipeline::popAudio() { audio_.pop(); }

bool Pipeline::popCapture(EngineEvent& event) { return capture_.pop(event); }

void Pipeline::setReplay(std::vector<ReplayItem> items, int64_t startNs) {
  std::lock_guard<std::mutex> lock(replayMu_);
  replay_ = std::move(items);
  replayIndex_ = 0;
  replayStartNs_ = startNs;
  replayActive_ = true;
}

void Pipeline::clearReplay() {
  std::lock_guard<std::mutex> lock(replayMu_);
  replay_.clear();
  replayIndex_ = 0;
  replayActive_ = false;
}

void Pipeline::feedReplay(int64_t nowNs) {
  std::lock_guard<std::mutex> lock(replayMu_);
  if (!replayActive_) {
    return;
  }
  constexpr int64_t kLookaheadNs = 80000000;
  constexpr int64_t kLateNs = 40000000;
  while (replayIndex_ < replay_.size()) {
    const ReplayItem& item = replay_[replayIndex_];
    const int64_t when = replayStartNs_ + item.elapsedNs;
    if (when > nowNs + kLookaheadNs) {
      break;
    }
    ++replayIndex_;
    if (when + kLateNs < nowNs) {
      lateCount_.fetch_add(1, std::memory_order_relaxed);
      continue;
    }
    EngineEvent event = item.event;
    event.sourceTimestampNs = when;
    event.receiptTimestampNs = nowNs;
    event.timestampMissing = false;
    event.sequence = ++sequence_;
    event.streamGeneration = streamGeneration_.load(std::memory_order_acquire);
    event.origin = event.origin == EventOrigin::RawMidi ? EventOrigin::RawMidi : event.origin;
    if (!audio_.push(event)) {
      overflowCount_.fetch_add(1, std::memory_order_relaxed);
      pendingPanic_.store(static_cast<int>(EventOrigin::SyntheticOverflowRelease), std::memory_order_release);
      break;
    }
    noteActivity(event, true);
  }
  if (replayIndex_ >= replay_.size()) {
    replayActive_ = false;
  }
}

}  // namespace blocks
