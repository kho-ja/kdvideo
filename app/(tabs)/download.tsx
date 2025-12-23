import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDownloadedVideos } from '@/hooks/useDownloadedVideos';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type ConnectionPreference = 'any' | 'wifi';
type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'completed' | 'error';

type SavedDownloadSnapshot = {
  url: string;
  fileUri: string;
  options: FileSystem.DownloadOptions;
  resumeData?: string | null;
  progress?: number;
  status?: DownloadStatus;
  bytesWritten?: number;
  totalBytes?: number;
};

const DEFAULT_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
const STORAGE_ROOT = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
const STATE_FILE = STORAGE_ROOT ? `${STORAGE_ROOT}download-state.json` : null;
const SETTINGS_FILE = STORAGE_ROOT ? `${STORAGE_ROOT}download-settings.json` : null;
const PROGRESS_SAVE_STEP = 0.02;

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
  const [connectionPreference, setConnectionPreference] =
    useState<ConnectionPreference>('any');
  const [isRestoringState, setIsRestoringState] = useState(true);

  const defaultDownloadOptions = useMemo<FileSystem.DownloadOptions>(
    () => ({
      sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      notification: {
        title: 'Downloading video',
        body: 'Please wait...',
        android: {
          channelId: 'downloads',
        },
      },
    }),
    []
  );

  const downloadResumableRef = useRef<FileSystem.DownloadResumable | null>(null);
  const savedSnapshotRef = useRef<SavedDownloadSnapshot | null>(null);
  const lastPersistedProgressRef = useRef(0);
  const hasRestoredRef = useRef(false);

  const { addVideo, refresh, removeVideo } = useDownloadedVideos();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const ensureChannel = async () => {
      try {
        await Notifications.setNotificationChannelAsync('downloads', {
          name: 'Downloads',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: null,
          vibrationPattern: [0],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        });
      } catch (error) {
        console.warn('Failed to create notification channel', error);
      }
    };

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

    void (async () => {
      await ensureChannel();
      await requestNotificationPermission();
    })();
  }, []);

  const handleProgress = useCallback((data: FileSystem.DownloadProgressData) => {
    const ratio =
      data.totalBytesExpectedToWrite > 0
        ? data.totalBytesWritten / data.totalBytesExpectedToWrite
        : 0;

    setProgress(ratio);
    setBytesWritten(data.totalBytesWritten);
    setTotalBytes(data.totalBytesExpectedToWrite);
    setStatus('downloading');
  }, []);

  const buildSnapshot = useCallback(
    (overrides?: Partial<SavedDownloadSnapshot>): SavedDownloadSnapshot | null => {
      const base =
        downloadResumableRef.current?.savable() ??
        savedSnapshotRef.current;

      if (!base) {
        return null;
      }

      const payload: SavedDownloadSnapshot = {
        ...base,
        progress,
        status,
        bytesWritten,
        totalBytes,
        ...overrides,
      };

      savedSnapshotRef.current = payload;
      return payload;
    },
    [bytesWritten, progress, status, totalBytes]
  );

  const persistSnapshot = useCallback(
    async (overrides?: Partial<SavedDownloadSnapshot>) => {
      if (!STATE_FILE) {
        return;
      }

      const payload = buildSnapshot(overrides);
      if (!payload) {
        return;
      }

      try {
        await FileSystem.writeAsStringAsync(STATE_FILE, JSON.stringify(payload));
        lastPersistedProgressRef.current = payload.progress ?? lastPersistedProgressRef.current;
      } catch (error) {
        console.warn('Failed to persist download state', error);
      }
    },
    [buildSnapshot]
  );

  const clearPersistedState = useCallback(async () => {
    if (STATE_FILE) {
      try {
        await FileSystem.deleteAsync(STATE_FILE, { idempotent: true });
      } catch (error) {
        console.warn('Failed to clear persisted download state', error);
      }
    }

    savedSnapshotRef.current = null;
    lastPersistedProgressRef.current = 0;
  }, []);

  const ensureNetworkAllowed = useCallback(async () => {
    const state = await Network.getNetworkStateAsync();

    if (!state.isConnected || state.isInternetReachable === false) {
      throw new Error('No internet connection');
    }

    if (connectionPreference === 'wifi' && state.type !== Network.NetworkStateType.WIFI) {
      throw new Error('Downloads allowed on Wi-Fi only');
    }
  }, [connectionPreference]);

  const persistSettings = useCallback(async (preference: ConnectionPreference) => {
    if (!SETTINGS_FILE) {
      return;
    }

    try {
      await FileSystem.writeAsStringAsync(
        SETTINGS_FILE,
        JSON.stringify({ connectionPreference: preference })
      );
    } catch (error) {
      console.warn('Failed to persist download settings', error);
    }
  }, []);

  useEffect(() => {
    if (!isRestoringState) {
      void persistSettings(connectionPreference);
    }
  }, [connectionPreference, persistSettings, isRestoringState]);

  const createResumable = useCallback(
    (
      targetUrl: string,
      targetUri: string,
      resumeData?: string | null,
      options?: FileSystem.DownloadOptions
    ) =>
      FileSystem.createDownloadResumable(
        targetUrl,
        targetUri,
        options ?? defaultDownloadOptions,
        handleProgress,
        resumeData ?? undefined
      ),
    [defaultDownloadOptions, handleProgress]
  );

  const handleDownloadError = useCallback(
    async (error: unknown, silent = false) => {
      console.error('Download failed', error);
      const message = error instanceof Error ? error.message : 'Download failed';
      setErrorMessage(message);
      setStatus('error');
      await persistSnapshot({ status: 'error' });

      if (!silent) {
        Alert.alert('Download error', message);
      }
    },
    [persistSnapshot]
  );

  const handleCompletion = useCallback(
    async (result: FileSystem.FileSystemDownloadResult, silent = false) => {
      setStatus('completed');
      setProgress(1);
      setLocalPath(result.uri);

      savedSnapshotRef.current = buildSnapshot({
        progress: 1,
        status: 'completed',
        resumeData: null,
        fileUri: result.uri,
      });

      await persistSnapshot({
        progress: 1,
        status: 'completed',
        resumeData: null,
        fileUri: result.uri,
      });

      const filename = result.uri.split('/').pop() ?? 'download.mp4';
      addVideo({ id: result.uri, uri: result.uri, filename });
      void refresh();

      if (!silent) {
        Alert.alert('Success', `File saved to: ${result.uri}`);
      }
    },
    [addVideo, buildSnapshot, persistSnapshot, refresh]
  );

  const startDownload = useCallback(async () => {
    if (!url) {
      Alert.alert('Error', 'Enter a file URL');
      return;
    }

    try {
      await ensureNetworkAllowed();
    } catch (error) {
      await handleDownloadError(error, true);
      if (error instanceof Error) {
        Alert.alert('Network unavailable', error.message);
      }
      return;
    }

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert('Error', 'Local storage is not available on this platform.');
      return;
    }

    const filename = filenameFromUrl(url);
    const targetUri = `${baseDir}${filename}`;

    setStatus('downloading');
    setProgress(0);
    setBytesWritten(0);
    setTotalBytes(undefined);
    setLocalPath(null);
    setErrorMessage(null);

    downloadResumableRef.current = createResumable(url, targetUri);
    savedSnapshotRef.current = downloadResumableRef.current.savable();

    await persistSnapshot({
      status: 'downloading',
      progress: 0,
      fileUri: targetUri,
      url,
    });

    try {
      const result = await downloadResumableRef.current.downloadAsync();
      if (result) {
        await handleCompletion(result);
      }
    } catch (error) {
      await handleDownloadError(error);
    }
  }, [createResumable, ensureNetworkAllowed, handleCompletion, handleDownloadError, persistSnapshot, url]);

  const resumeDownload = useCallback(
    async (autoStart = false) => {
      try {
        await ensureNetworkAllowed();
      } catch (error) {
        await handleDownloadError(error, true);
        if (!autoStart && error instanceof Error) {
          Alert.alert('Network unavailable', error.message);
        }
        return;
      }

      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) {
        Alert.alert('Error', 'Local storage is not available on this platform.');
        return;
      }

      const snapshot = savedSnapshotRef.current;
      const resumeUrl = snapshot?.url ?? url;
      const filename = snapshot?.fileUri?.split('/').pop() ?? filenameFromUrl(resumeUrl);
      const targetUri = snapshot?.fileUri ?? `${baseDir}${filename}`;
      const resumeData = snapshot?.resumeData ?? null;
      const options = snapshot?.options ?? defaultDownloadOptions;

      setStatus('downloading');
      setErrorMessage(null);

      downloadResumableRef.current = createResumable(resumeUrl, targetUri, resumeData, options);
      savedSnapshotRef.current = downloadResumableRef.current.savable();

      await persistSnapshot({
        status: 'downloading',
        fileUri: targetUri,
        url: resumeUrl,
      });

      try {
        const result = resumeData
          ? await downloadResumableRef.current.resumeAsync()
          : await downloadResumableRef.current.downloadAsync();

        if (result) {
          await handleCompletion(result, autoStart);
        }
      } catch (error) {
        await handleDownloadError(error, autoStart);
      }
    },
    [
      createResumable,
      defaultDownloadOptions,
      ensureNetworkAllowed,
      handleCompletion,
      handleDownloadError,
      persistSnapshot,
      url,
    ]
  );

  const pauseDownload = useCallback(async () => {
    if (!downloadResumableRef.current) {
      return;
    }

    try {
      const pausedState = await downloadResumableRef.current.pauseAsync();
      setStatus('paused');

      const resumeData = pausedState?.resumeData ?? savedSnapshotRef.current?.resumeData ?? null;
      savedSnapshotRef.current = buildSnapshot({ status: 'paused', resumeData });

      await persistSnapshot({
        status: 'paused',
        resumeData,
      });
    } catch (error) {
      console.warn('Failed to pause download', error);
    }
  }, [buildSnapshot, persistSnapshot]);

  const stopAndDelete = useCallback(async () => {
    const targetUri =
      savedSnapshotRef.current?.fileUri ??
      downloadResumableRef.current?.savable()?.fileUri;

    if (downloadResumableRef.current) {
      try {
        await downloadResumableRef.current.pauseAsync();
      } catch {
        // no-op if pause fails
      }
    }

    try {
      if (targetUri) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
        await removeVideo(targetUri);
      }
    } catch (error) {
      console.warn('Failed to delete file', error);
    } finally {
      setStatus('idle');
      setProgress(0);
      setBytesWritten(undefined);
      setTotalBytes(undefined);
      setLocalPath(null);
      downloadResumableRef.current = null;
      await clearPersistedState();
    }
  }, [clearPersistedState, removeVideo]);

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
      setStatus('idle');
      setProgress(0);
      setBytesWritten(undefined);
      setTotalBytes(undefined);
      setLocalPath(null);
      downloadResumableRef.current = null;
      await clearPersistedState();
    }
  }, [clearPersistedState, localPath, removeVideo]);

  useEffect(() => {
    if (status === 'downloading' && progress - lastPersistedProgressRef.current >= PROGRESS_SAVE_STEP) {
      void persistSnapshot();
    }
  }, [persistSnapshot, progress, status]);

  useEffect(() => {
    if (hasRestoredRef.current) {
      return;
    }

    hasRestoredRef.current = true;

    let isMounted = true;

    const restoreState = async () => {
      if (!STORAGE_ROOT) {
        setIsRestoringState(false);
        return;
      }

      try {
        if (SETTINGS_FILE) {
          const settingsRaw = await FileSystem.readAsStringAsync(SETTINGS_FILE);
          const savedSettings = JSON.parse(settingsRaw);
          if (
            savedSettings.connectionPreference === 'wifi' ||
            savedSettings.connectionPreference === 'any'
          ) {
            setConnectionPreference(savedSettings.connectionPreference);
          }
        }
      } catch (error) {
        console.warn('Failed to restore download settings', error);
      }

      try {
        if (STATE_FILE) {
          const raw = await FileSystem.readAsStringAsync(STATE_FILE);
          const saved: SavedDownloadSnapshot = JSON.parse(raw);

          savedSnapshotRef.current = saved;
          setUrl(saved.url || DEFAULT_URL);
          setProgress(saved.progress ?? 0);
          setBytesWritten(saved.bytesWritten);
          setTotalBytes(saved.totalBytes);
          setStatus(saved.status ?? 'paused');
          lastPersistedProgressRef.current = saved.progress ?? 0;

          if (saved.status === 'completed') {
            setLocalPath(saved.fileUri);
          }

          if (saved.url && saved.fileUri) {
            downloadResumableRef.current = createResumable(
              saved.url,
              saved.fileUri,
              saved.resumeData,
              saved.options
            );

            if (saved.status === 'downloading' || saved.status === 'paused') {
              await resumeDownload(true);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to restore download state', error);
      } finally {
        if (isMounted) {
          setIsRestoringState(false);
        }
      }
    };

    void restoreState();

    return () => {
      isMounted = false;
    };
  }, [createResumable, resumeDownload]);

  const progressPercent = (progress * 100).toFixed(1);
  const statusLabel: string = {
    idle: 'Idle',
    downloading: 'Downloading',
    paused: 'Paused',
    completed: 'Done',
    error: 'Error',
  }[status];

  const primaryButtonLabel =
    status === 'paused'
      ? 'Resume download'
      : status === 'downloading'
        ? 'Downloading...'
        : 'Start download';

  const primaryAction = status === 'paused' ? resumeDownload : startDownload;
  const disablePrimary = status === 'downloading' || isRestoringState;

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
              status !== 'downloading' && styles.buttonDisabled,
            ]}
            onPress={() => void pauseDownload()}
            disabled={status !== 'downloading'}
          >
            <Text style={styles.buttonText}>Pause</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonDanger, status === 'idle' && styles.buttonDisabled]}
            onPress={() => void stopAndDelete()}
            disabled={status === 'idle'}
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
            ? ` • ${formatBytes(bytesWritten)} / ${formatBytes(totalBytes)}`
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

      <View style={styles.card}>
        <ThemedText type="defaultSemiBold" style={styles.label}>
          Connection preference
        </ThemedText>
        <View style={styles.segment}>
          {(['any', 'wifi'] as ConnectionPreference[]).map((option) => {
            const isActive = connectionPreference === option;
            return (
              <Pressable
                key={option}
                style={[styles.segmentItem, isActive && styles.segmentItemActive]}
                onPress={() => setConnectionPreference(option)}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {option === 'any' ? 'Any network' : 'Wi-Fi only'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          When Wi-Fi only is selected, downloads are blocked on mobile data.
        </Text>
        <Text style={styles.helperText}>
          The download uses a BACKGROUND session so it can continue within OS limits and will try to resume when the app opens.
        </Text>
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
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0b0d14',
    borderWidth: 1,
    borderColor: '#24283a',
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#1f6feb33',
    borderColor: '#3b82f6',
  },
  segmentText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#e5e7eb',
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
  },
  fullWidthButton: {
    width: '100%',
    marginTop: 8,
  },
});
