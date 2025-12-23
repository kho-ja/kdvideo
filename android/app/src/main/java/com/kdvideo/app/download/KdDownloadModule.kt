package com.kdvideo.app.download

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class KdDownloadModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val stateStore = DownloadStateStore(reactContext)

    override fun getName(): String = "KdDownloadModule"

    override fun initialize() {
        super.initialize()
        DownloadEventEmitter.setReactContext(reactContext)
    }

    override fun invalidate() {
        DownloadEventEmitter.setReactContext(null)
        super.invalidate()
    }

    @ReactMethod
    fun startDownload(url: String, fileName: String?, promise: Promise) {
        if (url.isBlank()) {
            promise.reject("invalid_url", "URL is empty")
            return
        }
        val intent = Intent(reactContext, KdDownloadService::class.java).apply {
            action = KdDownloadService.ACTION_START
            putExtra(KdDownloadService.EXTRA_URL, url)
            putExtra(KdDownloadService.EXTRA_FILENAME, fileName)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
        val dest = DownloadPaths.destinationFile(reactContext, url, fileName)
        promise.resolve(DownloadPaths.toFileUri(dest))
    }

    @ReactMethod
    fun pauseDownload() {
        startServiceWithAction(KdDownloadService.ACTION_PAUSE)
    }

    @ReactMethod
    fun resumeDownload() {
        startServiceWithAction(KdDownloadService.ACTION_RESUME)
    }

    @ReactMethod
    fun cancelDownload() {
        startServiceWithAction(KdDownloadService.ACTION_CANCEL)
    }

    @ReactMethod
    fun getState(promise: Promise) {
        val state = stateStore.load()
        if (state == null) {
            promise.resolve(null)
            return
        }
        promise.resolve(stateToMap(state))
    }

    @ReactMethod
    fun getDownloadDirectory(promise: Promise) {
        val dir = DownloadPaths.downloadsDir(reactContext)
        promise.resolve(DownloadPaths.toFileUri(dir))
    }

    private fun startServiceWithAction(action: String) {
        val intent = Intent(reactContext, KdDownloadService::class.java).apply {
            this.action = action
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    private fun stateToMap(state: DownloadState) = Arguments.createMap().apply {
        putString("status", state.status.value)
        putString("url", state.url)
        putDouble("downloadedBytes", state.downloadedBytes.toDouble())
        putDouble("totalBytes", state.totalBytes.toDouble())
        val progress = if (state.totalBytes > 0) {
            state.downloadedBytes.toDouble() / state.totalBytes.toDouble()
        } else {
            0.0
        }
        putDouble("progress", progress)
        state.destPath?.let { putString("fileUri", DownloadPaths.toFileUri(File(it))) }
        state.lastError?.let { putString("error", it) }
    }
}
