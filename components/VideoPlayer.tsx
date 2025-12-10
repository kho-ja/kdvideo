import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoSource, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface VideoPlayerProps {
    source: VideoSource;
    style?: any;
}

export default function VideoPlayer({ source, style }: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initialize video player
    const player = useVideoPlayer(source, (player) => {
        player.loop = true;
        player.muted = isMuted;
    });

    // Update progress
    // Update progress and state
    useEffect(() => {
        const interval = setInterval(() => {
            if (player) {
                // Update time
                if (player.currentTime !== undefined) {
                    setCurrentTime(player.currentTime);
                    if (player.duration) {
                        setDuration(player.duration);
                    }
                }

                // Update state
                setIsLoading(player.status === 'loading');
                setIsPlaying(player.playing);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [player]);

    // Auto-hide controls after 3 seconds
    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
            }
        }, 3000);
    }, [isPlaying]);

    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            player.pause();
            setIsPlaying(false);
        } else {
            player.play();
            setIsPlaying(true);
        }
        resetControlsTimeout();
    }, [isPlaying, player, resetControlsTimeout]);

    const handleMuteToggle = useCallback(() => {
        const newMutedState = !isMuted;
        player.muted = newMutedState;
        setIsMuted(newMutedState);
        resetControlsTimeout();
    }, [isMuted, player, resetControlsTimeout]);

    const handleReplay = useCallback(() => {
        player.replay();
        setIsPlaying(true);
        resetControlsTimeout();
    }, [player, resetControlsTimeout]);

    const handleFullscreen = useCallback(async () => {
        try {
            if (isFullscreen) {
                await ScreenOrientation.lockAsync(
                    ScreenOrientation.OrientationLock.PORTRAIT_UP
                );
                setIsFullscreen(false);
            } else {
                await ScreenOrientation.lockAsync(
                    ScreenOrientation.OrientationLock.LANDSCAPE
                );
                setIsFullscreen(true);
            }
            resetControlsTimeout();
        } catch (error) {
            console.error('Fullscreen error:', error);
        }
    }, [isFullscreen, resetControlsTimeout]);

    const handleVideoPress = useCallback(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity
                style={styles.videoContainer}
                activeOpacity={1}
                onPress={handleVideoPress}
            >
                <VideoView
                    style={styles.video}
                    player={player}
                    allowsFullscreen
                    allowsPictureInPicture
                    nativeControls={false}
                />

                {/* Loading Indicator */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.loadingText}>Loading video...</Text>
                    </View>
                )}

                {/* Error Message */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Controls Overlay */}
                {showControls && !error && !isLoading && (
                    <View style={styles.controlsOverlay}>
                        {/* Top Bar with Fullscreen */}
                        <View style={styles.topBar}>
                            <TouchableOpacity
                                style={styles.topButton}
                                onPress={handleFullscreen}
                            >
                                <Ionicons
                                    name={isFullscreen ? 'contract' : 'expand'}
                                    size={24}
                                    color="#fff"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Center Controls */}
                        <View style={styles.centerControls}>
                            <TouchableOpacity
                                style={styles.mainControlButton}
                                onPress={handleReplay}
                            >
                                <Ionicons name="reload" size={32} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.mainControlButton, styles.playButton]}
                                onPress={handlePlayPause}
                            >
                                <Ionicons
                                    name={isPlaying ? 'pause' : 'play'}
                                    size={40}
                                    color="#fff"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.mainControlButton}
                                onPress={handleMuteToggle}
                            >
                                <Ionicons
                                    name={isMuted ? 'volume-mute' : 'volume-high'}
                                    size={32}
                                    color="#fff"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Bottom Bar with Progress */}
                        <View style={styles.bottomBar}>
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                                            },
                                        ]}
                                    />
                                </View>
                                <View style={styles.timeContainer}>
                                    <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </TouchableOpacity>

            {/* Bottom Info Bar */}
            <View style={styles.infoBar}>
                <View style={styles.statusIndicator}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: isPlaying ? '#4ade80' : '#ef4444' },
                        ]}
                    />
                    <Text style={styles.statusText}>
                        {isPlaying ? 'Playing' : 'Paused'}
                    </Text>
                </View>
                <View style={styles.statusIndicator}>
                    <Ionicons
                        name={isMuted ? 'volume-mute' : 'volume-high'}
                        size={16}
                        color="#666"
                    />
                    <Text style={styles.statusText}>
                        {isMuted ? 'Muted' : 'Sound On'}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#000',
        borderRadius: 12,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        position: 'relative',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        marginTop: 12,
        fontSize: 16,
        fontWeight: '500',
    },
    errorContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: '#ff4444',
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '500',
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
    },
    topButton: {
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 8,
    },
    centerControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        paddingHorizontal: 20,
    },
    mainControlButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(99, 102, 241, 0.9)',
        borderColor: '#6366f1',
    },
    bottomBar: {
        padding: 16,
    },
    progressContainer: {
        width: '100%',
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#6366f1',
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    timeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    infoBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#1a1a1a',
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        color: '#999',
        fontSize: 14,
        fontWeight: '500',
    },
});
