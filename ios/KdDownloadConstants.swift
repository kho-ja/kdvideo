import Foundation

enum KdDownloadConstants {

    // MARK: - JS / Events

    static let eventName = "kdDownloadUpdate"

    // MARK: - Files & storage

    static let downloadsFolderName = "downloads"
    static let stateFileName = "kd_download_state.json"
    static let resumeDataFileName = "kd_download_resume.dat"

    // MARK: - Background URLSession identifier
    //
    // IMPORTANT:
    // - MUST be a hardcoded string
    // - MUST change when background logic changes
    // - DO NOT compute from Bundle at runtime
    //
    // If background downloads behave strangely:
    // 1) Change this value (v4, v5, ...)
    // 2) Delete the app from the device
    //
    static let backgroundSessionIdentifier =
        "com.kdvideo.background.download.v3"
}

