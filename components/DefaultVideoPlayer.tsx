import { useVideoPlayer, VideoView, VideoViewProps } from "expo-video";
import React from "react";
import { View, ViewStyle } from "react-native";

interface DefaultVideoPlayerProps {
  sourceUrl: string | { uri: string };
  style?: ViewStyle;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  /** Additional VideoView props for customization */
  videoViewProps?: Partial<VideoViewProps>;
  /** Additional player configuration */
  playerConfig?: {
    loop?: boolean;
    muted?: boolean;
  };
}

/**
 * DefaultVideoPlayer - Simple video player with native controls
 *
 * Customizable via props for styles and VideoView properties.
 * Automatically handles loading and error states.
 */
export default function DefaultVideoPlayer({
  sourceUrl,
  style,
  onEnd,
  onError,
  videoViewProps = {},
  playerConfig = {},
}: DefaultVideoPlayerProps) {
  // Convert sourceUrl to proper format
  const videoSource =
    typeof sourceUrl === "string" ? { uri: sourceUrl } : sourceUrl;

  // Initialize video player
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = playerConfig.loop ?? false;
    player.muted = playerConfig.muted ?? false;
  });

  return (
    <View style={[{ backgroundColor: "#000" }, style]}>
      <VideoView
        style={{ width: "100%", height: "100%" }}
        player={player}
        allowsFullscreen={true}
        allowsPictureInPicture={true}
        nativeControls={true}
        {...videoViewProps}
      />
    </View>
  );
}
