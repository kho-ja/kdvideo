import Foundation
import React

@objc(KdDownloadModule)
final class KdDownloadModule: RCTEventEmitter {
    private let manager = KdDownloadManager.shared
    private var hasListeners = false

    override init() {
        super.init()
        manager.onStateUpdate = { [weak self] state in
            self?.emitState(state)
        }
    }

    @objc override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String] {
        return [KdDownloadConstants.eventName]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    @objc(startDownload:fileName:resolver:rejecter:)
    func startDownload(_ url: String,
                       fileName: String?,
                       resolver resolve: RCTPromiseResolveBlock,
                       rejecter reject: RCTPromiseRejectBlock) {
        guard !url.isEmpty else {
            reject("invalid_url", "URL is empty", nil)
            return
        }
        guard let destination = manager.startDownload(url: url, fileName: fileName) else {
            reject("invalid_url", "Invalid URL", nil)
            return
        }
        resolve(KdDownloadPaths.fileUri(for: destination))
    }

    @objc
    func pauseDownload() {
        manager.pauseDownload()
    }

    @objc
    func resumeDownload() {
        manager.resumeDownload()
    }

    @objc
    func cancelDownload() {
        manager.cancelDownload()
    }

    @objc(getState:rejecter:)
    func getState(_ resolve: RCTPromiseResolveBlock, rejecter _: RCTPromiseRejectBlock) {
        let state = manager.currentState()
        if state.isEmpty {
            resolve(nil)
            return
        }
        resolve(stateToDictionary(state))
    }

    @objc(getDownloadDirectory:rejecter:)
    func getDownloadDirectory(_ resolve: RCTPromiseResolveBlock, rejecter _: RCTPromiseRejectBlock) {
        let dir = KdDownloadPaths.downloadsDirectory()
        resolve(KdDownloadPaths.fileUri(for: dir))
    }

    private func emitState(_ state: KdDownloadState) {
        guard hasListeners else {
            return
        }
        sendEvent(withName: KdDownloadConstants.eventName, body: stateToDictionary(state))
    }

    private func stateToDictionary(_ state: KdDownloadState) -> [String: Any] {
        var payload: [String: Any] = [
            "status": state.status.rawValue,
            "downloadedBytes": Double(max(state.downloadedBytes, 0)),
            "totalBytes": Double(max(state.totalBytes, 0))
        ]

        let total = state.totalBytes
        if total > 0 {
            payload["progress"] = Double(state.downloadedBytes) / Double(total)
        } else {
            payload["progress"] = 0
        }

        if let url = state.url {
            payload["url"] = url
        }
        if let destPath = state.destPath {
            let fileUrl = URL(fileURLWithPath: destPath)
            payload["fileUri"] = KdDownloadPaths.fileUri(for: fileUrl)
        }
        if let error = state.lastError {
            payload["error"] = error
        }
        return payload
    }
}
