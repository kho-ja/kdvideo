import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDownloadedVideos } from '@/hooks/useDownloadedVideos';
import {
  cancelDownload,
  getDownloadState,
  pauseDownload,
  resumeDownload,
  startDownload,
  subscribeToDownloadUpdates,
  type DownloadState,
  type DownloadStatus,
} from '@/native/kdDownload';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const DEFAULT_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';

const formatBytes = (value?: number) => {
  if (!value || Number.isNaN(value)) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const num = value / Math.pow(1024, exponent);
  return `${num.toFixed(num >= 10 ? 0 : 1)} ${units[exponent]}`;
};

const filenameFromUrl = (input: string) => {
  if (!input) {
    return 'download.mp4';
  }
  try {
    const pathname = new URL(input).pathname;
    const candidate = pathname.split('/').filter(Boolean).pop();
    return candidate || 'download.mp4';
  } catch {
    const fallback = input.split('/').pop();
    return fallback || 'download.mp4';
  }
};

export default function DownloadScreen() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [bytesWritten, setBytesWritten] = useState<number | undefined>();
  const [totalBytes, setTotalBytes] = useState<number | undefined>();
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const { addVideo, refresh, removeVideo } = useDownloadedVideos();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const requestNotificationPermission = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Attention',
            'Without notifications, background downloads may be interrupted by the Android system.'
          );
        }
      } catch (error) {
        console.warn('Failed to request notification permissions', error);
      }
    };

    void requestNotificationPermission();
  }, []);

  const applyState = useCallback((state?: DownloadState | null) => {
    if (!state) {
      return;
    }

    const downloaded = typeof state.downloadedBytes === 'number' ? state.downloadedBytes : 0;
    const total = typeof state.totalBytes === 'number' ? state.totalBytes : 0;
    const resolvedProgress =
      state.status === 'completed'
        ? 1
        : typeof state.progress === 'number'
          ? state.progress
          : total > 0
            ? downloaded / total
            : 0;

    setStatus(state.status ?? 'idle');
    setProgress(resolvedProgress);
    setBytesWritten(downloaded || undefined);
    setTotalBytes(total || undefined);
    setLocalPath(state.status === 'completed' ? state.fileUri ?? null : null);
    setErrorMessage(state.error ?? null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const state = await getDownloadState();
        if (isMounted) {
          applyState(state);
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [applyState]);

  useEffect(() => {
    const subscription = subscribeToDownloadUpdates((state) => {
      applyState(state);
      if (state.status === 'completed' && state.fileUri) {
        const filename = state.fileUri.split('/').pop() ?? 'download.mp4';
        addVideo({ id: state.fileUri, uri: state.fileUri, filename });
        void refresh();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [addVideo, applyState, refresh]);

  const handleDownloadError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Download failed';
    setStatus('error');
    setErrorMessage(message);
    Alert.alert('Download error', message);
  }, []);

  const startHandler = useCallback(async () => {
    if (!url) {
      Alert.alert('Error', 'Enter a file URL');
      return;
    }

    setStatus('downloading');
    setProgress(0);
    setBytesWritten(undefined);
    setTotalBytes(undefined);
    setErrorMessage(null);

    try {
      await startDownload(url, filenameFromUrl(url));
    } catch (error) {
      handleDownloadError(error);
    }
  }, [handleDownloadError, url]);

  const resumeHandler = useCallback(async () => {
    try {
      setStatus('downloading');
      setErrorMessage(null);
      resumeDownload();
    } catch (error) {
      handleDownloadError(error);
    }
  }, [handleDownloadError]);

  const pauseHandler = useCallback(() => {
    pauseDownload();
    setStatus('paused');
  }, []);

  const resetLocalState = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setBytesWritten(undefined);
    setTotalBytes(undefined);
    setLocalPath(null);
    setErrorMessage(null);
  }, []);

  const cancelHandler = useCallback(() => {
    cancelDownload();
    resetLocalState();
    void refresh();
  }, [refresh, resetLocalState]);

  const deleteCompletedFile = useCallback(async () => {
    if (!localPath) {
      return;
    }

    try {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      await removeVideo(localPath);
      Alert.alert('Removed', 'Downloaded file deleted');
    } catch (error) {
      console.warn('Failed to remove downloaded file', error);
      Alert.alert('Error', 'Failed to delete the file');
    } finally {
      resetLocalState();
    }
  }, [localPath, removeVideo, resetLocalState]);

  const progressPercent = (progress * 100).toFixed(1);
  const statusLabel =
    {
      idle: 'Idle',
      queued: 'Queued',
      downloading: 'Downloading',
      paused: 'Paused',
      completed: 'Done',
      failed: 'Failed',
      canceled: 'Canceled',
      error: 'Error',
    }[status] ?? 'Idle';

  const primaryButtonLabel =
    status === 'paused'
      ? 'Resume download'
      : status === 'error' || status === 'failed'
        ? 'Retry download'
        : status === 'downloading' || status === 'queued'
          ? 'Downloading...'
          : 'Start download';

  const primaryAction =
    status === 'paused' || status === 'error' || status === 'failed' ? resumeHandler : startHandler;
  const disablePrimary = status === 'downloading' || status === 'queued' || isHydrating;

  const showDeleteButton = status === 'completed' && !!localPath;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Download manager
      </ThemedText>

      <View style={styles.card}>
        <ThemedText type="defaultSemiBold" style={styles.label}>
          File URL
        </ThemedText>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/video.mp4"
          placeholderTextColor="#7d7d89"
          autoCapitalize="none"
        />

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.button, disablePrimary && styles.buttonDisabled]}
            onPress={() => void primaryAction()}
            disabled={disablePrimary}
          >
            <Text style={styles.buttonText}>{primaryButtonLabel}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.button,
              status !== 'downloading' && status !== 'queued' && styles.buttonDisabled,
            ]}
            onPress={pauseHandler}
            disabled={status !== 'downloading' && status !== 'queued'}
          >
            <Text style={styles.buttonText}>Pause</Text>
          </Pressable>
          <Pressable
            style={[
              styles.button,
              styles.buttonDanger,
              (status === 'idle' || status === 'canceled') && styles.buttonDisabled,
            ]}
            onPress={cancelHandler}
            disabled={status === 'idle' || status === 'canceled'}
          >
            <Text style={styles.buttonText}>Stop & delete</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <ThemedText type="defaultSemiBold">Progress</ThemedText>
          <Text style={styles.progressText}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
        </View>
        <Text style={styles.statusText}>
          {statusLabel}
          {bytesWritten && totalBytes
            ? ` - ${formatBytes(bytesWritten)} / ${formatBytes(totalBytes)}`
            : ''}
        </Text>
        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        {localPath && (
          <View style={styles.resultContainer}>
            <ThemedText type="defaultSemiBold">File saved</ThemedText>
            <Text style={styles.pathText}>{localPath}</Text>
          </View>
        )}
        {showDeleteButton && (
          <Pressable
            style={[styles.button, styles.buttonDanger, styles.fullWidthButton]}
            onPress={() => void deleteCompletedFile()}
          >
            <Text style={styles.buttonText}>Delete downloaded file</Text>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#11131b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1f2230',
  },
  label: {
    color: '#d4d6dd',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#24283a',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#f2f2f7',
    backgroundColor: '#0b0d14',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1f2433',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#1d2231',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
  },
  progressText: {
    color: '#d4d6dd',
  },
  statusText: {
    color: '#d4d6dd',
    fontSize: 13,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
  resultContainer: {
    backgroundColor: '#0b0d14',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2230',
    gap: 4,
  },
  pathText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  fullWidthButton: {
    width: '100%',
    marginTop: 8,
  },
});
