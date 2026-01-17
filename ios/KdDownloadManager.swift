import Foundation

final class KdDownloadManager: NSObject {

    // MARK: - Singleton

    static let shared = KdDownloadManager()

    // MARK: - State

    private let stateStore = KdDownloadStateStore()
    private let stateQueue = DispatchQueue(label: "com.kdvideo.kdDownload.state")

    private var session: URLSession!
    private var activeTask: URLSessionDownloadTask?
    private var state: KdDownloadState

    private var lastNotifyAt: TimeInterval = 0
    private var lastPersistAt: TimeInterval = 0

    private var backgroundCompletionHandler: (() -> Void)?
    private var isPausing = false
    private var isCanceling = false

    // MARK: - Callbacks

    var onStateUpdate: ((KdDownloadState) -> Void)?

    // MARK: - Init

    private override init() {
        self.state = stateStore.load() ?? KdDownloadState()
        super.init()

        let config = URLSessionConfiguration.background(
            withIdentifier: KdDownloadConstants.backgroundSessionIdentifier
        )
        config.sessionSendsLaunchEvents = true
        config.waitsForConnectivity = true
        config.isDiscretionary = false
        config.httpMaximumConnectionsPerHost = 1

        self.session = URLSession(
            configuration: config,
            delegate: self,
            delegateQueue: nil
        )

        observeBackgroundSessionEvents()
        restoreExistingTasks()
    }

    // MARK: - Background completion (Expo-compatible)

    private func observeBackgroundSessionEvents() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleBackgroundSessionCompletion(_:)),
            name: Notification.Name("ExpoBackgroundSessionCompletion"),
            object: nil
        )
    }

    @objc
    private func handleBackgroundSessionCompletion(_ notification: Notification) {
        guard
            let userInfo = notification.userInfo,
            let identifier = userInfo["identifier"] as? String,
            let completion = userInfo["completionHandler"] as? () -> Void
        else {
            return
        }

        guard identifier == KdDownloadConstants.backgroundSessionIdentifier else {
            completion()
            return
        }

        stateQueue.async {
            self.backgroundCompletionHandler = completion
        }
    }

    // MARK: - Public API

    func currentState() -> KdDownloadState {
        stateQueue.sync { state }
    }

    @discardableResult
    func startDownload(url: String, fileName: String?) -> URL? {
        guard let remoteURL = URL(string: url) else {
            return nil
        }

        let destination = KdDownloadPaths.destinationURL(
            url: url,
            fileName: fileName
        )

        stateQueue.async {
            self.resetActiveTask()
            self.stateStore.clearResumeData()
            self.removeFileIfExists(destination)

            var newState = KdDownloadState(
                url: url,
                fileName: fileName,
                destPath: destination.path,
                downloadedBytes: 0,
                totalBytes: 0,
                status: .queued,
                lastError: nil,
                resumeDataPath: nil,
                taskIdentifier: nil
            )

            self.updateState(newState, persist: true, notify: true)

            let task = self.session.downloadTask(with: remoteURL)
            task.taskDescription = destination.path
            self.activeTask = task

            newState.status = .downloading
            newState.taskIdentifier = task.taskIdentifier
            self.updateState(newState, persist: true, notify: true)

            task.resume()
        }

        return destination
    }

    func pauseDownload() {
        stateQueue.async {
            guard let task = self.activeTask else { return }

            self.isPausing = true

            var pausedState = self.state
            pausedState.status = .paused
            pausedState.taskIdentifier = nil
            pausedState.lastError = nil

            self.updateState(pausedState, persist: true, notify: true)

            task.cancel(byProducingResumeData: { data in
                self.stateQueue.async {
                    if let data {
                        pausedState.resumeDataPath = self.stateStore.saveResumeData(data)
                    }

                    self.activeTask = nil
                    self.updateState(pausedState, persist: true, notify: true)
                    self.isPausing = false
                }
            })
        }
    }

    func resumeDownload() {
        stateQueue.async {
            if let task = self.activeTask, task.state == .suspended {
                task.resume()
                return
            }

            let resumeData = self.stateStore.loadResumeData(
                from: self.state.resumeDataPath
            )

            let task: URLSessionDownloadTask?

            if let resumeData {
                task = self.session.downloadTask(withResumeData: resumeData)
            } else if
                let urlString = self.state.url,
                let url = URL(string: urlString)
            {
                task = self.session.downloadTask(with: url)
            } else {
                return
            }

            guard let downloadTask = task else { return }

            if let destPath = self.state.destPath {
                downloadTask.taskDescription = destPath
            }

            self.activeTask = downloadTask

            var newState = self.state
            newState.status = .downloading
            newState.taskIdentifier = downloadTask.taskIdentifier
            newState.lastError = nil

            self.updateState(newState, persist: true, notify: true)
            downloadTask.resume()
        }
    }

    func cancelDownload() {
        stateQueue.async {
            self.isCanceling = true

            self.activeTask?.cancel()
            self.activeTask = nil

            self.stateStore.clearResumeData()

            if let path = self.state.destPath {
                self.removeFileIfExists(URL(fileURLWithPath: path))
            }

            let canceledState = KdDownloadState(status: .canceled)
            self.updateState(canceledState, persist: true, notify: true)

            self.stateStore.clear()
            self.isCanceling = false
        }
    }

    // MARK: - Restore

    private func restoreExistingTasks() {
        session.getAllTasks { tasks in
            let downloads = tasks.compactMap { $0 as? URLSessionDownloadTask }
            guard let task = downloads.first else { return }

            self.stateQueue.async {
                self.activeTask = task

                var newState = self.state
              if newState.url == nil {
                  newState.url = task.originalRequest?.url?.absoluteString
              }

              if newState.destPath == nil {
                  newState.destPath = task.taskDescription
              }

                newState.taskIdentifier = task.taskIdentifier

                switch task.state {
                case .running:
                    newState.status = .downloading
                case .suspended, .canceling:
                    newState.status = .paused
                default:
                    break
                }

                self.updateState(newState, persist: true, notify: true)
            }
        }
    }

    // MARK: - Helpers

    private func updateState(_ newState: KdDownloadState, persist: Bool, notify: Bool) {
        self.state = newState

        if persist {
            stateStore.save(newState)
        }
        if notify {
            notifyState(newState)
        }
    }

    private func notifyState(_ state: KdDownloadState) {
        guard let handler = onStateUpdate else { return }

        DispatchQueue.main.async {
            handler(state)
        }
    }

    private func resetActiveTask() {
        activeTask?.cancel()
        activeTask = nil
        lastNotifyAt = 0
        lastPersistAt = 0
        isPausing = false
        isCanceling = false
    }

    private func removeFileIfExists(_ url: URL) {
        if FileManager.default.fileExists(atPath: url.path) {
            try? FileManager.default.removeItem(at: url)
        }
    }
}

