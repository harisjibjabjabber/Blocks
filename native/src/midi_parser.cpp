#include "blocks/midi_parser.hpp"

namespace blocks {

int expectedDataLength(int status) {
  if (status >= 0xF8) {
    return 0;
  }
  switch (status & 0xF0) {
    case 0xC0:
    case 0xD0:
      return 1;
    case 0x80:
    case 0x90:
    case 0xA0:
    case 0xB0:
    case 0xE0:
      return 2;
    default:
      break;
  }
  switch (status) {
    case 0xF1:
    case 0xF3:
      return 1;
    case 0xF2:
      return 2;
    case 0xF6:
      return 0;
    default:
      return -1;
  }
}

void MidiByteParser::reset() {
  runningStatus_ = 0;
  status_ = 0;
  need_ = 0;
  got_ = 0;
  collecting_ = false;
  currentUsedRunning_ = false;
  inSysex_ = false;
}

void MidiByteParser::feed(const uint8_t* data, size_t count, Emit emit, void* user) {
  if (data == nullptr || emit == nullptr) {
    return;
  }
  for (size_t i = 0; i < count; ++i) {
    consume(data[i], emit, user);
  }
}

void MidiByteParser::emitCurrent(Emit emit, void* user, bool runningStatus) {
  ParsedMidi message;
  message.channel = static_cast<uint8_t>(status_ & 0x0F);
  message.data1 = got_ > 0 ? data_[0] : 0;
  message.data2 = got_ > 1 ? data_[1] : 0;
  message.runningStatus = runningStatus;
  message.raw[0] = static_cast<uint8_t>(status_);
  message.rawLength = 1;
  if (got_ > 0) {
    message.raw[1] = data_[0];
    message.rawLength = 2;
  }
  if (got_ > 1) {
    message.raw[2] = data_[1];
    message.rawLength = 3;
  }

  const int high = status_ & 0xF0;
  if (status_ >= 0xF8) {
    message.kind = MidiKind::SystemRealtime;
    message.channel = 0;
  } else if (status_ >= 0xF0) {
    message.kind = MidiKind::SystemCommon;
    message.channel = 0;
  } else if (high == 0x90) {
    message.kind = MidiKind::NoteOn;
    message.velocityZero = message.data2 == 0;
  } else if (high == 0x80) {
    message.kind = MidiKind::NoteOff;
  } else if (high == 0xB0) {
    message.kind = MidiKind::ControlChange;
  } else if (high == 0xE0) {
    message.kind = MidiKind::PitchBend;
  } else if (high == 0xC0) {
    message.kind = MidiKind::ProgramChange;
  } else if (high == 0xD0) {
    message.kind = MidiKind::ChannelPressure;
  } else if (high == 0xA0) {
    message.kind = MidiKind::PolyPressure;
  } else {
    message.kind = MidiKind::SystemCommon;
  }
  emit(message, user);
  collecting_ = false;
  got_ = 0;
}

void MidiByteParser::consume(uint8_t byte, Emit emit, void* user) {
  if (byte >= 0xF8) {
    ParsedMidi message;
    message.kind = MidiKind::SystemRealtime;
    message.raw[0] = byte;
    message.rawLength = 1;
    emit(message, user);
    return;
  }

  if (inSysex_) {
    ++sysexBytesIgnored_;
    if (byte == 0xF7) {
      inSysex_ = false;
    }
    return;
  }

  if (byte == 0xF0) {
    inSysex_ = true;
    ++sysexBytesIgnored_;
    runningStatus_ = 0;
    collecting_ = false;
    got_ = 0;
    return;
  }

  if (byte == 0xF7) {
    runningStatus_ = 0;
    collecting_ = false;
    got_ = 0;
    return;
  }

  if ((byte & 0x80) != 0) {
    const int length = expectedDataLength(byte);
    if (length < 0) {
      runningStatus_ = 0;
      collecting_ = false;
      got_ = 0;
      return;
    }
    status_ = byte;
    need_ = length;
    got_ = 0;
    collecting_ = true;
    currentUsedRunning_ = false;
    if ((byte & 0xF0) != 0xF0) {
      runningStatus_ = byte;
    } else {
      runningStatus_ = 0;
    }
    if (need_ == 0) {
      emitCurrent(emit, user, false);
    }
    return;
  }

  if (!collecting_) {
    if (runningStatus_ == 0) {
      ++dataBytesIgnored_;
      return;
    }
    status_ = runningStatus_;
    need_ = expectedDataLength(runningStatus_);
    got_ = 0;
    collecting_ = true;
    currentUsedRunning_ = true;
    if (need_ < 1) {
      collecting_ = false;
      return;
    }
  }

  if (got_ < 2) {
    data_[got_] = byte;
  }
  ++got_;
  if (got_ >= need_) {
    emitCurrent(emit, user, currentUsedRunning_);
  }
}

}  // namespace blocks
