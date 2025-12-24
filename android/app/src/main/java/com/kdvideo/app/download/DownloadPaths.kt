package com.kdvideo.app.download

import android.content.Context
import android.net.Uri
import java.io.File

object DownloadPaths {
    private const val DOWNLOADS_DIR = "downloads"
    private val nameRegex = Regex("[^A-Za-z0-9._-]")

    fun downloadsDir(context: Context): File {
        val dir = File(context.filesDir, DOWNLOADS_DIR)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun resolveFileName(url: String?, fileName: String?): String {
        val raw = fileName?.trim().takeUnless { it.isNullOrEmpty() } ?: extractName(url) ?: "download.mp4"
        val sanitized = raw.replace(nameRegex, "_")
        return if (sanitized.isBlank()) "download.mp4" else sanitized
    }

    fun destinationFile(context: Context, url: String?, fileName: String?): File {
        val dir = downloadsDir(context)
        return File(dir, resolveFileName(url, fileName))
    }

    fun tempFile(destFile: File): File {
        return File(destFile.absolutePath + ".part")
    }

    fun toFileUri(file: File): String {
        return "file://${file.absolutePath}"
    }

    private fun extractName(url: String?): String? {
        if (url.isNullOrBlank()) {
            return null
        }
        return try {
            val parsed = Uri.parse(url)
            parsed.lastPathSegment?.takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            url.substringAfterLast('/', "")
        }
    }
}
