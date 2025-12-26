import Foundation

enum KdDownloadStatus: String, Codable {
    case idle
    case queued
    case downloading
    case paused
    case completed
    case failed
    case canceled
}

struct KdDownloadState: Codable {
    var url: String?
    var fileName: String?
    var destPath: String?
    var downloadedBytes: Int64
    var totalBytes: Int64
    var status: KdDownloadStatus
    var lastError: String?
    var resumeDataPath: String?
    var taskIdentifier: Int?

    init(url: String? = nil,
         fileName: String? = nil,
         destPath: String? = nil,
         downloadedBytes: Int64 = 0,
         totalBytes: Int64 = 0,
         status: KdDownloadStatus = .idle,
         lastError: String? = nil,
         resumeDataPath: String? = nil,
         taskIdentifier: Int? = nil) {
        self.url = url
        self.fileName = fileName
        self.destPath = destPath
        self.downloadedBytes = downloadedBytes
        self.totalBytes = totalBytes
        self.status = status
        self.lastError = lastError
        self.resumeDataPath = resumeDataPath
        self.taskIdentifier = taskIdentifier
    }

    var isEmpty: Bool {
        return url == nil && destPath == nil && status == .idle
    }
}
