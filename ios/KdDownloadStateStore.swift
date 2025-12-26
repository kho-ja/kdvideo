import Foundation

final class KdDownloadStateStore {
    private let fileManager = FileManager.default
    private let lock = NSLock()
    private let stateURL: URL
    let resumeDataURL: URL

    init() {
        let baseDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.temporaryDirectory
        let container = baseDir.appendingPathComponent("KdDownload", isDirectory: true)
        stateURL = container.appendingPathComponent(KdDownloadConstants.stateFileName, isDirectory: false)
        resumeDataURL = container.appendingPathComponent(KdDownloadConstants.resumeDataFileName, isDirectory: false)
        ensureDirectory(container)
    }

    func load() -> KdDownloadState? {
        lock.lock()
        defer { lock.unlock() }
        guard fileManager.fileExists(atPath: stateURL.path) else {
            return nil
        }
        guard let data = try? Data(contentsOf: stateURL) else {
            return nil
        }
        return try? JSONDecoder().decode(KdDownloadState.self, from: data)
    }

    func save(_ state: KdDownloadState) {
        lock.lock()
        defer { lock.unlock() }
        ensureDirectory(stateURL.deletingLastPathComponent())
        guard let data = try? JSONEncoder().encode(state) else {
            return
        }
        try? data.write(to: stateURL, options: .atomic)
    }

    func clear() {
        lock.lock()
        defer { lock.unlock() }
        if fileManager.fileExists(atPath: stateURL.path) {
            try? fileManager.removeItem(at: stateURL)
        }
    }

    func saveResumeData(_ data: Data) -> String? {
        lock.lock()
        defer { lock.unlock() }
        ensureDirectory(resumeDataURL.deletingLastPathComponent())
        do {
            try data.write(to: resumeDataURL, options: .atomic)
            return resumeDataURL.path
        } catch {
            return nil
        }
    }

    func loadResumeData(from path: String?) -> Data? {
        lock.lock()
        defer { lock.unlock() }
        let url = path.map { URL(fileURLWithPath: $0) } ?? resumeDataURL
        guard fileManager.fileExists(atPath: url.path) else {
            return nil
        }
        return try? Data(contentsOf: url)
    }

    func clearResumeData() {
        lock.lock()
        defer { lock.unlock() }
        if fileManager.fileExists(atPath: resumeDataURL.path) {
            try? fileManager.removeItem(at: resumeDataURL)
        }
    }

    private func ensureDirectory(_ url: URL) {
        if !fileManager.fileExists(atPath: url.path) {
            try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        }
    }
}
