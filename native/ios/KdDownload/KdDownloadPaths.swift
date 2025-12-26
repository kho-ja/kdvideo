import Foundation

enum KdDownloadPaths {
    static func downloadsDirectory() -> URL {
        let fileManager = FileManager.default
        let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first
        let downloads = (documents ?? fileManager.temporaryDirectory)
            .appendingPathComponent(KdDownloadConstants.downloadsFolderName, isDirectory: true)
        if !fileManager.fileExists(atPath: downloads.path) {
            try? fileManager.createDirectory(at: downloads, withIntermediateDirectories: true)
        }
        return downloads
    }

    static func resolveFileName(url: String?, fileName: String?) -> String {
        let raw = fileName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = (raw?.isEmpty == false ? raw : extractName(from: url)) ?? "download.mp4"
        let sanitized = candidate.replacingOccurrences(of: "[^A-Za-z0-9._-]",
                                                     with: "_",
                                                     options: .regularExpression)
        return sanitized.isEmpty ? "download.mp4" : sanitized
    }

    static func destinationURL(url: String?, fileName: String?) -> URL {
        let dir = downloadsDirectory()
        return dir.appendingPathComponent(resolveFileName(url: url, fileName: fileName), isDirectory: false)
    }

    static func fileUri(for url: URL) -> String {
        return url.absoluteString
    }

    private static func extractName(from url: String?) -> String? {
        guard let urlString = url, !urlString.isEmpty else {
            return nil
        }
        if let parsed = URL(string: urlString) {
            let candidate = parsed.lastPathComponent
            return candidate.isEmpty ? nil : candidate
        }
        let fallback = urlString.split(separator: "/").last.map(String.init)
        return fallback?.isEmpty == false ? fallback : nil
    }
}
