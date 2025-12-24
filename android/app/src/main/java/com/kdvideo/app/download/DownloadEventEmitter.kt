package com.kdvideo.app.download

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

object DownloadEventEmitter {
    const val EVENT_NAME = "kdDownloadUpdate"
    private var reactContext: ReactApplicationContext? = null

    fun setReactContext(context: ReactApplicationContext?) {
        reactContext = context
    }

    fun emit(state: DownloadState) {
        val context = reactContext ?: return
        if (!context.hasActiveCatalystInstance()) {
            return
        }
        val map = Arguments.createMap()
        map.putString("status", state.status.value)
        map.putDouble("downloadedBytes", state.downloadedBytes.toDouble())
        map.putDouble("totalBytes", state.totalBytes.toDouble())
        val progress = if (state.totalBytes > 0) {
            state.downloadedBytes.toDouble() / state.totalBytes.toDouble()
        } else {
            0.0
        }
        map.putDouble("progress", progress)
        state.url?.let { map.putString("url", it) }
        state.destPath?.let { map.putString("fileUri", DownloadPaths.toFileUri(File(it))) }
        state.lastError?.let { map.putString("error", it) }
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, map)
    }
}
