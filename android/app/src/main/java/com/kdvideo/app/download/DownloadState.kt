package com.kdvideo.app.download

enum class DownloadStatus(val value: String) {
    IDLE("idle"),
    DOWNLOADING("downloading"),
    PAUSED("paused"),
    COMPLETED("completed"),
    ERROR("error");

    companion object {
        fun fromValue(value: String?): DownloadStatus {
            return values().firstOrNull { it.value == value } ?: IDLE
        }
    }
}

data class DownloadState(
    val url: String? = null,
    val destPath: String? = null,
    val tempPath: String? = null,
    val downloadedBytes: Long = 0,
    val totalBytes: Long = 0,
    val status: DownloadStatus = DownloadStatus.IDLE,
    val lastError: String? = null
)
