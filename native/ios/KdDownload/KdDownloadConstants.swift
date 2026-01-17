import Foundation

enum KdDownloadConstants {
    static let eventName = "kdDownloadUpdate"
    static let downloadsFolderName = "downloads"
    static let stateFileName = "kd_download_state.json"
    static let resumeDataFileName = "kd_download_resume.dat"

    static let backgroundSessionIdentifier: String = {
        let base = Bundle.main.bundleIdentifier ?? "com.kdvideo.app"
        return base + ".kdDownload"
    }()
}
