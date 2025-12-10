import VideoPlayer from '@/components/VideoPlayer';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// Local video sources from assets/videos folder
const VIDEO_SOURCES = [
    {
        id: 1,
        title: 'Firdavs',
        description: 'Local video - firdavs.mp4',
        source: require('@/assets/videos/firdavs.mp4'),
    },
    {
        id: 2,
        title: 'Moon',
        description: 'Local video - moon.MP4',
        source: require('@/assets/videos/moon.mp4'),
    },
];

export default function VideoPlayerScreen() {
    const [selectedVideo, setSelectedVideo] = useState(VIDEO_SOURCES[0]);
    const player = useVideoPlayer(selectedVideo.source, (player) => {
        player.loop = true;
        player.muted = false;
    });

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerIcon}>
                        <Ionicons name="play-circle" size={32} color="#6366f1" />
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>Video Player</Text>
                        <Text style={styles.subtitle}>
                            Powered by expo-video with custom controls
                        </Text>
                    </View>
                </View>

                {/* Current Video Info */}
                <View style={styles.currentVideoCard}>
                    <Text style={styles.currentVideoLabel}>Now Playing</Text>
                    <Text style={styles.currentVideoTitle}>{selectedVideo.title}</Text>
                    <Text style={styles.currentVideoDescription}>
                        {selectedVideo.description}
                    </Text>
                </View>

                {/* Video Player */}
                <VideoPlayer source={selectedVideo.source} style={styles.player} />

                {/* Native Video Player */}
                <VideoView style={styles.player} player={player} allowsFullscreen allowsPictureInPicture nativeControls={true} />

                {/* Features List */}
                <View style={styles.featuresCard}>
                    <Text style={styles.featuresTitle}>Features</Text>
                    <View style={styles.featuresList}>
                        <FeatureItem icon="play-circle" text="Play/Pause control" />
                        <FeatureItem icon="reload" text="Replay video" />
                        <FeatureItem icon="volume-high" text="Mute/Unmute toggle" />
                        <FeatureItem icon="expand" text="Fullscreen support" />
                        <FeatureItem icon="eye-off" text="Auto-hiding controls" />
                        <FeatureItem icon="infinite" text="Loop playback" />
                    </View>
                </View>

                {/* Video Selection */}
                <View style={styles.selectionCard}>
                    <Text style={styles.selectionTitle}>Choose a Video</Text>
                    <View style={styles.videoList}>
                        {VIDEO_SOURCES.map((video) => (
                            <TouchableOpacity
                                key={video.id}
                                style={[
                                    styles.videoItem,
                                    selectedVideo.id === video.id && styles.videoItemActive,
                                ]}
                                onPress={() => setSelectedVideo(video)}
                            >
                                <View style={styles.videoItemIcon}>
                                    <Ionicons
                                        name={
                                            selectedVideo.id === video.id
                                                ? 'play-circle'
                                                : 'play-circle-outline'
                                        }
                                        size={24}
                                        color={selectedVideo.id === video.id ? '#6366f1' : '#666'}
                                    />
                                </View>
                                <View style={styles.videoItemText}>
                                    <Text
                                        style={[
                                            styles.videoItemTitle,
                                            selectedVideo.id === video.id &&
                                            styles.videoItemTitleActive,
                                        ]}
                                    >
                                        {video.title}
                                    </Text>
                                    <Text style={styles.videoItemDescription}>
                                        {video.description}
                                    </Text>
                                </View>
                                {selectedVideo.id === video.id && (
                                    <View style={styles.activeIndicator} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Instructions */}
                <View style={styles.instructionsCard}>
                    <Text style={styles.instructionsTitle}>How to Use</Text>
                    <Text style={styles.instructionText}>
                        • Tap the video to show/hide controls
                    </Text>
                    <Text style={styles.instructionText}>
                        • Controls auto-hide after 3 seconds while playing
                    </Text>
                    <Text style={styles.instructionText}>
                        • Use the play button to start/pause playback
                    </Text>
                    <Text style={styles.instructionText}>
                        • Tap fullscreen icon for immersive viewing
                    </Text>
                    <Text style={styles.instructionText}>
                        • Select different videos from the list above
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function FeatureItem({ icon, text }: { icon: any; text: string }) {
    return (
        <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
                <Ionicons name={icon} size={18} color="#6366f1" />
            </View>
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: 16,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 16,
    },
    headerIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#eef2ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
    },
    currentVideoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#6366f1',
    },
    currentVideoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6366f1',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    currentVideoTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    currentVideoDescription: {
        fontSize: 14,
        color: '#666',
    },
    player: {
        marginBottom: 24,
        width: '100%',
        height: 300,
    },
    featuresCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
    },
    featuresTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    featuresList: {
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#eef2ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText: {
        fontSize: 15,
        color: '#333',
    },
    selectionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
    },
    selectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    videoList: {
        gap: 12,
    },
    videoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        gap: 12,
        position: 'relative',
    },
    videoItemActive: {
        backgroundColor: '#eef2ff',
        borderWidth: 2,
        borderColor: '#6366f1',
    },
    videoItemIcon: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoItemText: {
        flex: 1,
    },
    videoItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    videoItemTitleActive: {
        color: '#6366f1',
    },
    videoItemDescription: {
        fontSize: 13,
        color: '#666',
    },
    activeIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6366f1',
    },
    instructionsCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
    },
    instructionsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    instructionText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 24,
        marginBottom: 8,
    },
});
