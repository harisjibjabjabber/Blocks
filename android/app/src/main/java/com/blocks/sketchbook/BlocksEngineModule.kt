package com.blocks.sketchbook

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class BlocksEngineModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    LifecycleEventListener,
    AudioManager.OnAudioFocusChangeListener {
  private val midi = BlocksMidi(reactContext) { json -> emit("blocksMidiDevices", json) }
  private val audio = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var focusRequest: AudioFocusRequest? = null
  private var sessionId = 1

  override fun getName(): String = NAME

  override fun initialize() {
    super.initialize()
    reactContext.addLifecycleEventListener(this)
    midi.startWatching()
  }

  override fun invalidate() {
    midi.shutdown()
    abandonFocus()
    reactContext.removeLifecycleEventListener(this)
    super.invalidate()
  }

  @ReactMethod
  fun start(promise: Promise) {
    val focus = requestFocus()
    val audioOk = if (focus) BlocksNative.nativeStart() else false
    midi.setSession(sessionId)
    midi.openFirstOrId(-1) { opened, detail ->
      val stats = BlocksNative.nativeStats()
      val midiState = if (opened) "open" else detail
      promise.resolve(
          "{\"audio\":" + (if (audioOk) "true" else "false") +
              ",\"focus\":" + (if (focus) "true" else "false") +
              ",\"midi\":\"" + midiState.replace("\"", "'") +
              "\",\"stats\":" + stats + "}",
      )
    }
  }

  @ReactMethod
  fun stop() {
    BlocksNative.nativeStop()
    midi.close(ORIGIN_LIFECYCLE)
    abandonFocus()
  }

  @ReactMethod
  fun touch(note: Double, velocity: Double, down: Boolean) {
    val midiNote = note.toInt().coerceIn(0, 127)
    val vel = if (down) velocity.toInt().coerceIn(1, 127) else 0
    val status = if (down && vel > 0) 0x90 else 0x80
    val bytes = byteArrayOf(status.toByte(), midiNote.toByte(), vel.toByte())
    val now = System.nanoTime()
    BlocksNative.nativeEnqueue(bytes, now, false, now, TOUCH_PORT, sessionId, ORIGIN_TOUCH)
  }

  @ReactMethod
  fun setSustain(cc: Double) {
    BlocksNative.nativeSetSustain(cc.toInt())
  }

  @ReactMethod
  fun panic(origin: Double) {
    BlocksNative.nativePanic(origin.toInt())
  }

  @ReactMethod
  fun replay(payload: String) {
    BlocksNative.nativeReplay(payload)
  }

  @ReactMethod
  fun stopReplay() {
    BlocksNative.nativeStopReplay()
  }

  @ReactMethod
  fun poll(): String = BlocksNative.nativePoll()

  @ReactMethod
  fun stats(): String = BlocksNative.nativeStats()

  @ReactMethod
  fun listDevices(): String = midi.listJson()

  @ReactMethod
  fun openDevice(id: Double, promise: Promise) {
    midi.openFirstOrId(id.toInt()) { opened, detail ->
      promise.resolve(if (opened) detail else detail)
    }
  }

  @ReactMethod
  fun closeDevice() {
    midi.close(ORIGIN_DISCONNECT)
  }

  @ReactMethod
  fun readProject(): String {
    val file = File(reactContext.filesDir, "blocks-project.json")
    return if (file.exists()) file.readText() else ""
  }

  @ReactMethod
  fun writeProject(json: String) {
    File(reactContext.filesDir, "blocks-project.json").writeText(json)
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  override fun onHostResume() = Unit

  override fun onHostPause() {
    BlocksNative.nativeStop()
    abandonFocus()
  }

  override fun onHostDestroy() {
    midi.shutdown()
    abandonFocus()
  }

  override fun onAudioFocusChange(focusChange: Int) {
    when (focusChange) {
      AudioManager.AUDIOFOCUS_LOSS,
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
        BlocksNative.nativeStop()
        emit("blocksAudioFocus", "{\"state\":\"lost\"}")
      }
      AudioManager.AUDIOFOCUS_GAIN -> emit("blocksAudioFocus", "{\"state\":\"gained\"}")
    }
  }

  private fun requestFocus(): Boolean {
    val attributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
    val request =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(this)
            .setWillPauseWhenDucked(true)
            .setAcceptsDelayedFocusGain(false)
            .build()
    focusRequest = request
    val result = audio.requestAudioFocus(request)
    return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
  }

  private fun abandonFocus() {
    val request = focusRequest ?: return
    audio.abandonAudioFocusRequest(request)
    focusRequest = null
  }

  private fun emit(name: String, body: String) {
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, body)
  }

  companion object {
    const val NAME = "BlocksEngine"
    const val ORIGIN_RAW = 1
    const val ORIGIN_TOUCH = 2
    const val ORIGIN_DISCONNECT = 4
    const val ORIGIN_LIFECYCLE = 5
    const val TOUCH_PORT = -1
  }
}
