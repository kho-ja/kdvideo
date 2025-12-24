package com.kdvideo.app.download

import android.content.Context
import org.json.JSONObject
import java.io.File

class DownloadStateStore(context: Context) {
    private val stateFile = File(context.filesDir, "kd_download_state.json")
    private val lock = Any()

    fun load(): DownloadState? = synchronized(lock) {
        if (!stateFile.exists()) {
            return null
        }
        return try {
            val raw = stateFile.readText()
            val json = JSONObject(raw)
            DownloadState(
                url = json.optString("url", null),
                destPath = json.optString("destPath", null),
                tempPath = json.optString("tempPath", null),
                downloadedBytes = json.optLong("downloadedBytes", 0),
                totalBytes = json.optLong("totalBytes", 0),
                status = DownloadStatus.fromValue(json.optString("status", null)),
                lastError = json.optString("lastError", null)
            )
        } catch (_: Exception) {
            null
        }
    }

    fun save(state: DownloadState) = synchronized(lock) {
        val json = JSONObject().apply {
            put("url", state.url)
            put("destPath", state.destPath)
            put("tempPath", state.tempPath)
            put("downloadedBytes", state.downloadedBytes)
            put("totalBytes", state.totalBytes)
            put("status", state.status.value)
            put("lastError", state.lastError)
        }
        val tmp = File(stateFile.absolutePath + ".tmp")
        tmp.writeText(json.toString())
        if (stateFile.exists()) {
            stateFile.delete()
        }
        tmp.renameTo(stateFile)
    }

    fun clear() = synchronized(lock) {
        if (stateFile.exists()) {
            stateFile.delete()
        }
    }
}
