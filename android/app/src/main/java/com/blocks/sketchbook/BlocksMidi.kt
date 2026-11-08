package com.blocks.sketchbook

import android.content.Context
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiManager
import android.media.midi.MidiReceiver
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * MIDI service adapter. Bytes are copied inside [onSend] before the callback
 * returns. Timestamp 0 is the no-timestamp sentinel used by
 * [MidiReceiver.send] without a timestamp (AOSP passes 0L, with a TODO for
 * TIMESTAMP_NONE).
 */
class BlocksMidi(
    context: Context,
    private val onDevices: (String) -> Unit,
) {
  private val midi = context.getSystemService(Context.MIDI_SERVICE) as? MidiManager
  private val handler = Handler(Looper.getMainLooper())
  private val executor = Executors.newSingleThreadExecutor()
  private val generation = AtomicInteger(1)
  private val callback =
      object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
          publish()
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
          if (openInfo?.id == device.id) {
            close(BlocksEngineModule.ORIGIN_DISCONNECT)
          }
          publish()
        }
      }
  private var registered = false
  private var openInfo: MidiDeviceInfo? = null
  private var openDevice: MidiDevice? = null
  private var sessionId = 1

  fun available(): Boolean = midi != null

  fun setSession(id: Int) {
    sessionId = id
  }

  fun startWatching() {
    val manager = midi ?: return
    if (registered) {
      return
    }
    if (Build.VERSION.SDK_INT >= 33) {
      manager.registerDeviceCallback(MidiManager.TRANSPORT_MIDI_BYTE_STREAM, executor, callback)
    } else {
      @Suppress("DEPRECATION")
      manager.registerDeviceCallback(callback, handler)
    }
    registered = true
    publish()
  }

  fun stopWatching() {
    val manager = midi ?: return
    if (!registered) {
      return
    }
    manager.unregisterDeviceCallback(callback)
    registered = false
  }

  fun listJson(): String {
    val devices = devices()
    val parts = devices.map { info ->
      val props = info.properties
      val name = props.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "MIDI"
      val manufacturer = props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER) ?: ""
      val inputs = info.ports.count { it.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT }
      "{\"id\":${info.id},\"name\":${jsonString(name)},\"manufacturer\":${jsonString(manufacturer)},\"inputs\":$inputs}"
    }
    return "[" + parts.joinToString(",") + "]"
  }

  fun openFirstOrId(id: Int, onResult: (Boolean, String) -> Unit) {
    val manager = midi
    if (manager == null) {
      onResult(false, "no MidiManager")
      return
    }
    val devices = devices().filter { info -> info.ports.any { it.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT } }
    val chosen = if (id >= 0) devices.find { it.id == id } else devices.firstOrNull()
    if (chosen == null) {
      onResult(false, "no-device")
      return
    }
    close(BlocksEngineModule.ORIGIN_DISCONNECT)
    val token = generation.get()
    manager.openDevice(chosen, { device ->
      if (device == null || token != generation.get()) {
        device?.close()
        onResult(false, "open failed")
        return@openDevice
      }
      openInfo = chosen
      openDevice = device
      val info = device.info
      for (port in info.ports) {
        if (port.type != MidiDeviceInfo.PortInfo.TYPE_OUTPUT) {
          continue
        }
        val output = device.openOutputPort(port.portNumber) ?: continue
        output.connect(CopyReceiver(token, info.id, port.portNumber))
      }
      onResult(true, propsName(info))
    }, handler)
  }

  fun close(origin: Int) {
    generation.incrementAndGet()
    BlocksNative.nativePanic(origin)
    try {
      openDevice?.close()
    } catch (_: Exception) {
    }
    openDevice = null
    openInfo = null
  }

  fun shutdown() {
    close(BlocksEngineModule.ORIGIN_LIFECYCLE)
    stopWatching()
    executor.shutdownNow()
  }

  private fun publish() {
    onDevices(listJson())
  }

  private fun devices(): List<MidiDeviceInfo> {
    val manager = midi ?: return emptyList()
    return if (Build.VERSION.SDK_INT >= 33) {
      manager.getDevicesForTransport(MidiManager.TRANSPORT_MIDI_BYTE_STREAM).toList()
    } else {
      @Suppress("DEPRECATION")
      manager.devices?.toList() ?: emptyList()
    }
  }

  private fun propsName(info: MidiDeviceInfo): String {
    return info.properties.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "MIDI"
  }

  private inner class CopyReceiver(
      private val token: Int,
      private val portId: Int,
      @Suppress("unused") private val portNumber: Int,
  ) : MidiReceiver() {
    override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
      if (token != generation.get() || count <= 0) {
        return
      }
      val copy = ByteArray(count)
      System.arraycopy(msg, offset, copy, 0, count)
      val receipt = System.nanoTime()
      val missing = timestamp == 0L
      BlocksNative.nativeEnqueue(copy, timestamp, missing, receipt, portId, sessionId, BlocksEngineModule.ORIGIN_RAW)
    }
  }

  private fun jsonString(value: String): String {
    val escaped = value.replace("\\", " ").replace("\"", "'")
    return "\"$escaped\""
  }
}
