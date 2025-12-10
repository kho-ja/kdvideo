# Using Local Video Files

## How to Add Local Videos

1. **Place your video files** in the `assets/videos/` directory
   - Supported formats: `.mp4`, `.mov`, `.m4v`
   - Recommended: MP4 with H.264 codec

2. **Update the video sources** in `app/(tabs)/video.tsx`:

```tsx
const VIDEO_SOURCES = [
    {
        id: 1,
        title: 'My Local Video',
        description: 'Video stored in assets folder',
        source: require('@/assets/videos/my-video.mp4'),
    },
];
```

3. **Use the source** in VideoPlayer:

```tsx
<VideoPlayer source={selectedVideo.source} />
```

## Example with Mixed Sources

You can mix local and remote videos:

```tsx
const VIDEO_SOURCES = [
    {
        id: 1,
        title: 'Local Video',
        description: 'From assets folder',
        source: require('@/assets/videos/local.mp4'),
    },
    {
        id: 2,
        title: 'Remote Video',
        description: 'From internet',
        source: { uri: 'https://example.com/video.mp4' },
    },
];
```

## Current Setup

- Created `assets/videos/` directory
- Add your `.mp4` files there
- Update the VIDEO_SOURCES array to use `require()` for local files

## Notes

- Local files don't require internet connection
- Faster loading and playback
- App bundle size will increase with video files
- For production, consider hosting large videos remotely
