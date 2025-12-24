import { NativeEventEmitter, NativeModules, Platform, type NativeModule } from 'react-native';

export type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'completed' | 'error';

export type DownloadState = {
  status: DownloadStatus;
  url?: string;
  fileUri?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  progress?: number;
  error?: string;
};

type KdDownloadModuleType = {
  startDownload: (url: string, fileName?: string | null) => Promise<string | null>;
  pauseDownload: () => void;
  resumeDownload: () => void;
  cancelDownload: () => void;
  getState: () => Promise<DownloadState | null>;
  getDownloadDirectory: () => Promise<string | null>;
};

const moduleInstance = NativeModules.KdDownloadModule as KdDownloadModuleType | undefined;
const emitter = moduleInstance ? new NativeEventEmitter(moduleInstance as NativeModule) : null;

const requireModule = () => {
  if (!moduleInstance) {
    throw new Error('KdDownloadModule is not available');
  }
  return moduleInstance;
};

export const startDownload = async (url: string, fileName?: string) => {
  if (Platform.OS !== 'android') {
    throw new Error('Download service is only available on Android');
  }
  return requireModule().startDownload(url, fileName ?? null);
};

export const pauseDownload = () => {
  if (Platform.OS !== 'android' || !moduleInstance) {
    return;
  }
  moduleInstance.pauseDownload();
};

export const resumeDownload = () => {
  if (Platform.OS !== 'android' || !moduleInstance) {
    return;
  }
  moduleInstance.resumeDownload();
};

export const cancelDownload = () => {
  if (Platform.OS !== 'android' || !moduleInstance) {
    return;
  }
  moduleInstance.cancelDownload();
};

export const getDownloadState = async () => {
  if (Platform.OS !== 'android' || !moduleInstance) {
    return null;
  }
  return moduleInstance.getState();
};

export const getDownloadDirectory = async () => {
  if (Platform.OS !== 'android' || !moduleInstance) {
    return null;
  }
  return moduleInstance.getDownloadDirectory();
};

export const subscribeToDownloadUpdates = (listener: (state: DownloadState) => void) => {
  if (!emitter) {
    return null;
  }
  return emitter.addListener('kdDownloadUpdate', listener);
};
