package com.kdvideo.app.download

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.os.SystemClock
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

class KdDownloadService : Service() {
    companion object {
        const val ACTION_START = "com.kdvideo.app.download.START"
        const val ACTION_PAUSE = "com.kdvideo.app.download.PAUSE"
        const val ACTION_RESUME = "com.kdvideo.app.download.RESUME"
        const val ACTION_CANCEL = "com.kdvideo.app.download.CANCEL"

        const val EXTRA_URL = "extra_url"
        const val EXTRA_FILENAME = "extra_filename"
    }

    private val stateStore by lazy { DownloadStateStore(this) }
    private val notifier by lazy { DownloadNotifier(this) }
    private val executor = Executors.newSingleThreadExecutor()
    private val client = OkHttpClient.Builder().retryOnConnectionFailure(true).build()
    private val sequence = AtomicLong(0)
    private val stateLock = Any()

    @Volatile
    private var activeJobId: Long = 0

    @Volatile
    private var currentCall: Call? = null

    @Volatile
    private var pauseRequested = false

    @Volatile
    private var cancelRequested = false

    private var currentState: DownloadState = DownloadState()

    override fun onCreate() {
        super.onCreate()
        notifier.ensureChannel()
        currentState = stateStore.load() ?: DownloadState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(DownloadNotifier.NOTIFICATION_ID, notifier.buildNotification(currentState))

        when (intent?.action) {
            ACTION_START -> {
                val url = intent.getStringExtra(EXTRA_URL)
                if (!url.isNullOrBlank()) {
                    startNewDownload(url, intent.getStringExtra(EXTRA_FILENAME))
                }
            }
            ACTION_PAUSE -> pauseDownload()
            ACTION_RESUME -> resumeDownload()
            ACTION_CANCEL -> cancelDownload()
            else -> {
                if (currentState.status == DownloadStatus.DOWNLOADING) {
                    resumeDownload()
                }
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        executor.shutdownNow()
    }

    private fun startNewDownload(url: String, fileName: String?) {
        pauseRequested = false
        cancelRequested = false
        currentCall?.cancel()

        val destFile = DownloadPaths.destinationFile(this, url, fileName)
        val tempFile = DownloadPaths.tempFile(destFile)
        val state = DownloadState(
            url = url,
            destPath = destFile.absolutePath,
            tempPath = tempFile.absolutePath,
            downloadedBytes = 0,
            totalBytes = 0,
            status = DownloadStatus.DOWNLOADING
        )

        updateState(state, persist = true)
        queueDownload(state, resetFiles = true)
    }

    private fun resumeDownload() {
        val state = synchronized(stateLock) { currentState }
        val url = state.url ?: return
        val destPath = state.destPath ?: return
        val tempPath = state.tempPath ?: return

        pauseRequested = false
        cancelRequested = false
        currentCall?.cancel()

        val tempFile = File(tempPath)
        val existingBytes = if (tempFile.exists()) tempFile.length() else 0L
        val updated = state.copy(
            url = url,
            destPath = destPath,
            tempPath = tempPath,
            downloadedBytes = existingBytes,
            status = DownloadStatus.DOWNLOADING,
            lastError = null
        )

        updateState(updated, persist = true)
        queueDownload(updated, resetFiles = false)
    }

    private fun pauseDownload() {
        pauseRequested = true
        cancelRequested = false
        currentCall?.cancel()
        updateState(currentState.copy(status = DownloadStatus.PAUSED), persist = true)
    }

    private fun cancelDownload() {
        cancelRequested = true
        pauseRequested = false
        val call = currentCall
        call?.cancel()
        if (call == null) {
            cleanupAfterCancel(currentState)
        }
    }

    private fun queueDownload(state: DownloadState, resetFiles: Boolean) {
        val jobId = sequence.incrementAndGet()
        activeJobId = jobId
        executor.execute { performDownload(jobId, state, resetFiles) }
    }

    private fun performDownload(jobId: Long, state: DownloadState, resetFiles: Boolean) {
        val url = state.url ?: return
        val destPath = state.destPath ?: return
        val tempPath = state.tempPath ?: return
        val destFile = File(destPath)
        val tempFile = File(tempPath)

        if (resetFiles) {
            tempFile.delete()
            destFile.delete()
        }

        var downloadedBytes = if (tempFile.exists()) tempFile.length() else 0L
        var totalBytes = state.totalBytes

        val requestBuilder = Request.Builder().url(url)
        if (downloadedBytes > 0) {
            requestBuilder.addHeader("Range", "bytes=$downloadedBytes-")
        }

        val call = client.newCall(requestBuilder.build())
        currentCall = call

        try {
            val response = call.execute()
            response.use { resp ->
                if (!resp.isSuccessful) {
                    throw IOException("HTTP ${resp.code}")
                }
                val body = resp.body ?: throw IOException("Empty response body")

                if (resp.code == 200 && downloadedBytes > 0) {
                    downloadedBytes = 0
                    tempFile.delete()
                }

                totalBytes = resolveTotalBytes(resp, downloadedBytes)
                updateState(
                    state.copy(
                        downloadedBytes = downloadedBytes,
                        totalBytes = totalBytes,
                        status = DownloadStatus.DOWNLOADING,
                        lastError = null
                    ),
                    persist = true
                )

                val buffer = ByteArray(64 * 1024)
                var lastNotify = 0L
                var lastPersist = 0L
                val input = body.byteStream()
                FileOutputStream(tempFile, downloadedBytes > 0).use { output ->
                    while (true) {
                        if (activeJobId != jobId) {
                            return
                        }
                        if (pauseRequested || cancelRequested) {
                            break
                        }
                        val read = input.read(buffer)
                        if (read == -1) {
                            break
                        }
                        output.write(buffer, 0, read)
                        downloadedBytes += read

                        val now = SystemClock.elapsedRealtime()
                        val shouldNotify = now - lastNotify > 500
                        val shouldPersist = now - lastPersist > 1500
                        if (shouldNotify || shouldPersist) {
                            updateState(
                                state.copy(
                                    downloadedBytes = downloadedBytes,
                                    totalBytes = totalBytes,
                                    status = DownloadStatus.DOWNLOADING,
                                    lastError = null
                                ),
                                persist = shouldPersist
                            )
                            if (shouldNotify) {
                                lastNotify = now
                            }
                            if (shouldPersist) {
                                lastPersist = now
                            }
                        }
                    }
                }
            }

            if (activeJobId != jobId) {
                return
            }

            when {
                cancelRequested -> {
                    cleanupAfterCancel(state)
                    return
                }
                pauseRequested -> {
                    updateState(
                        state.copy(
                            downloadedBytes = downloadedBytes,
                            totalBytes = totalBytes,
                            status = DownloadStatus.PAUSED,
                            lastError = null
                        ),
                        persist = true
                    )
                    return
                }
            }

            if (tempFile.exists()) {
                if (destFile.exists()) {
                    destFile.delete()
                }
                tempFile.renameTo(destFile)
            }

            updateState(
                state.copy(
                    downloadedBytes = downloadedBytes,
                    totalBytes = totalBytes,
                    status = DownloadStatus.COMPLETED,
                    lastError = null
                ),
                persist = true
            )
            stopForeground(false)
            stopSelf()
        } catch (error: IOException) {
            if (activeJobId != jobId) {
                return
            }
            if (call.isCanceled) {
                when {
                    cancelRequested -> cleanupAfterCancel(state)
                    pauseRequested -> updateState(
                        state.copy(
                            downloadedBytes = downloadedBytes,
                            totalBytes = totalBytes,
                            status = DownloadStatus.PAUSED,
                            lastError = null
                        ),
                        persist = true
                    )
                }
                return
            }
            updateState(
                state.copy(
                    downloadedBytes = downloadedBytes,
                    totalBytes = totalBytes,
                    status = DownloadStatus.ERROR,
                    lastError = error.message ?: "Download error"
                ),
                persist = true
            )
        } finally {
            currentCall = null
        }
    }

    private fun cleanupAfterCancel(state: DownloadState) {
        state.tempPath?.let { File(it).delete() }
        state.destPath?.let { File(it).delete() }
        updateState(DownloadState(status = DownloadStatus.IDLE), persist = true)
        stateStore.clear()
        stopForeground(true)
        stopSelf()
    }

    private fun resolveTotalBytes(response: Response, downloaded: Long): Long {
        val contentRange = response.header("Content-Range")
        val parsed = parseTotalBytes(contentRange)
        if (parsed > 0) {
            return parsed
        }
        val length = response.body?.contentLength() ?: -1
        if (length <= 0) {
            return 0
        }
        return if (response.code == 206) downloaded + length else length
    }

    private fun parseTotalBytes(contentRange: String?): Long {
        if (contentRange.isNullOrBlank()) {
            return -1
        }
        val slashIndex = contentRange.lastIndexOf('/')
        if (slashIndex == -1 || slashIndex == contentRange.length - 1) {
            return -1
        }
        val total = contentRange.substring(slashIndex + 1)
        return total.toLongOrNull() ?: -1
    }

    private fun updateState(state: DownloadState, persist: Boolean) {
        synchronized(stateLock) {
            currentState = state
        }
        if (persist) {
            stateStore.save(state)
        }
        notifier.update(state)
        DownloadEventEmitter.emit(state)
    }
}
