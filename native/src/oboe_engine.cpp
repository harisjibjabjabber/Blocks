#include "blocks/oboe_engine.hpp"

#include "blocks/frame_clock.hpp"
#include "blocks/render.hpp"

#include <oboe/Oboe.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstring>
#include <mutex>
#include <sstream>
#include <thread>
#include <time.h>

namespace blocks {
namespace {

int64_t monotonicNs() {
  timespec now{};
  clock_gettime(CLOCK_MONOTONIC, &now);
  return static_cast<int64_t>(now.tv_sec) * 1000000000LL + now.tv_nsec;
}

struct MapStore {
  std::atomic<uint32_t> seq{0};
  FrameMapView view{};

  void publish(const FrameMapView& next) {
    const uint32_t start = seq.load(std::memory_order_relaxed);
    seq.store(start + 1, std::memory_order_release);
    view = next;
    seq.store(start + 2, std::memory_order_release);
  }

  bool read(FrameMapView& out) const {
    for (int attempt = 0; attempt < 8; ++attempt) {
      const uint32_t first = seq.load(std::memory_order_acquire);
      if ((first & 1u) != 0u) {
        continue;
      }
      const FrameMapView copy = view;
      const uint32_t second = seq.load(std::memory_order_acquire);
      if (first == second) {
        out = copy;
        return true;
      }
    }
    return false;
  }
};

const char* originName(EventOrigin origin) {
  switch (origin) {
    case EventOrigin::RawMidi:
      return "raw-midi";
    case EventOrigin::Touch:
      return "touch";
    case EventOrigin::SyntheticOverflowRelease:
      return "synthetic-overflow";
    case EventOrigin::SyntheticDisconnectRelease:
      return "synthetic-disconnect";
    case EventOrigin::SyntheticLifecycleRelease:
      return "synthetic-lifecycle";
  }
  return "raw-midi";
}

const char* kindName(MidiKind kind) {
  switch (kind) {
    case MidiKind::NoteOn:
      return "note-on";
    case MidiKind::NoteOff:
      return "note-off";
    case MidiKind::ControlChange:
      return "cc";
    case MidiKind::PitchBend:
      return "pitch";
    case MidiKind::ProgramChange:
      return "program";
    case MidiKind::ChannelPressure:
      return "pressure";
    case MidiKind::PolyPressure:
      return "poly";
    default:
      return "other";
  }
}

}  // namespace

struct OboeEngine::Impl : public oboe::AudioStreamDataCallback, public oboe::AudioStreamErrorCallback {
  Pipeline pipeline;
  Instrument instrument;
  MapStore map;
  std::shared_ptr<oboe::AudioStream> stream;
  std::mutex audioMu;
  std::mutex waitMu;
  std::condition_variable waitCv;
  std::thread thread;
  std::atomic<bool> running{true};
  std::atomic<bool> restart{false};
  std::atomic<bool> audioRunning{false};
  std::atomic<int32_t> sampleRate{0};
  std::atomic<int32_t> sharingMode{-1};
  std::atomic<int32_t> performanceMode{-1};
  std::atomic<uint32_t> generation{1};
  std::atomic<int64_t> framesRendered{0};
  std::string audioError;
  uint8_t sustainCc = kDefaultSustainCc;

  Impl() {
    instrument.prepare(48000);
    instrument.setSustainController(sustainCc);
    pipeline.setSustainController(sustainCc);
    pipeline.setStreamGeneration(generation.load());
    thread = std::thread([this] { threadMain(); });
  }

  ~Impl() {
    running.store(false);
    waitCv.notify_all();
    if (thread.joinable()) {
      thread.join();
    }
    std::lock_guard<std::mutex> lock(audioMu);
    closeStreamLocked();
  }

  void closeStreamLocked() {
    if (stream) {
      stream->requestStop();
      stream->close();
      stream.reset();
    }
    audioRunning.store(false);
  }

  void publishMapLocked(int32_t rate) {
    FrameMapView view;
    view.generation = generation.load();
    view.anchorNs = monotonicNs();
    view.anchorFrame = 0;
    view.sampleRate = rate;
    framesRendered.store(0);
    map.publish(view);
    pipeline.setStreamGeneration(view.generation);
  }

