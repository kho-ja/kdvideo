import { getDownloadDirectory } from '@/native/kdDownload';
import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type DownloadedVideo = {
  id: string;
  uri: string;
  filename: string;
  size?: number;
};

type DownloadedVideosContextValue = {
  videos: DownloadedVideo[];
  addVideo: (video: DownloadedVideo) => void;
  refresh: () => Promise<void>;
  removeVideo: (uri: string) => Promise<void>;
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];

const DownloadedVideosContext = createContext<DownloadedVideosContextValue | undefined>(undefined);
const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);

export function DownloadedVideosProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<DownloadedVideo[]>([]);
  const [downloadDir, setDownloadDir] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resolveDir = async () => {
      const nativeDir = await getDownloadDirectory();
      const fallback = FileSystem.documentDirectory
        ? `${FileSystem.documentDirectory}downloads/`
        : null;
      const resolved = nativeDir ?? fallback;
      if (isMounted) {
        setDownloadDir(resolved ? ensureTrailingSlash(resolved) : null);
      }
    };

    void resolveDir();
    return () => {
      isMounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (!downloadDir) {
        setVideos([]);
        return;
      }

      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        setVideos([]);
        return;
      }

      const entries = await FileSystem.readDirectoryAsync(downloadDir);
      const onlyVideos = entries.filter((name) =>
        VIDEO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
      );

      const withInfo = await Promise.all(
        onlyVideos.map(async (filename) => {
          const uri = `${downloadDir}${filename}`;
          const info = await FileSystem.getInfoAsync(uri);
          return {
            id: uri,
            uri,
            filename,
            size: info.exists && typeof info.size === 'number' ? info.size : undefined,
          };
        })
      );

      setVideos(withInfo);
    } catch (error) {
      console.warn('Failed to load downloaded videos', error);
    }
  }, [downloadDir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addVideo = useCallback((video: DownloadedVideo) => {
    setVideos((prev) => {
      if (prev.some((item) => item.id === video.id)) {
        return prev;
      }
      return [...prev, video];
    });
  }, []);

  const removeVideo = useCallback(
    async (uri: string) => {
      if (!uri) {
        return;
      }

      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        console.warn('Failed to delete downloaded video', error);
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      videos,
      addVideo,
      refresh,
      removeVideo,
    }),
    [videos, addVideo, refresh, removeVideo]
  );

  return (
    <DownloadedVideosContext.Provider value={value}>
      {children}
    </DownloadedVideosContext.Provider>
  );
}

export function useDownloadedVideos() {
  const ctx = useContext(DownloadedVideosContext);
  if (!ctx) {
    throw new Error('useDownloadedVideos must be used inside DownloadedVideosProvider');
  }
  return ctx;
}