// MARK: - URLSession delegates

extension KdDownloadManager: URLSessionDownloadDelegate, URLSessionDelegate {

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        stateQueue.async {
            guard self.activeTask?.taskIdentifier == downloadTask.taskIdentifier else {
                return
            }

            var newState = self.state
            newState.downloadedBytes = totalBytesWritten
            newState.totalBytes = max(totalBytesExpectedToWrite, 0)
            newState.status = .downloading

            let now = Date.timeIntervalSinceReferenceDate
            let shouldNotify = now - self.lastNotifyAt >= 0.5
            let shouldPersist = now - self.lastPersistAt >= 1.5

            self.updateState(newState, persist: shouldPersist, notify: shouldNotify)

            if shouldNotify { self.lastNotifyAt = now }
            if shouldPersist { self.lastPersistAt = now }
        }
    }

  func urlSession(
      _ session: URLSession,
      downloadTask: URLSessionDownloadTask,
      didFinishDownloadingTo location: URL
  ) {

      guard self.activeTask?.taskIdentifier == downloadTask.taskIdentifier else {
          return
      }

      let destPath =
          self.state.destPath ??
          downloadTask.taskDescription ??
          KdDownloadPaths.destinationURL(
              url: self.state.url,
              fileName: self.state.fileName
          ).path

      let destURL = URL(fileURLWithPath: destPath)
      let directoryURL = destURL.deletingLastPathComponent()
      let fm = FileManager.default

      do {
          try fm.createDirectory(
              at: directoryURL,
              withIntermediateDirectories: true,
              attributes: nil
          )
          if fm.fileExists(atPath: destURL.path) {
              try fm.removeItem(at: destURL)
          }
          try fm.moveItem(at: location, to: destURL)

      } catch {
          stateQueue.async {
              var failedState = self.state
              failedState.status = .failed
              failedState.lastError = error.localizedDescription
              failedState.taskIdentifier = nil
              self.activeTask = nil
              self.updateState(failedState, persist: true, notify: true)
          }
          return
      }

      stateQueue.async {
          var newState = self.state
          newState.destPath = destURL.path
          newState.status = .completed
          newState.lastError = nil
          newState.taskIdentifier = nil
          newState.resumeDataPath = nil

          self.activeTask = nil
          self.stateStore.clearResumeData()
          self.updateState(newState, persist: true, notify: true)
      }
  }


    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        guard let error else { return }

        let nsError = error as NSError

        if nsError.domain == NSURLErrorDomain &&
            nsError.code == NSURLErrorCancelled
        {
            stateQueue.async {
                if self.isPausing || self.isCanceling { return }
                if self.state.status == .paused || self.state.status == .canceled { return }

                var newState = self.state
                newState.status = .failed
                newState.lastError = nsError.localizedDescription
                newState.taskIdentifier = nil
                self.activeTask = nil

                self.updateState(newState, persist: true, notify: true)
            }
            return
        }

        stateQueue.async {
            var newState = self.state

            if let resumeData =
                nsError.userInfo[NSURLSessionDownloadTaskResumeData] as? Data
            {
                newState.resumeDataPath =
                    self.stateStore.saveResumeData(resumeData)
            }

            newState.status = .failed
            newState.lastError = nsError.localizedDescription
            newState.taskIdentifier = nil
            self.activeTask = nil

            self.updateState(newState, persist: true, notify: true)
        }
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        stateQueue.async {
            let handler = self.backgroundCompletionHandler
            self.backgroundCompletionHandler = nil
            guard let handler else { return }

            DispatchQueue.main.async {
                handler()
            }
        }
    }
}

