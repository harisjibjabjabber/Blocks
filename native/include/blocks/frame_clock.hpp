#pragma once

#include <cstdint>

namespace blocks {

// Convert a signed nanosecond offset to sample frames.
// Rounding is to nearest, half away from zero via integer half-up.
// The absolute error against the real-valued quotient is at most 0.5 frame,
// which satisfies the 1-frame conversion bound. This is conversion accuracy
// only. It does not measure device latency or clock drift.
inline int64_t nsToFramesNearest(int64_t deltaNs, int32_t sampleRate) {
  if (sampleRate <= 0) {
    return 0;
  }
  const __int128 scale = 1000000000;
  __int128 product = static_cast<__int128>(deltaNs) * static_cast<__int128>(sampleRate);
  const __int128 half = scale / 2;
  if (product >= 0) {
    product += half;
  } else {
    product -= half;
  }
  return static_cast<int64_t>(product / scale);
}

inline int32_t graceFramesFor(int32_t sampleRate) {
  if (sampleRate <= 0) {
    return 0;
  }
  const int64_t frames = nsToFramesNearest(20000000, sampleRate);
  if (frames < 1) {
    return 1;
  }
  if (frames > 100000) {
    return 100000;
  }
  return static_cast<int32_t>(frames);
}

}  // namespace blocks
