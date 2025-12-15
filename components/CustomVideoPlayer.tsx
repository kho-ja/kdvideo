import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface CustomVideoPlayerProps {
  sourceUrl: string | { uri: string };
  style?: any;
  initialPaused?: boolean;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  theme?: "dark" | "light";
  primaryColor?: string;
  controlsHideDelay?: number;
  showTimeDisplay?: boolean;
  showFullscreenButton?: boolean;
}

export default function CustomVideoPlayer({
  sourceUrl,
  style,
  initialPaused = false,
  onEnd,
  onError,
  theme = "dark",
  primaryColor = "#6366f1",
  controlsHideDelay = 3000,
  showTimeDisplay = true,
  showFullscreenButton = true,
}: CustomVideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const videoViewRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsOpacityAnim = useRef(new Animated.Value(1)).current;
  const seekBarWidthRef = useRef(0);

  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!initialPaused);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isDark = theme === "dark";
  const colors = {
    background: isDark ? "#1a1a1a" : "#f5f5f5",
    text: isDark ? "#fff" : "#000",
    secondary: isDark ? "#999" : "#666",
    primary: primaryColor,
    controlsOverlay: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.2)",
  };

  const videoSource =
    typeof sourceUrl === "string" ? { uri: sourceUrl } : sourceUrl;

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    playerRef.current = p;
    if (initialPaused) {
      p.pause();
    } else {
      p.play();
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current) {
        const ct = playerRef.current.currentTime || 0;
        const dur = playerRef.current.duration || 0;

        setCurrentTime(ct);
        setDuration(dur);
        setIsPlaying(playerRef.current.playing);

        if (playerRef.current.status === "idle" && ct > 0 && ct >= dur - 0.5) {
          onEnd?.();
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [onEnd]);

  useEffect(() => {
    if (!showControls) return;

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        Animated.timing(controlsOpacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, controlsHideDelay);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying, controlsHideDelay, controlsOpacityAnim]);

  const togglePlayPause = useCallback(() => {
    if (playerRef.current.playing) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.muted = !playerRef.current.muted;
      setIsMuted(!playerRef.current.muted);
    }
  }, []);

  const seekTo = useCallback(
    (time: number) => {
      if (playerRef.current) {
        const clamped = Math.max(0, Math.min(time, duration));
        playerRef.current.currentTime = clamped;
        setCurrentTime(clamped);
      }
    },
    [duration]
  );

  const skip = useCallback(
    (seconds: number) => {
      seekTo(currentTime + seconds);
    },
    [currentTime, seekTo]
  );

  const toggleControls = useCallback(() => {
    if (!showControls) {
      Animated.timing(controlsOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setShowControls(true);
    } else {
      setShowControls(true);
    }
  }, [showControls, controlsOpacityAnim]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const seekPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const renderPlayer = () => (
    <>
      <VideoView
        ref={videoViewRef}
        style={styles.video}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture
        nativeControls={false}
      />

      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.tapArea} />
      </TouchableWithoutFeedback>

      {showControls && (
        <Animated.View
          style={[
            styles.controls,
            {
              backgroundColor: colors.controlsOverlay,
              opacity: controlsOpacityAnim,
            },
          ]}
        >
          <View
            style={styles.seekContainer}
            onLayout={(e) => {
              seekBarWidthRef.current = e.nativeEvent.layout.width;
            }}
          >
            <TouchableOpacity
              style={styles.seekBar}
              activeOpacity={1}
              onPress={(e) => {
                const { locationX } = e.nativeEvent;
                const width = seekBarWidthRef.current || 300;
                const percentage = locationX / width;
                seekTo(percentage * duration);
              }}
            >
              <View
                style={[
                  styles.seekBarBackground,
                  { backgroundColor: `${colors.primary}20` },
                ]}
              >
                <View
                  style={[
                    styles.seekBarProgress,
                    {
                      width: `${seekPercentage}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
            {showTimeDisplay && (
              <View style={styles.timeContainer}>
                <Text style={[styles.timeText, { color: colors.text }]}>
                  {formatTime(currentTime)}
                </Text>
                <Text style={[styles.timeText, { color: colors.secondary }]}>
                  {formatTime(duration)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => skip(-10)}
            >
              <Ionicons name="play-back" size={20} color={colors.text} />
              <Text style={[styles.skipLabel, { color: colors.text }]}>
                10s
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayPause}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => skip(10)}
            >
              <Ionicons name="play-forward" size={20} color={colors.text} />
              <Text style={[styles.skipLabel, { color: colors.text }]}>
                10s
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />

            {showFullscreenButton && (
              <TouchableOpacity
                style={styles.controlButton}
                onPress={toggleFullscreen}
              >
                <Ionicons
                  name={isFullscreen ? "contract" : "expand"}
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </>
  );

  return (
    <View
      style={[
        { backgroundColor: colors.background, position: "relative" },
        !isFullscreen
          ? style
          : {
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 9999,
            },
      ]}
    >
      <View style={{ flex: 1 }}>{renderPlayer()}</View>
      {isFullscreen && (
        <View
          style={styles.fullscreenControlsContainer}
          pointerEvents="box-none"
        >
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View style={styles.fullscreenOverlay} />
          </TouchableWithoutFeedback>

          {showControls && (
            <Animated.View
              style={[
                styles.fullscreenControls,
                {
                  backgroundColor: colors.controlsOverlay,
                  opacity: controlsOpacityAnim,
                },
              ]}
            >
              <View
                style={styles.seekContainer}
                onLayout={(e) => {
                  seekBarWidthRef.current = e.nativeEvent.layout.width;
                }}
              >
                <TouchableOpacity
                  style={styles.seekBar}
                  activeOpacity={1}
                  onPress={(e) => {
                    const { locationX } = e.nativeEvent;
                    const width = seekBarWidthRef.current || 300;
                    const percentage = locationX / width;
                    seekTo(percentage * duration);
                  }}
                >
                  <View
                    style={[
                      styles.seekBarBackground,
                      { backgroundColor: `${colors.primary}20` },
                    ]}
                  >
                    <View
                      style={[
                        styles.seekBarProgress,
                        {
                          width: `${seekPercentage}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
                {showTimeDisplay && (
                  <View style={styles.timeContainer}>
                    <Text style={[styles.timeText, { color: colors.text }]}>
                      {formatTime(currentTime)}
                    </Text>
                    <Text
                      style={[styles.timeText, { color: colors.secondary }]}
                    >
                      {formatTime(duration)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => skip(-10)}
                >
                  <Ionicons name="play-back" size={20} color={colors.text} />
                  <Text style={[styles.skipLabel, { color: colors.text }]}>
                    10s
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playButton}
                  onPress={togglePlayPause}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={28}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => skip(10)}
                >
                  <Ionicons name="play-forward" size={20} color={colors.text} />
                  <Text style={[styles.skipLabel, { color: colors.text }]}>
                    10s
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={toggleMute}
                >
                  <Ionicons
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={20}
                    color={colors.text}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />

                {showFullscreenButton && (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={toggleFullscreen}
                  >
                    <Ionicons
                      name={isFullscreen ? "contract" : "expand"}
                      size={20}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  video: {
    width: "100%",
    height: "100%",
  },
  fullscreenContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 9999,
  },
  fullscreenVideoContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  fullscreenBlackBgStatic: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  fullscreenBlackBgInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  fullscreenControlsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  fullscreenControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  tapArea: {
    ...StyleSheet.absoluteFillObject,
  },
  controls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  seekContainer: {
    marginBottom: 12,
    gap: 6,
  },
  seekBar: {
    height: 36,
    justifyContent: "center",
    width: "100%",
  },
  seekBarBackground: {
    height: 5,
    borderRadius: 2.5,
    overflow: "hidden",
  },
  seekBarProgress: {
    height: "100%",
    borderRadius: 2.5,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  controlButton: {
    padding: 8,
    alignItems: "center",
    minWidth: 44,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
  skipLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
});
