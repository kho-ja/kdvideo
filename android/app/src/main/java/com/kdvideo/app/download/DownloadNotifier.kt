package com.kdvideo.app.download

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.kdvideo.app.MainActivity
import com.kdvideo.app.R

class DownloadNotifier(private val context: Context) {
    companion object {
        const val CHANNEL_ID = "kdvideo_downloads"
        const val NOTIFICATION_ID = 4001
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Downloads",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Background downloads"
            setSound(null, null)
        }
        notificationManager.createNotificationChannel(channel)
    }

    fun buildNotification(state: DownloadState): Notification {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = when (state.status) {
            DownloadStatus.DOWNLOADING -> "Downloading video"
            DownloadStatus.PAUSED -> "Download paused"
            DownloadStatus.COMPLETED -> "Download complete"
            DownloadStatus.ERROR -> "Download failed"
            else -> "Download idle"
        }

        val content = when (state.status) {
            DownloadStatus.DOWNLOADING -> formatProgress(state)
            DownloadStatus.PAUSED -> "Paused"
            DownloadStatus.COMPLETED -> "Saved to device"
            DownloadStatus.ERROR -> state.lastError ?: "Download error"
            else -> "Ready"
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(content)
            .setContentIntent(pendingIntent)
            .setOnlyAlertOnce(true)
            .setOngoing(state.status == DownloadStatus.DOWNLOADING)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)

        if (state.totalBytes > 0) {
            val progress = ((state.downloadedBytes * 100) / state.totalBytes).toInt().coerceIn(0, 100)
            builder.setProgress(100, progress, false)
        } else if (state.status == DownloadStatus.DOWNLOADING) {
            builder.setProgress(0, 0, true)
        } else {
            builder.setProgress(0, 0, false)
        }

        return builder.build()
    }

    fun update(state: DownloadState) {
        notificationManager.notify(NOTIFICATION_ID, buildNotification(state))
    }

    private fun formatProgress(state: DownloadState): String {
        if (state.totalBytes <= 0) {
            return "Downloading..."
        }
        return "${formatBytes(state.downloadedBytes)} / ${formatBytes(state.totalBytes)}"
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt()
        val value = bytes / Math.pow(1024.0, digitGroups.toDouble())
        val rounded = if (value >= 10) value.toInt().toString() else String.format("%.1f", value)
        return "$rounded ${units[digitGroups]}"
    }
}
