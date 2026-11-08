#pragma once

#include "blocks/events.hpp"
#include "blocks/instrument.hpp"
#include "blocks/pipeline.hpp"

namespace blocks {

// Audio-callback body. No allocation, locks, IO, JNI, or stream closure.
// The caller zeros nothing: this function overwrites the buffer.
void renderBlock(Pipeline& pipeline, Instrument& instrument, float* interleavedStereo, int frames, const FrameMapView& map,
                 int64_t startFrame);

}  // namespace blocks
