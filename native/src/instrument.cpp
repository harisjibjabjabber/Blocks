#include "blocks/instrument.hpp"

#include "blocks/ep_preset.hpp"

#include <cmath>
#include <cstddef>

namespace blocks {
namespace {

constexpr float kTwoPi = 6.28318530718f;

float outputGainLinear() {
  return std::pow(10.f, ep_fm::kOutputGainDb / 20.f);
}

float samplesFor(float seconds, int32_t sampleRate) {
  const float count = seconds * static_cast<float>(sampleRate);
  return count < 1.f ? 1.f : count;
}

}  // namespace

void Instrument::prepare(int32_t sampleRate) {
  if (sampleRate < 8000) {
    sampleRate = 8000;
  }
  sampleRate_ = sampleRate;
  for (int velocity = 0; velocity < 128; ++velocity) {
    const float unit = static_cast<float>(velocity) / 127.f;
    velocityGain_[velocity] = std::pow(unit, ep_fm::kVelocityCurve);
  }
  for (int channel = 0; channel < 16; ++channel) {
    expression_[channel] = 127;
    pitchBend_[channel] = 8192;
    pedal_[channel] = false;
  }
}

void Instrument::setSustainController(uint8_t cc) { sustainCc_ = cc; }

float Instrument::noteFrequency(int note, int channel) const {
  const int bend = pitchBend_[channel] - 8192;
  const float semis = (static_cast<float>(note - 69) +
                       (static_cast<float>(bend) / 8192.f) * static_cast<float>(ep_fm::kPitchBendSemitoneRange));
  return ep_fm::kTuningA4Hz * std::pow(2.f, semis / 12.f);
}

Instrument::Voice* Instrument::findVoice(int channel, int note) {
  for (auto& voice : voices_) {
    if (voice.stage != Idle && voice.channel == channel && voice.note == note) {
      return &voice;
    }
  }
  return nullptr;
}

Instrument::Voice* Instrument::allocateVoice() {
  for (auto& voice : voices_) {
    if (voice.stage == Idle) {
      return &voice;
    }
  }
  Voice* steal = &voices_[0];
  for (auto& voice : voices_) {
    const bool voiceRelease = voice.stage == Release;
    const bool stealRelease = steal->stage == Release;
    if (voiceRelease && !stealRelease) {
      steal = &voice;
    } else if (voiceRelease == stealRelease && voice.amp < steal->amp) {
      steal = &voice;
    } else if (voice.amp == steal->amp && voice.age < steal->age) {
      steal = &voice;
    }
  }
  return steal;
}

void Instrument::startAttack(Voice& voice, int channel, int note, int velocity) {
  if (velocity < 1) {
    velocity = 1;
  }
  if (velocity > 127) {
    velocity = 127;
  }
  voice.stage = Attack;
  voice.channel = channel;
  voice.note = note;
  voice.keyDown = true;
  voice.pedalHeld = false;
  voice.carrier = 0.f;
  voice.modulator = 0.f;
  voice.amp = 0.f;
  voice.velocityGain = velocityGain_[velocity];
  voice.peakIndex = ep_fm::kModIndexAtFullVelocity * (0.35f + 0.65f * velocityGain_[velocity]);
  voice.modEnv = voice.peakIndex;
  voice.ampInc = (1.f - voice.amp) / samplesFor(ep_fm::kAttackSeconds, sampleRate_);
  voice.modInc = 0.f;
  voice.age = ageCounter_++;
}

void Instrument::beginRelease(Voice& voice) {
  voice.stage = Release;
  voice.keyDown = false;
  voice.pedalHeld = false;
  const float releaseSamples = samplesFor(ep_fm::kReleaseSeconds, sampleRate_);
  voice.ampInc = voice.amp > 0.f ? -voice.amp / releaseSamples : -1.f;
  voice.modInc = voice.modEnv > ep_fm::kModIndexSustain ? -(voice.modEnv - ep_fm::kModIndexSustain) / releaseSamples : 0.f;
}

void Instrument::noteOn(int channel, int note, int velocity) {
  if (channel < 0 || channel > 15 || note < 0 || note > 127) {
    return;
  }
  if (velocity <= 0) {
    noteOff(channel, note);
    return;
  }
  Voice* voice = findVoice(channel, note);
  if (voice == nullptr) {
    voice = allocateVoice();
  }
  startAttack(*voice, channel, note, velocity);
}

void Instrument::noteOff(int channel, int note) {
  Voice* voice = findVoice(channel, note);
  if (voice == nullptr) {
    return;
  }
  voice->keyDown = false;
  if (pedal_[channel]) {
    voice->pedalHeld = true;
    if (voice->stage == Attack) {
      voice->stage = Decay;
    }
    return;
  }
  beginRelease(*voice);
}

void Instrument::control(int channel, int controller, int value) {
  if (channel < 0 || channel > 15) {
    return;
  }
  if (value < 0) {
    value = 0;
  }
  if (value > 127) {
    value = 127;
  }
  if (controller == sustainCc_) {
    const bool down = value >= 64;
    if (pedal_[channel] && !down) {
      pedal_[channel] = false;
      for (auto& voice : voices_) {
        if (voice.stage != Idle && voice.channel == channel && voice.pedalHeld && !voice.keyDown) {
          beginRelease(voice);
        }
      }
    } else {
      pedal_[channel] = down;
    }
    return;
  }
  if (controller == 11) {
    expression_[channel] = static_cast<uint8_t>(value);
  }
}

void Instrument::pitchBend(int channel, int value14) {
  if (channel < 0 || channel > 15) {
    return;
  }
  if (value14 < 0) {
    value14 = 0;
  }
  if (value14 > 16383) {
    value14 = 16383;
  }
  pitchBend_[channel] = value14;
}

void Instrument::allNotesOff() {
  for (auto& voice : voices_) {
    voice = Voice{};
  }
  for (int channel = 0; channel < 16; ++channel) {
    pedal_[channel] = false;
  }
}

int Instrument::activeCount() const {
  int count = 0;
  for (const auto& voice : voices_) {
    if (voice.stage != Idle) {
      ++count;
    }
  }
  return count;
}

bool Instrument::voiceHeld(int channel, int note) const {
  for (const auto& voice : voices_) {
    if (voice.stage != Idle && voice.channel == channel && voice.note == note) {
      return true;
    }
  }
  return false;
}

int Instrument::voiceStage(int channel, int note) const {
  for (const auto& voice : voices_) {
    if (voice.stage != Idle && voice.channel == channel && voice.note == note) {
      return static_cast<int>(voice.stage);
    }
  }
  return static_cast<int>(Idle);
}

void Instrument::render(float* interleavedStereo, int frames) {
  if (interleavedStereo == nullptr || frames <= 0 || sampleRate_ <= 0) {
    return;
  }
  const float gain = outputGainLinear();
  const float tremoloInc = kTwoPi * ep_fm::kTremoloRateHz / static_cast<float>(sampleRate_);
  const float decaySamples = samplesFor(ep_fm::kDecaySeconds, sampleRate_);

  for (int frame = 0; frame < frames; ++frame) {
    const float tremolo = 1.f - ep_fm::kTremoloDepth + ep_fm::kTremoloDepth * (0.5f + 0.5f * std::sin(tremoloPhase_));
    tremoloPhase_ += tremoloInc;
    if (tremoloPhase_ > kTwoPi) {
      tremoloPhase_ -= kTwoPi;
    }
    float mix = 0.f;
    for (auto& voice : voices_) {
      if (voice.stage == Idle) {
        continue;
      }
      const float frequency = noteFrequency(voice.note, voice.channel);
      const float carrierInc = kTwoPi * frequency / static_cast<float>(sampleRate_);
      const float modInc = carrierInc * ep_fm::kModulatorRatio;
      const float modulated = std::sin(voice.carrier + voice.modEnv * std::sin(voice.modulator));
      voice.carrier += carrierInc;
      voice.modulator += modInc;
      if (voice.carrier > kTwoPi) {
        voice.carrier -= kTwoPi;
      }
      if (voice.modulator > kTwoPi) {
        voice.modulator -= kTwoPi;
      }

      voice.amp += voice.ampInc;
      voice.modEnv += voice.modInc;
      if (voice.stage == Attack && voice.amp >= 1.f) {
        voice.amp = 1.f;
        voice.stage = Decay;
        voice.ampInc = (ep_fm::kSustainLevel - 1.f) / decaySamples;
        voice.modInc = (ep_fm::kModIndexSustain - voice.modEnv) / decaySamples;
      } else if (voice.stage == Decay && voice.amp <= ep_fm::kSustainLevel) {
        voice.amp = ep_fm::kSustainLevel;
        voice.modEnv = ep_fm::kModIndexSustain;
        voice.stage = Sustain;
        voice.ampInc = 0.f;
        voice.modInc = 0.f;
      } else if (voice.stage == Release && voice.amp <= 0.f) {
        voice = Voice{};
        continue;
      }

      const float expression = static_cast<float>(expression_[voice.channel]) / 127.f;
      mix += modulated * voice.amp * voice.velocityGain * expression * tremolo;
    }
    float shaped = mix * gain * 0.35f;
    if (shaped > 1.f) {
      shaped = 1.f;
    } else if (shaped < -1.f) {
      shaped = -1.f;
    }
    interleavedStereo[frame * 2] = shaped;
    interleavedStereo[frame * 2 + 1] = shaped;
  }
}

}  // namespace blocks
