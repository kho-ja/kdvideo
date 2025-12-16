import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as FileSystem from 'expo-file-system/legacy';
import { useDownloadedVideos } from '@/hooks/useDownloadedVideos';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';

export default function DownloadScreen() {
  const [url, setUrl] = useState('http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const { addVideo, refresh } = useDownloadedVideos();

  const callback = (downloadProgress: any) => {
    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
    setDownloadProgress(progress);
  };

  const downloadFile = async () => {
    if (!url) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setLocalPath(null);

    const filename = url.split('/').pop() || 'download.mp4';
    const baseDir = FileSystem.documentDirectory;

    if (!baseDir) {
      Alert.alert('Error', 'Local file storage is not available on this platform.');
      setIsDownloading(false);
      return;
    }

    const fileUri = baseDir + filename;

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {},
        callback
      );

      const result = await downloadResumable.downloadAsync();
      
      if (result) {
        setLocalPath(result.uri);
        addVideo({ id: result.uri, uri: result.uri, filename });
        void refresh();
        Alert.alert('Success', `File downloaded to: ${result.uri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Download Video</ThemedText>
      
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="Enter MP4 URL"
        placeholderTextColor="#888"
      />

      <Button
        title={isDownloading ? "Downloading..." : "Download MP4"}
        onPress={downloadFile}
        disabled={isDownloading}
      />

      {isDownloading && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Progress: {(downloadProgress * 100).toFixed(1)}%</Text>
        </View>
      )}

      {localPath && (
        <View style={styles.resultContainer}>
          <ThemedText>File saved to:</ThemedText>
          <Text style={styles.pathText}>{localPath}</Text>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    color: 'white',
    backgroundColor: '#333',
    borderRadius: 5,
  },
  progressContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  progressText: {
    color: 'white',
  },
  resultContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#222',
    borderRadius: 5,
  },
  pathText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 5,
  },
});
