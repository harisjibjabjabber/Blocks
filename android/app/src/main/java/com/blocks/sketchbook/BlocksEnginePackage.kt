package com.blocks.sketchbook

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BlocksEnginePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    if (name == BlocksEngineModule.NAME) {
      return BlocksEngineModule(reactContext)
    }
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
          BlocksEngineModule.NAME to
              ReactModuleInfo(
                  BlocksEngineModule.NAME,
                  BlocksEngineModule.NAME,
                  false,
                  false,
                  false,
                  false,
              ),
      )
    }
  }
}
