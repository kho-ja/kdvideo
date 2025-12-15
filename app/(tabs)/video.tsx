import CustomVideoPlayer from "@/components/CustomVideoPlayer";
import DefaultVideoPlayer from "@/components/DefaultVideoPlayer";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Local video sources from assets/videos folder
const VIDEO_SOURCES = [
  {
    id: 1,
    title: "Firdavs",
    description: "Local video - firdavs.mp4",
    source: require("@/assets/videos/firdavs.mp4"),
  },
  {
    id: 2,
    title: "Moon",
    description: "Local video - moon.MP4",
    source: require("@/assets/videos/moon.mp4"),
  },
];

export default function VideoPlayerScreen() {
  const [selectedVideo, setSelectedVideo] = useState(VIDEO_SOURCES[0]);
  const [activePlayerTab, setActivePlayerTab] = useState<"default" | "custom">(
    "default"
  );

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
            <Text style={styles.subtitle}>Multiple player implementations</Text>
          </View>
        </View>

        {/* Player Type Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activePlayerTab === "default" && styles.tabActive,
            ]}
            onPress={() => setActivePlayerTab("default")}
          >
            <Ionicons
              name="play-circle"
              size={16}
              color={activePlayerTab === "default" ? "#fff" : "#666"}
            />
            <Text
              style={[
                styles.tabText,
                activePlayerTab === "default" && styles.tabTextActive,
              ]}
            >
              Default
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activePlayerTab === "custom" && styles.tabActive,
            ]}
            onPress={() => setActivePlayerTab("custom")}
          >
            <Ionicons
              name="settings"
              size={16}
              color={activePlayerTab === "custom" ? "#fff" : "#666"}
            />
            <Text
              style={[
                styles.tabText,
                activePlayerTab === "custom" && styles.tabTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Default Player Tab */}
        {activePlayerTab === "default" && (
          <>
            <View style={styles.playerCard}>
              <View style={styles.playerHeader}>
                <Ionicons name="play-circle" size={20} color="#6366f1" />
                <Text style={styles.playerTitle}>Default Video Player</Text>
              </View>
              <Text style={styles.playerDescription}>
                Uses native controls from expo-video. Works with both local and
                remote videos.
              </Text>
              <View style={styles.playerContainer}>
                <DefaultVideoPlayer
                  sourceUrl={selectedVideo.source}
                  style={styles.player}
                  onEnd={() => console.log("Default player: Video ended")}
                  onError={(e) => console.error("Default player error:", e)}
                />
              </View>
            </View>
          </>
        )}

        {/* Custom Player Tab */}
        {activePlayerTab === "custom" && (
          <>
            <View style={styles.playerCard}>
              <View style={styles.playerHeader}>
                <Ionicons name="settings" size={20} color="#8b5cf6" />
                <Text style={styles.playerTitle}>Custom Video Player</Text>
              </View>
              <Text style={styles.playerDescription}>
                Custom overlay controls with smooth animations, theme support,
                and full customization options.
              </Text>
              <View style={styles.playerContainer}>
                <CustomVideoPlayer
                  sourceUrl={selectedVideo.source}
                  style={styles.player}
                  initialPaused={false}
                  theme="dark"
                  primaryColor="#8b5cf6"
                  controlsHideDelay={3500}
                  showTimeDisplay={true}
                  showFullscreenButton={true}
                  onEnd={() => console.log("Custom player: Video ended")}
                  onError={(e: any) => console.error("Custom player error:", e)}
                />
              </View>
            </View>
          </>
        )}

        {/* Video Selection */}
        <View style={styles.selectionCard}>
          <Text style={styles.selectionTitle}>Choose Video</Text>
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
                        ? "play-circle"
                        : "play-circle-outline"
                    }
                    size={24}
                    color={selectedVideo.id === video.id ? "#6366f1" : "#666"}
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
          {activePlayerTab === "default" && (
            <>
              <Text style={styles.instructionText}>
                • Uses native controls from expo-video
              </Text>
              <Text style={styles.instructionText}>
                • Supports fullscreen and picture-in-picture
              </Text>
            </>
          )}
          {activePlayerTab === "custom" && (
            <>
              <Text style={styles.instructionText}>
                • Tap video to show/hide controls
              </Text>
              <Text style={styles.instructionText}>
                • Press ±10 to skip forward/backward
              </Text>
              <Text style={styles.instructionText}>
                • Drag seek bar to jump to time
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
  },
  tabsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    backgroundColor: "#222",
    padding: 8,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#333",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#6366f1",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },
  tabTextActive: {
    color: "#fff",
  },
  playerCard: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  playerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  playerDescription: {
    fontSize: 14,
    color: "#999",
    marginBottom: 12,
    lineHeight: 20,
  },
  playerContainer: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  currentVideoCard: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
  },
  currentVideoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currentVideoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  currentVideoDescription: {
    fontSize: 14,
    color: "#999",
  },
  player: {
    width: "100%",
    height: 280,
  },
  featuresCard: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: 15,
    color: "#ccc",
  },
  selectionCard: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  selectionDescription: {
    fontSize: 14,
    color: "#999",
    marginBottom: 16,
  },
  videoList: {
    gap: 12,
  },
  videoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#333",
    borderRadius: 8,
    gap: 12,
    position: "relative",
  },
  videoItemActive: {
    backgroundColor: "#6366f1",
    borderWidth: 0,
  },
  videoItemIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  videoItemText: {
    flex: 1,
  },
  videoItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  videoItemTitleActive: {
    color: "#fff",
  },
  videoItemDescription: {
    fontSize: 13,
    color: "#999",
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  instructionsCard: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: "#999",
    lineHeight: 20,
    marginBottom: 6,
  },
});
