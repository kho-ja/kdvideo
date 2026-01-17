import UIKit

extension AppDelegate {
    func application(_ application: UIApplication,
                     handleEventsForBackgroundURLSession identifier: String,
                     completionHandler: @escaping () -> Void) {
        if identifier == KdDownloadConstants.backgroundSessionIdentifier {
            KdDownloadManager.shared.setBackgroundCompletionHandler(completionHandler)
        } else {
            completionHandler()
        }
    }
}
