package com.blocks.sketchbook

class BlocksNative {
  companion object {
    init {
      System.loadLibrary("blocksengine")
    }

    @JvmStatic external fun nativeEnqueue(
        bytes: ByteArray,
        sourceNs: Long,
        missing: Boolean,
        receiptNs: Long,
        portId: Int,
        sessionId: Int,
        origin: Int,
    ): Boolean

    @JvmStatic external fun nativeStart(): Boolean

    @JvmStatic external fun nativeStop()

    @JvmStatic external fun nativeSetSustain(cc: Int)

    @JvmStatic external fun nativePanic(origin: Int)

    @JvmStatic external fun nativeReplay(payload: String)

    @JvmStatic external fun nativeStopReplay()

    @JvmStatic external fun nativePoll(): String

    @JvmStatic external fun nativeStats(): String
  }
}
