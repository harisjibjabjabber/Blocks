#include "blocks/ep_preset.hpp"
#include "blocks/frame_clock.hpp"
#include "blocks/instrument.hpp"
#include "blocks/midi_parser.hpp"
#include "blocks/pipeline.hpp"
#include "blocks/render.hpp"

#include <cmath>
#include <cstring>
#include <iostream>
#include <thread>
#include <vector>

namespace {

int g_failures = 0;

void check(bool condition, const char* text, int line) {
  if (!condition) {
    std::cerr << "FAIL " << line << " " << text << "\n";
    ++g_failures;
  }
}

#define CHECK(cond) check((cond), #cond, __LINE__)

struct Collected {
  std::vector<blocks::ParsedMidi> messages;
};

void collect(const blocks::ParsedMidi& message, void* user) {
  static_cast<Collected*>(user)->messages.push_back(message);
}

void feedBytes(blocks::MidiByteParser& parser, Collected& out, std::initializer_list<uint8_t> bytes) {
  const std::vector<uint8_t> data(bytes);
  parser.feed(data.data(), data.size(), collect, &out);
}

std::vector<blocks::EngineEvent> drainCapture(blocks::Pipeline& pipeline) {
  std::vector<blocks::EngineEvent> events;
  blocks::EngineEvent event;
  while (pipeline.popCapture(event)) {
    events.push_back(event);
  }
  return events;
}

void pushNote(blocks::Pipeline& pipeline, uint8_t note, uint8_t velocity, int64_t timestamp) {
  const uint8_t bytes[] = {0x90, note, velocity};
  pipeline.pushChunk(bytes, 3, timestamp, false, timestamp, 1, 1, blocks::EventOrigin::RawMidi);
}

float energy(const float* buffer, int frames) {
  double sum = 0.0;
  for (int i = 0; i < frames * 2; ++i) {
    sum += std::fabs(buffer[i]);
  }
  return static_cast<float>(sum);
}

void testParser() {
  blocks::MidiByteParser parser;
  Collected out;
  feedBytes(parser, out, {0x90});
  feedBytes(parser, out, {0x3C, 0x40});
  CHECK(out.messages.size() == 1);
  CHECK(out.messages[0].kind == blocks::MidiKind::NoteOn);
  CHECK(out.messages[0].data1 == 60);
  CHECK(out.messages[0].data2 == 64);
  CHECK(out.messages[0].rawLength == 3);
  CHECK(out.messages[0].raw[0] == 0x90);

  out.messages.clear();
  parser.reset();
  feedBytes(parser, out, {0x90, 0x3C, 0x40, 0x3E, 0x20});
  CHECK(out.messages.size() == 2);
  CHECK(out.messages[1].runningStatus);
  CHECK(out.messages[1].data1 == 62);
  CHECK(out.messages[1].raw[0] == 0x90);

  out.messages.clear();
  parser.reset();
  feedBytes(parser, out, {0x90, 0x3C, 0x00});
  CHECK(out.messages.size() == 1);
  CHECK(out.messages[0].velocityZero);
  CHECK(out.messages[0].raw[2] == 0x00);

  out.messages.clear();
  parser.reset();
  feedBytes(parser, out, {0x90, 0xF8, 0x3C, 0x40});
  CHECK(out.messages.size() == 2);
  CHECK(out.messages[0].kind == blocks::MidiKind::SystemRealtime);
  CHECK(out.messages[1].kind == blocks::MidiKind::NoteOn);
  CHECK(out.messages[1].data1 == 60);

  out.messages.clear();
  parser.reset();
  feedBytes(parser, out, {0xF0, 0x01});
  feedBytes(parser, out, {0x02, 0xF7, 0x90, 0x3C, 0x40});
  CHECK(parser.sysexBytesIgnored() >= 4);
  CHECK(out.messages.size() == 1);
  CHECK(out.messages[0].kind == blocks::MidiKind::NoteOn);
  CHECK(out.messages[0].raw[0] != 0xF0);

  out.messages.clear();
  parser.reset();
  feedBytes(parser, out, {0xB0, 0x40, 0x7F});
  CHECK(out.messages.size() == 1);
  CHECK(out.messages[0].kind == blocks::MidiKind::ControlChange);
  CHECK(out.messages[0].data1 == 64);
  CHECK(out.messages[0].data2 == 127);

  out.messages.clear();
  parser.reset();
  feedBytes(parser, out, {0x90, 0x3C, 0x40});
  parser.reset();
  feedBytes(parser, out, {0x3E, 0x40});
  CHECK(out.messages.size() == 1);
  CHECK(parser.dataBytesIgnored() >= 2);
}

void testInstrument() {
  CHECK(std::string(blocks::ep_fm::kPresetId) == "blocks.ep.fm.v1");
  blocks::Instrument instrument;
  instrument.prepare(48000);
  instrument.noteOn(0, 60, 100);
  instrument.noteOn(0, 60, 80);
  CHECK(instrument.activeCount() == 1);
  CHECK(instrument.voiceStage(0, 60) == 1);

  instrument.noteOff(0, 60);
  CHECK(instrument.voiceStage(0, 60) == 4);

  instrument.noteOn(0, 64, 110);
  instrument.control(0, 64, 127);
  instrument.noteOff(0, 64);
  CHECK(instrument.voiceHeld(0, 64));
  instrument.control(0, 64, 0);
  CHECK(instrument.voiceStage(0, 64) == 4);

  blocks::Instrument loud;
  blocks::Instrument quiet;
  loud.prepare(48000);
  quiet.prepare(48000);
  loud.noteOn(0, 67, 120);
  quiet.noteOn(0, 67, 8);
  std::vector<float> loudBuffer(4800 * 2);
  std::vector<float> quietBuffer(4800 * 2);
  loud.render(loudBuffer.data(), 4800);
  quiet.render(quietBuffer.data(), 4800);
  CHECK(energy(loudBuffer.data(), 4800) > energy(quietBuffer.data(), 4800));

  blocks::Instrument pedal;
  pedal.prepare(48000);
  pedal.noteOn(0, 60, 100);
  pedal.control(0, 64, 127);
  pedal.noteOff(0, 60);
  std::vector<float> held(2400 * 2);
  pedal.render(held.data(), 2400);
  CHECK(energy(held.data(), 2400) > 1.f);
}

void testFrames() {
  CHECK(blocks::nsToFramesNearest(1000000000, 48000) == 48000);
  CHECK(blocks::nsToFramesNearest(-1000000000, 48000) == -48000);
  CHECK(blocks::nsToFramesNearest(3600LL * 1000000000LL, 48000) == 48000LL * 3600LL);
  const int32_t rates[] = {44100, 48000, 96000};
  const int64_t deltas[] = {0, 1, 17, 20833, 1000003, -20833, 123456789, 5000000000LL};
  for (int32_t rate : rates) {
    for (int64_t delta : deltas) {
      const long double exact = (static_cast<long double>(delta) * rate) / 1000000000.0L;
      const int64_t got = blocks::nsToFramesNearest(delta, rate);
      const long double error = fabsl(static_cast<long double>(got) - exact);
      CHECK(error <= 0.5L + 1e-6L);
    }
  }
}

void testPipeline() {
  blocks::Pipeline pipeline;
  pipeline.setStreamGeneration(3);
  const uint8_t first[] = {0x90};
  const uint8_t rest[] = {0x3C, 0x40};
  pipeline.pushChunk(first, 1, 1000, false, 1100, 4, 9, blocks::EventOrigin::RawMidi);
  pipeline.pushChunk(rest, 2, 1000, false, 1200, 4, 9, blocks::EventOrigin::RawMidi);
  pipeline.serializeAvailable();
  const auto fragmented = drainCapture(pipeline);
  CHECK(fragmented.size() == 1);
  CHECK(fragmented[0].data1 == 60);
  CHECK(fragmented[0].rawLength == 3);
  CHECK(fragmented[0].sourceTimestampNs == 1000);
  CHECK(fragmented[0].receiptTimestampNs == 1200);
  CHECK(fragmented[0].portId == 4);
  CHECK(fragmented[0].sessionId == 9);
  CHECK(fragmented[0].streamGeneration == 3);
  CHECK(fragmented[0].origin == blocks::EventOrigin::RawMidi);

  const uint8_t running[] = {0x90, 0x3C, 0x40, 0x3E, 0x10};
  pipeline.pushChunk(running, sizeof(running), 50, false, 60, 4, 9, blocks::EventOrigin::RawMidi);
  pipeline.serializeAvailable();
  const auto pair = drainCapture(pipeline);
  CHECK(pair.size() == 2);
  CHECK(pair[0].sequence < pair[1].sequence);
  CHECK(pair[0].sourceTimestampNs == pair[1].sourceTimestampNs);

  const uint8_t zero[] = {0x90, 0x3C, 0x00};
  pipeline.pushChunk(zero, 3, 70, false, 80, 4, 9, blocks::EventOrigin::RawMidi);
  pipeline.serializeAvailable();
  const auto zeroEvents = drainCapture(pipeline);
  CHECK(zeroEvents.size() == 1);
  CHECK(zeroEvents[0].velocityZero);
  CHECK(zeroEvents[0].raw[0] == 0x90);

  const uint8_t repeat[] = {0x90, 0x40, 0x20, 0x40, 0x30};
  pipeline.pushChunk(repeat, sizeof(repeat), 90, false, 91, 4, 9, blocks::EventOrigin::RawMidi);
  pipeline.serializeAvailable();
  const auto repeats = drainCapture(pipeline);
  CHECK(repeats.size() == 2);
  CHECK(repeats[0].data1 == repeats[1].data1);

  const uint8_t pedal[] = {0xB0, 0x40, 0x7F};
  pipeline.pushChunk(pedal, 3, 100, false, 101, 4, 9, blocks::EventOrigin::RawMidi);
  pipeline.serializeAvailable();
  const auto pedalEvents = drainCapture(pipeline);
  CHECK(pedalEvents.size() == 1);
  CHECK(pedalEvents[0].kind == blocks::MidiKind::ControlChange);

  const uint8_t missing[] = {0x90, 0x3C, 0x40};
  pipeline.pushChunk(missing, 3, 0, true, 500, 4, 9, blocks::EventOrigin::RawMidi);
  pipeline.serializeAvailable();
  const auto missingEvents = drainCapture(pipeline);
  CHECK(missingEvents.size() == 1);
  CHECK(missingEvents[0].timestampMissing);

  blocks::Pipeline overflow;
  for (uint32_t i = 0; i < blocks::kIngestCapacity; ++i) {
    pushNote(overflow, static_cast<uint8_t>(i % 128), 40, 1000 + i);
  }
  const uint8_t extra[] = {0x90, 0x02, 0x40};
  CHECK(!overflow.pushChunk(extra, 3, 99999, false, 99999, 1, 1, blocks::EventOrigin::RawMidi));
  overflow.serializeAvailable();
  const auto overflowEvents = drainCapture(overflow);
  int synthetic = 0;
  int raw = 0;
  for (const auto& event : overflowEvents) {
    if (event.origin == blocks::EventOrigin::SyntheticOverflowRelease) {
      ++synthetic;
      CHECK(event.rawLength == 0);
    } else {
      ++raw;
      CHECK(event.rawLength == 3);
      CHECK(event.origin == blocks::EventOrigin::RawMidi);
    }
  }
  CHECK(raw > 0);
  CHECK(synthetic > 0);
  CHECK(overflow.discontinuityCount() >= 1);
  CHECK(overflow.overflowCount() >= 1);

  blocks::Pipeline disconnect;
  pushNote(disconnect, 60, 100, 10);
  disconnect.serializeAvailable();
  drainCapture(disconnect);
  disconnect.requestPanic(blocks::EventOrigin::SyntheticDisconnectRelease);
  disconnect.serializeAvailable();
  const auto released = drainCapture(disconnect);
  CHECK(!released.empty());
  CHECK(released[0].origin == blocks::EventOrigin::SyntheticDisconnectRelease);
  CHECK(released[0].rawLength == 0);
}

void testRenderTiming() {
  blocks::Pipeline pipeline;
  blocks::Instrument instrument;
  instrument.prepare(48000);
  pipeline.setStreamGeneration(1);
  const int64_t timestamp = 2083333;
  CHECK(blocks::nsToFramesNearest(timestamp, 48000) == 100);
  pushNote(pipeline, 60, 110, timestamp);
  pipeline.serializeAvailable();
  blocks::FrameMapView map;
  map.generation = 1;
  map.anchorNs = 0;
  map.anchorFrame = 0;
  map.sampleRate = 48000;
  std::vector<float> buffer(256 * 2, 0.f);
  blocks::renderBlock(pipeline, instrument, buffer.data(), 256, map, 0);
  CHECK(energy(buffer.data(), 100) < 0.001f);
  CHECK(energy(buffer.data() + 200, 156) > 0.01f);

  blocks::Pipeline stale;
  blocks::Instrument silent;
  silent.prepare(48000);
  stale.setStreamGeneration(1);
  pushNote(stale, 60, 110, 0);
  stale.serializeAvailable();
  map.generation = 2;
  std::vector<float> quiet(128 * 2, 0.f);
  blocks::renderBlock(stale, silent, quiet.data(), 128, map, 0);
  CHECK(energy(quiet.data(), 128) == 0.f);
  CHECK(stale.staleCount() >= 1);

  blocks::Pipeline late;
  blocks::Instrument lateInstrument;
  lateInstrument.prepare(48000);
  late.setStreamGeneration(1);
  pushNote(late, 72, 100, 0);
  late.serializeAvailable();
  map.generation = 1;
  std::vector<float> skipped(64 * 2, 0.f);
  blocks::renderBlock(late, lateInstrument, skipped.data(), 64, map, 48000);
  CHECK(late.lateCount() >= 1);
  CHECK(energy(skipped.data(), 64) == 0.f);
}

void testProducers() {
  blocks::Pipeline pipeline;
  auto worker = [&pipeline](uint8_t noteBase) {
    for (int i = 0; i < 50; ++i) {
      pushNote(pipeline, static_cast<uint8_t>(noteBase + (i % 20)), 50, 1000 + i);
    }
  };
  std::thread a(worker, 10);
  std::thread b(worker, 40);
  a.join();
  b.join();
  pipeline.serializeAvailable();
  const auto events = drainCapture(pipeline);
  CHECK(events.size() == 100);
}

}  // namespace

int main() {
  testParser();
  testInstrument();
  testFrames();
  testPipeline();
  testRenderTiming();
  testProducers();
  if (g_failures != 0) {
    std::cerr << g_failures << " failure(s)\n";
    return 1;
  }
  std::cout << "native host tests passed\n";
  return 0;
}
