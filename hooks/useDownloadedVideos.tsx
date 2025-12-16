import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

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
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];

const DownloadedVideosContext = createContext<DownloadedVideosContextValue | undefined>(undefined);

export function DownloadedVideosProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<DownloadedVideo[]>([]);

  const refresh = useCallback(async () => {
    try {
      const dir = FileSystem.documentDirectory;
      if (!dir) {
        setVideos([]);
        return;
      }

      const entries = await FileSystem.readDirectoryAsync(dir);
      const onlyVideos = entries.filter((name) =>
        VIDEO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
      );

      const withInfo = await Promise.all(
        onlyVideos.map(async (filename) => {
          const uri = `${dir}${filename}`;
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
  }, []);

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

  const value = useMemo(
    () => ({
      videos,
      addVideo,
      refresh,
    }),
    [videos, addVideo, refresh]
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
