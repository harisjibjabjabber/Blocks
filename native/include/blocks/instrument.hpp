#pragma once

#include <atomic>
#include <cstdint>

namespace blocks {

// blocks.ep.fm.v1 — procedural FM electric piano.
// No samples. Android and the web build are separate implementations of the
// same preset id and the public parameter values in ep_preset.hpp.
// Output is not claimed to be bit-identical across platforms, and it has
// not been auditioned as a product sign-off.
class Instrument {
 public:
  void prepare(int32_t sampleRate);
  void setSustainController(uint8_t cc);
  void noteOn(int channel, int note, int velocity);
  void noteOff(int channel, int note);
  void control(int channel, int controller, int value);
  void pitchBend(int channel, int value14);
  void allNotesOff();
  void render(float* interleavedStereo, int frames);

  int activeCount() const;
  bool voiceHeld(int channel, int note) const;
  int voiceStage(int channel, int note) const;
  uint8_t sustainController() const { return sustainCc_; }

 private:
  enum Stage : int { Idle = 0, Attack = 1, Decay = 2, Sustain = 3, Release = 4 };

  struct Voice {
    Stage stage = Idle;
    int channel = 0;
    int note = 0;
    bool keyDown = false;
    bool pedalHeld = false;
    float carrier = 0.f;
    float modulator = 0.f;
    float amp = 0.f;
    float ampInc = 0.f;
    float modEnv = 0.f;
    float modInc = 0.f;
    float velocityGain = 0.f;
    float peakIndex = 0.f;
    uint32_t age = 0;
  };

  Voice* findVoice(int channel, int note);
  Voice* allocateVoice();
  void startAttack(Voice& voice, int channel, int note, int velocity);
  void beginRelease(Voice& voice);
  float noteFrequency(int note, int channel) const;

  Voice voices_[16]{};
  bool pedal_[16]{};
  uint8_t expression_[16]{};
  int pitchBend_[16]{};
  float velocityGain_[128]{};
  int32_t sampleRate_ = 48000;
  uint8_t sustainCc_ = 64;
  uint32_t ageCounter_ = 1;
  float tremoloPhase_ = 0.f;
};

}  // namespace blocks
