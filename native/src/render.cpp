#include "blocks/render.hpp"

#include "blocks/frame_clock.hpp"

namespace blocks {
namespace {

void applyEvent(Instrument& instrument, const EngineEvent& event) {
  switch (event.kind) {
    case MidiKind::NoteOn:
      if (event.velocityZero || event.data2 == 0) {
        instrument.noteOff(event.channel, event.data1);
      } else {
        instrument.noteOn(event.channel, event.data1, event.data2);
      }
      break;
    case MidiKind::NoteOff:
      instrument.noteOff(event.channel, event.data1);
      break;
    case MidiKind::ControlChange:
      instrument.control(event.channel, event.data1, event.data2);
      break;
    case MidiKind::PitchBend:
      instrument.pitchBend(event.channel, (static_cast<int>(event.data2) << 7) | event.data1);
      break;
    default:
      break;
  }
}

bool isRelease(const EngineEvent& event) {
  if (event.origin == EventOrigin::SyntheticOverflowRelease || event.origin == EventOrigin::SyntheticDisconnectRelease ||
      event.origin == EventOrigin::SyntheticLifecycleRelease) {
    return true;
  }
  return event.kind == MidiKind::NoteOff || (event.kind == MidiKind::NoteOn && (event.velocityZero || event.data2 == 0));
}

int64_t eventFrame(const EngineEvent& event, const FrameMapView& map) {
  const int64_t timestamp = event.timestampMissing ? event.receiptTimestampNs : event.sourceTimestampNs;
  return map.anchorFrame + nsToFramesNearest(timestamp - map.anchorNs, map.sampleRate);
}

}  // namespace

void renderBlock(Pipeline& pipeline, Instrument& instrument, float* interleavedStereo, int frames, const FrameMapView& map,
                 int64_t startFrame) {
  if (interleavedStereo == nullptr || frames <= 0) {
    return;
  }
  if (pipeline.consumeInstrumentPanic()) {
    instrument.allNotesOff();
  }
  const int32_t grace = graceFramesFor(map.sampleRate);
  int rendered = 0;
  while (rendered < frames) {
    EngineEvent event;
    while (pipeline.peekAudio(event)) {
      if (map.sampleRate <= 0 || event.streamGeneration != map.generation) {
        pipeline.popAudio();
        pipeline.addStale(1);
        continue;
      }
      const int64_t frame = eventFrame(event, map);
      const int64_t relative = frame - startFrame;
      if (relative > rendered) {
        break;
      }
      pipeline.popAudio();
      if (relative < -static_cast<int64_t>(grace)) {
        pipeline.addLate(1);
        if (isRelease(event)) {
          applyEvent(instrument, event);
        }
        continue;
      }
      if (relative < 0) {
        pipeline.addLate(1);
      }
      applyEvent(instrument, event);
    }
    int until = frames;
    if (pipeline.peekAudio(event) && map.sampleRate > 0 && event.streamGeneration == map.generation) {
      const int64_t relative = eventFrame(event, map) - startFrame;
      if (relative > rendered && relative < until) {
        until = static_cast<int>(relative);
      }
    }
    if (until <= rendered) {
      break;
    }
    instrument.render(interleavedStereo + static_cast<size_t>(rendered) * 2, until - rendered);
    rendered = until;
  }
}

}  // namespace blocks