  bool openAndStartLocked() {
    closeStreamLocked();
    generation.fetch_add(1);
    instrument.allNotesOff();
    instrument.setSustainController(sustainCc);

    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output);
    builder.setPerformanceMode(oboe::PerformanceMode::LowLatency);
    builder.setSharingMode(oboe::SharingMode::Exclusive);
    builder.setFormat(oboe::AudioFormat::Float);
    builder.setChannelCount(2);
    builder.setUsage(oboe::Usage::Media);
    builder.setContentType(oboe::ContentType::Music);
    builder.setDataCallback(this);
    builder.setErrorCallback(this);
    std::shared_ptr<oboe::AudioStream> opened;
    const oboe::Result result = builder.openStream(opened);
    if (result != oboe::Result::OK || opened == nullptr) {
      audioError = std::string("openStream ") + oboe::convertToText(result);
      audioRunning.store(false);
      return false;
    }
    const int32_t rate = opened->getSampleRate();
    if (rate <= 0) {
      audioError = "sample rate unavailable";
      opened->close();
      return false;
    }
    instrument.prepare(rate);
    sampleRate.store(rate);
    sharingMode.store(static_cast<int32_t>(opened->getSharingMode()));
    performanceMode.store(static_cast<int32_t>(opened->getPerformanceMode()));
    publishMapLocked(rate);
    const oboe::Result started = opened->requestStart();
    if (started != oboe::Result::OK) {
      audioError = std::string("requestStart ") + oboe::convertToText(started);
      opened->close();
      audioRunning.store(false);
      return false;
    }
    stream = opened;
    audioError.clear();
    audioRunning.store(true);
    return true;
  }

  void threadMain() {
    while (running.load()) {
      if (restart.exchange(false)) {
        std::lock_guard<std::mutex> lock(audioMu);
        openAndStartLocked();
      }
      pipeline.serializeAvailable();
      pipeline.feedReplay(monotonicNs());
      std::unique_lock<std::mutex> lock(waitMu);
      waitCv.wait_for(lock, std::chrono::milliseconds(2));
    }
  }

  oboe::DataCallbackResult onAudioReady(oboe::AudioStream* audioStream, void* audioData, int32_t numFrames) override {
    auto* output = static_cast<float*>(audioData);
    if (output == nullptr || numFrames <= 0) {
      return oboe::DataCallbackResult::Continue;
    }
    const int channels = audioStream != nullptr ? audioStream->getChannelCount() : 2;
    if (channels != 2) {
      std::memset(output, 0, static_cast<size_t>(numFrames) * static_cast<size_t>(channels) * sizeof(float));
      framesRendered.fetch_add(numFrames);
      return oboe::DataCallbackResult::Continue;
    }
    FrameMapView view;
    if (!map.read(view)) {
      std::memset(output, 0, static_cast<size_t>(numFrames) * 2u * sizeof(float));
      framesRendered.fetch_add(numFrames);
      return oboe::DataCallbackResult::Continue;
    }
    const int64_t start = framesRendered.load(std::memory_order_relaxed);
    renderBlock(pipeline, instrument, output, numFrames, view, start);
    framesRendered.store(start + numFrames, std::memory_order_relaxed);
    return oboe::DataCallbackResult::Continue;
  }

  void onErrorAfterClose(oboe::AudioStream*, oboe::Result error) override {
    audioRunning.store(false);
    audioError = std::string("stream closed ") + oboe::convertToText(error);
    restart.store(true);
    waitCv.notify_all();
  }
};

OboeEngine::OboeEngine() : impl_(new Impl()) {}

OboeEngine::~OboeEngine() { delete impl_; }

bool OboeEngine::enqueue(const uint8_t* data, size_t size, int64_t sourceNs, bool missing, int64_t receiptNs, uint32_t portId,
                         uint32_t sessionId, EventOrigin origin) {
  const bool stored = impl_->pipeline.pushChunk(data, size, sourceNs, missing, receiptNs, portId, sessionId, origin);
  impl_->waitCv.notify_all();
  return stored;
}

