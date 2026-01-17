import Foundation

enum KdDownloadPaths {

    /// /Documents/downloads
    static func downloadsDirectory() -> URL {
        let fm = FileManager.default

        // Берём Documents (это app sandbox, не "просто downloads")
        let documents = fm.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? fm.temporaryDirectory

        let downloads = documents.appendingPathComponent(
            KdDownloadConstants.downloadsFolderName,
            isDirectory: true
        )

        ensureDirectoryExists(downloads)
        return downloads
    }

    static func destinationURL(url: String?, fileName: String?) -> URL {
        let dir = downloadsDirectory()
        let name = resolveFileName(url: url, fileName: fileName)
        return dir.appendingPathComponent(name, isDirectory: false)
    }

    /// Возвращаем file://... — Expo FileSystem и RN обычно это понимают нормально
    static func fileUri(for url: URL) -> String {
        return url.standardizedFileURL.absoluteString
    }

    // MARK: - Helpers

    static func resolveFileName(url: String?, fileName: String?) -> String {
        let raw = fileName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = (raw?.isEmpty == false ? raw : extractName(from: url)) ?? "download.mp4"

        // sanitize: оставляем безопасные символы
        let sanitized = candidate.replacingOccurrences(
            of: #"[^A-Za-z0-9._-]"#,
            with: "_",
            options: .regularExpression
        )

        return sanitized.isEmpty ? "download.mp4" : sanitized
    }

    private static func extractName(from url: String?) -> String? {
        guard let s = url, !s.isEmpty else { return nil }
        if let parsed = URL(string: s) {
            let name = parsed.lastPathComponent
            return name.isEmpty ? nil : name
        }
        let fallback = s.split(separator: "/").last.map(String.init)
        return (fallback?.isEmpty == false) ? fallback : nil
    }

    private static func ensureDirectoryExists(_ url: URL) {
        let fm = FileManager.default

        var isDir: ObjCBool = false
        if fm.fileExists(atPath: url.path, isDirectory: &isDir) {
            if isDir.boolValue {
                return
            } else {
                // если вдруг файл с таким именем — удалим
                try? fm.removeItem(at: url)
            }
        }

        do {
            try fm.createDirectory(
                at: url,
                withIntermediateDirectories: true,
                attributes: nil
            )
        } catch {
            // если не смогли создать в Documents (редко), fallback в tmp
            // но хотя бы не крашимся
            // (логируй, если нужно)
            // print("Failed to create downloads dir:", error)
        }
    }
}

