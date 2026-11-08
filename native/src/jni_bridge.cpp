#include "blocks/oboe_engine.hpp"

#include <jni.h>

#include <cstdint>
#include <cstdio>
#include <sstream>
#include <string>
#include <vector>

namespace {

blocks::EventOrigin originFromInt(int value) {
  switch (value) {
    case 2:
      return blocks::EventOrigin::Touch;
    case 3:
      return blocks::EventOrigin::SyntheticOverflowRelease;
    case 4:
      return blocks::EventOrigin::SyntheticDisconnectRelease;
    case 5:
      return blocks::EventOrigin::SyntheticLifecycleRelease;
    default:
      return blocks::EventOrigin::RawMidi;
  }
}

}  // namespace

extern "C" {

JNIEXPORT jboolean JNICALL Java_com_blocks_sketchbook_BlocksNative_nativeEnqueue(JNIEnv* env, jclass, jbyteArray bytes,
                                                                                jlong sourceNs, jboolean missing, jlong receiptNs,
                                                                                jint portId, jint sessionId, jint origin) {
  if (bytes == nullptr) {
    return JNI_TRUE;
  }
  const jsize length = env->GetArrayLength(bytes);
  if (length <= 0) {
    return JNI_TRUE;
  }
  std::vector<uint8_t> copy(static_cast<size_t>(length));
  env->GetByteArrayRegion(bytes, 0, length, reinterpret_cast<jbyte*>(copy.data()));
  const bool stored = blocks::engine().enqueue(copy.data(), copy.size(), static_cast<int64_t>(sourceNs), missing == JNI_TRUE,
                                               static_cast<int64_t>(receiptNs), static_cast<uint32_t>(portId),
                                               static_cast<uint32_t>(sessionId), originFromInt(origin));
  return stored ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL Java_com_blocks_sketchbook_BlocksNative_nativeStart(JNIEnv*, jclass) {
  return blocks::engine().startAudio() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL Java_com_blocks_sketchbook_BlocksNative_nativeStop(JNIEnv*, jclass) {
  blocks::engine().stopAudio(blocks::EventOrigin::SyntheticLifecycleRelease);
}

JNIEXPORT void JNICALL Java_com_blocks_sketchbook_BlocksNative_nativeSetSustain(JNIEnv*, jclass, jint cc) {
  int value = cc;
  if (value < 0) {
    value = 0;
  }
  if (value > 127) {
    value = 127;
  }
  blocks::engine().setSustainController(static_cast<uint8_t>(value));
}

JNIEXPORT void JNICALL Java_com_blocks_sketchbook_BlocksNative_nativePanic(JNIEnv*, jclass, jint origin) {
  blocks::engine().panic(originFromInt(origin));
}

JNIEXPORT void JNICALL Java_com_blocks_sketchbook_BlocksNative_nativeReplay(JNIEnv* env, jclass, jstring payload) {
  if (payload == nullptr) {
    return;
  }
  const char* chars = env->GetStringUTFChars(payload, nullptr);
  if (chars == nullptr) {
    return;
  }
  std::istringstream input(chars);
  env->ReleaseStringUTFChars(payload, chars);
  std::vector<blocks::ReplayItem> items;
  std::string line;
  while (std::getline(input, line)) {
    if (line.empty()) {
      continue;
    }
    long long elapsed = 0;
    int status = 0;
    int data1 = 0;
    int data2 = 0;
    int channel = 0;
    if (std::sscanf(line.c_str(), "%lld %d %d %d %d", &elapsed, &status, &data1, &data2, &channel) != 5) {
      continue;
    }
    blocks::ReplayItem item;
    item.elapsedNs = static_cast<int64_t>(elapsed);
    item.event.channel = static_cast<uint8_t>(channel & 15);
    item.event.data1 = static_cast<uint8_t>(data1 & 127);
    item.event.data2 = static_cast<uint8_t>(data2 & 127);
    item.event.origin = blocks::EventOrigin::RawMidi;
    item.event.raw[0] = static_cast<uint8_t>(status & 0xFF);
    item.event.raw[1] = item.event.data1;
    item.event.raw[2] = item.event.data2;
    item.event.rawLength = 3;
    const int high = status & 0xF0;
    if (high == 0x90 && data2 > 0) {
      item.event.kind = blocks::MidiKind::NoteOn;
    } else if (high == 0x90 || high == 0x80) {
      item.event.kind = high == 0x80 ? blocks::MidiKind::NoteOff : blocks::MidiKind::NoteOn;
      item.event.velocityZero = data2 == 0;
    } else if (high == 0xB0) {
      item.event.kind = blocks::MidiKind::ControlChange;
    } else if (high == 0xE0) {
      item.event.kind = blocks::MidiKind::PitchBend;
    } else {
      continue;
    }
    items.push_back(item);
  }
  blocks::engine().replay(items);
}

JNIEXPORT void JNICALL Java_com_blocks_sketchbook_BlocksNative_nativeStopReplay(JNIEnv*, jclass) {
  blocks::engine().stopReplay();
}

JNIEXPORT jstring JNICALL Java_com_blocks_sketchbook_BlocksNative_nativePoll(JNIEnv* env, jclass) {
  const std::string json = blocks::engine().pollCapture(48);
  return env->NewStringUTF(json.c_str());
}

JNIEXPORT jstring JNICALL Java_com_blocks_sketchbook_BlocksNative_nativeStats(JNIEnv* env, jclass) {
  const blocks::EngineStats stats = blocks::engine().stats();
  std::ostringstream out;
  out << "{\"preset\":\"blocks.ep.fm.v1\",\"audioRunning\":" << (stats.audioRunning ? "true" : "false")
      << ",\"sampleRate\":" << stats.sampleRate << ",\"sharingMode\":" << stats.sharingMode
      << ",\"performanceMode\":" << stats.performanceMode << ",\"xruns\":" << stats.xruns
      << ",\"generation\":" << stats.generation << ",\"overflow\":" << stats.overflow
      << ",\"discontinuity\":" << stats.discontinuity << ",\"late\":" << stats.late << ",\"stale\":" << stats.stale
      << ",\"droppedCapture\":" << stats.droppedCapture << ",\"voices\":" << stats.voices << ",\"audioError\":\"";
  for (char character : stats.audioError) {
    if (character == '"' || character == '\\') {
      out << ' ';
    } else {
      out << character;
    }
  }
  out << "\"}";
  return env->NewStringUTF(out.str().c_str());
}

}