bool OboeEngine::startAudio() {
  std::lock_guard<std::mutex> lock(impl_->audioMu);
  return impl_->openAndStartLocked();
}

void OboeEngine::stopAudio(EventOrigin releaseOrigin) {
  impl_->pipeline.requestPanic(releaseOrigin);
  impl_->waitCv.notify_all();
  std::lock_guard<std::mutex> lock(impl_->audioMu);
  impl_->generation.fetch_add(1);
  impl_->closeStreamLocked();
  impl_->instrument.allNotesOff();
}

void OboeEngine::setSustainController(uint8_t cc) {
  impl_->sustainCc = cc;
  impl_->pipeline.setSustainController(cc);
  impl_->instrument.setSustainController(cc);
}

void OboeEngine::panic(EventOrigin origin) {
  impl_->pipeline.requestPanic(origin);
  impl_->waitCv.notify_all();
}

void OboeEngine::replay(const std::vector<ReplayItem>& items) {
  impl_->pipeline.setReplay(items, monotonicNs() + 5000000);
  impl_->waitCv.notify_all();
}

void OboeEngine::stopReplay() { impl_->pipeline.clearReplay(); }

std::string OboeEngine::pollCapture(int maxEvents) {
  if (maxEvents < 1) {
    maxEvents = 1;
  }
  if (maxEvents > 64) {
    maxEvents = 64;
  }
  std::ostringstream out;
  out << "[";
  bool first = true;
  for (int i = 0; i < maxEvents; ++i) {
    EngineEvent event;
    if (!impl_->pipeline.popCapture(event)) {
      break;
    }
    if (!first) {
      out << ",";
    }
    first = false;
    out << "{\"origin\":\"" << originName(event.origin) << "\",\"kind\":\"" << kindName(event.kind) << "\",\"channel\":"
        << static_cast<int>(event.channel) << ",\"note\":" << static_cast<int>(event.data1)
        << ",\"velocity\":" << static_cast<int>(event.data2) << ",\"controller\":" << static_cast<int>(event.data1)
        << ",\"value\":" << static_cast<int>(event.data2) << ",\"velocityZero\":" << (event.velocityZero ? "true" : "false")
        << ",\"missing\":" << (event.timestampMissing ? "true" : "false") << ",\"source\":\"" << event.sourceTimestampNs
        << "\",\"receipt\":\"" << event.receiptTimestampNs << "\",\"sequence\":\"" << event.sequence << "\",\"port\":\""
        << event.portId << "\",\"session\":\"" << event.sessionId << "\",\"generation\":" << event.streamGeneration
        << ",\"raw\":[";
    for (uint8_t b = 0; b < event.rawLength; ++b) {
      if (b > 0) {
        out << ",";
      }
      out << static_cast<int>(event.raw[b]);
    }
    out << "]}";
  }
  out << "]";
  return out.str();
}

EngineStats OboeEngine::stats() {
  EngineStats stats;
  stats.audioRunning = impl_->audioRunning.load();
  stats.sampleRate = impl_->sampleRate.load();
  stats.sharingMode = impl_->sharingMode.load();
  stats.performanceMode = impl_->performanceMode.load();
  stats.generation = impl_->generation.load();
  stats.overflow = impl_->pipeline.overflowCount();
  stats.discontinuity = impl_->pipeline.discontinuityCount();
  stats.late = impl_->pipeline.lateCount();
  stats.stale = impl_->pipeline.staleCount();
  stats.droppedCapture = impl_->pipeline.droppedCaptureCount();
  stats.voices = impl_->instrument.activeCount();
  stats.audioError = impl_->audioError;
  std::lock_guard<std::mutex> lock(impl_->audioMu);
  if (impl_->stream) {
    const auto xruns = impl_->stream->getXRunCount();
    if (xruns) {
      stats.xruns = xruns.value();
    }
  }
  return stats;
}

OboeEngine& engine() {
  static OboeEngine instance;
  return instance;
}

}  // namespace blocks
