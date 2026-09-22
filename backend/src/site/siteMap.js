'use strict';

/* StartDownloading — official information architecture (single source of truth).
   Every footer link maps to a real route defined here. No "#", no empty hrefs.
   An automated audit (tests/runSiteAudit.js) verifies each route returns 200. */

const SITE_ORIGIN = 'https://startdownloading.com';

// kind: 'downloader' | 'category' | 'hub' | 'article'
const PAGES = [
  // ---- Hub ----
  {
    path: '/video-downloader', kind: 'downloader', platform: null, nav: 'Video Downloader',
    title: 'Video Downloader — Download Public Videos in MP4 | StartDownloading',
    description: 'Download publicly available videos from YouTube, TikTok, Instagram and X with real quality selection, free and without registration.',
    h1: 'Video Downloader',
    intro: 'Paste a link to a publicly available video and StartDownloading analyzes it, shows the real title and the qualities that actually exist, then lets you download the one you choose.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Video Downloader' }],
  },
  // ---- YouTube ----
  {
    path: '/youtube-downloader', kind: 'downloader', platform: 'youtube', nav: 'YouTube Downloader',
    title: 'YouTube Downloader — Download YouTube Videos in HD | StartDownloading',
    description: 'Analyze any public YouTube video URL, preview its real available qualities from 144p to 4K, and download the quality you pick.',
    h1: 'YouTube Downloader',
    intro: 'Paste a public YouTube video link below. StartDownloading reads the real formats YouTube provides for that video and lets you choose before downloading.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'YouTube' }, { label: 'YouTube Downloader' }],
  },
  {
    path: '/youtube-video-downloader', kind: 'downloader', platform: 'youtube', nav: 'YouTube Video Downloader',
    title: 'YouTube Video Downloader — Save YouTube Videos as MP4 | StartDownloading',
    description: 'Save public YouTube videos as MP4 files with the quality you select. Free, no registration, works on desktop and mobile.',
    h1: 'YouTube Video Downloader',
    intro: 'Download public YouTube videos as MP4. Enter the video URL, review the available qualities, pick one, and save the file to your device.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'YouTube' }, { label: 'YouTube Video Downloader' }],
  },
  {
    path: '/youtube-to-mp4', kind: 'downloader', platform: 'youtube', nav: 'YouTube to MP4',
    title: 'YouTube to MP4 — Convert Public YouTube Videos to MP4 | StartDownloading',
    description: 'Get public YouTube videos as MP4 files. Video-only qualities are merged with audio automatically so the MP4 plays with sound.',
    h1: 'YouTube to MP4',
    intro: 'YouTube to MP4 conversion happens on the server: video-only qualities are merged with the best compatible audio track so your MP4 has both picture and sound.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'YouTube' }, { label: 'YouTube to MP4' }],
  },
  {
    path: '/youtube-shorts-downloader', kind: 'downloader', platform: 'youtube', nav: 'YouTube Shorts Downloader',
    title: 'YouTube Shorts Downloader — Save Public Shorts | StartDownloading',
    description: 'Download public YouTube Shorts to your phone or computer. Paste the Shorts link and pick from the qualities actually available.',
    h1: 'YouTube Shorts Downloader',
    intro: 'Shorts are YouTube videos like any other: paste the Shorts link and StartDownloading shows the real formats available for it.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'YouTube' }, { label: 'YouTube Shorts Downloader' }],
  },
  {
    path: '/youtube-playlist-downloader', kind: 'downloader', platform: 'youtube', nav: 'YouTube Playlist Downloader', limited: 'playlist',
    title: 'YouTube Playlist Downloader — Save Public Playlist Videos | StartDownloading',
    description: 'Work with public YouTube playlist links one video at a time. Paste a playlist or video URL to analyze the video.',
    h1: 'YouTube Playlist Downloader',
    intro: 'Paste a public YouTube playlist or video link. This build analyzes videos individually: playlist links resolve to a single video for quality selection and download.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'YouTube' }, { label: 'YouTube Playlist Downloader' }],
  },
  {
    path: '/youtube-to-mp3', kind: 'downloader', platform: 'youtube', nav: 'YouTube to MP3', limited: 'audio',
    title: 'YouTube to MP3 — Get Audio From Public YouTube Videos | StartDownloading',
    description: 'Extract the audio track of public YouTube videos. Choose the "Audio only" quality to download the sound without the picture.',
    h1: 'YouTube to MP3',
    intro: 'Need just the sound? Analyze the video and choose the "Audio only" quality. This build delivers the source audio track (M4A/WebM as provided) — there is no MP3 re-encoding yet.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'YouTube' }, { label: 'YouTube to MP3' }],
  },
  // ---- TikTok ----
  {
    path: '/tiktok-downloader', kind: 'downloader', platform: 'tiktok', nav: 'TikTok Downloader',
    title: 'TikTok Downloader — Save Public TikTok Videos | StartDownloading',
    description: 'Download publicly available TikTok videos to your device. Paste the link, preview the video info, and save it.',
    h1: 'TikTok Downloader',
    intro: 'Paste a public TikTok video link. StartDownloading analyzes it and offers the formats the source actually provides.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'TikTok' }, { label: 'TikTok Downloader' }],
  },
  {
    path: '/tiktok-video-downloader', kind: 'downloader', platform: 'tiktok', nav: 'TikTok Video Downloader',
    title: 'TikTok Video Downloader — Download TikTok Videos as MP4 | StartDownloading',
    description: 'Save public TikTok videos as video files on phone or PC. Free, no watermark removal tricks — files come as provided.',
    h1: 'TikTok Video Downloader',
    intro: 'Download public TikTok videos to watch offline. Enter the video URL below to see what the source makes available.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'TikTok' }, { label: 'TikTok Video Downloader' }],
  },
  {
    path: '/tiktok-no-watermark', kind: 'downloader', platform: 'tiktok', nav: 'TikTok No Watermark', limited: 'watermark',
    title: 'TikTok Downloads — Files Delivered As Provided | StartDownloading',
    description: 'StartDownloading delivers TikTok files exactly as the source provides them. No watermark stripping or modification is performed.',
    h1: 'TikTok Downloads Without Modification',
    intro: 'A clear note: StartDownloading does not strip, blur, or remove watermarks. Files are delivered exactly as the source provides them — nothing is added or taken away.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'TikTok' }, { label: 'TikTok No Watermark' }],
  },
  {
    path: '/tiktok-mp4', kind: 'downloader', platform: 'tiktok', nav: 'TikTok MP4',
    title: 'TikTok MP4 — Save Public TikTok Videos in MP4 | StartDownloading',
    description: 'Get public TikTok videos in MP4 format where the source provides it. Paste the link to check available formats.',
    h1: 'TikTok MP4',
    intro: 'Most TikTok videos are served as MP4. Paste the link below and the analyzer shows the real MP4 formats available for that video.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'TikTok' }, { label: 'TikTok MP4' }],
  },
  {
    path: '/tiktok-mp3', kind: 'downloader', platform: 'tiktok', nav: 'TikTok MP3', limited: 'audio',
    title: 'TikTok MP3 — Get Audio From Public TikTok Videos | StartDownloading',
    description: 'Save the audio track of public TikTok videos. Choose the audio quality after analysis. Delivered as provided, no MP3 re-encoding yet.',
    h1: 'TikTok MP3',
    intro: 'Want only the sound of a TikTok? Analyze the link and pick the audio quality. This build delivers the source audio track as provided — MP3 re-encoding is not available yet.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'TikTok' }, { label: 'TikTok MP3' }],
  },
  {
    path: '/tiktok-photo-downloader', kind: 'downloader', platform: 'tiktok', nav: 'TikTok Photo Downloader', limited: 'photo',
    title: 'TikTok Photo Downloader — Public TikTok Photo Posts | StartDownloading',
    description: 'Try public TikTok photo-post links. Video links offer full quality selection; photo availability depends on the source.',
    h1: 'TikTok Photo Downloader',
    intro: 'TikTok photo posts can be tried with the same analyzer. Video links get full quality selection; whether a photo post resolves depends on what the source exposes — if not, you receive an honest error instead of a fake file.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'TikTok' }, { label: 'TikTok Photo Downloader' }],
  },
  // ---- Instagram ----
  {
    path: '/instagram-downloader', kind: 'downloader', platform: 'instagram', nav: 'Instagram Downloader',
    title: 'Instagram Downloader — Save Public Instagram Videos | StartDownloading',
    description: 'Download publicly available Instagram videos. Paste the post link, preview the info, and save the file.',
    h1: 'Instagram Downloader',
    intro: 'Paste a public Instagram video link. Only publicly available posts can be analyzed — private or login-walled content is refused with a clear message.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Instagram' }, { label: 'Instagram Downloader' }],
  },
  {
    path: '/instagram-video-downloader', kind: 'downloader', platform: 'instagram', nav: 'Instagram Video Downloader',
    title: 'Instagram Video Downloader — Download IG Videos | StartDownloading',
    description: 'Save public Instagram videos to your phone or computer with real format detection. Free and without registration.',
    h1: 'Instagram Video Downloader',
    intro: 'Download public Instagram videos for offline viewing. Enter the post URL below to analyze what is available.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Instagram' }, { label: 'Instagram Video Downloader' }],
  },
  {
    path: '/instagram-reels-downloader', kind: 'downloader', platform: 'instagram', nav: 'Instagram Reels Downloader',
    title: 'Instagram Reels Downloader — Save Public Reels | StartDownloading',
    description: 'Download public Instagram Reels. Paste the Reel link and pick from the formats actually available.',
    h1: 'Instagram Reels Downloader',
    intro: 'Reels are Instagram videos: paste the Reel link and StartDownloading shows the real formats available for that post.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Instagram' }, { label: 'Instagram Reels Downloader' }],
  },
  {
    path: '/instagram-story-downloader', kind: 'downloader', platform: 'instagram', nav: 'Instagram Story Downloader', limited: 'ephemeral',
    title: 'Instagram Story Downloader — Public Stories Only | StartDownloading',
    description: 'Stories are short-lived and often restricted. Only publicly available story content can be attempted; anything else gets an honest error.',
    h1: 'Instagram Story Downloader',
    intro: 'Stories expire quickly and are frequently private. You can attempt a public story link below, but restricted or expired stories are refused with a clear message — access controls are never bypassed.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Instagram' }, { label: 'Instagram Story Downloader' }],
  },
  {
    path: '/instagram-photo-downloader', kind: 'downloader', platform: 'instagram', nav: 'Instagram Photo Downloader', limited: 'photo',
    title: 'Instagram Photo Downloader — Public Photo Posts | StartDownloading',
    description: 'Try public Instagram photo-post links. Photo availability depends on the source; video posts offer full quality selection.',
    h1: 'Instagram Photo Downloader',
    intro: 'Photo posts can be tried with the analyzer below. Whether a photo resolves depends on what the source exposes; video posts get the full quality-selection flow.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Instagram' }, { label: 'Instagram Photo Downloader' }],
  },
  {
    path: '/instagram-thumbnail-downloader', kind: 'downloader', platform: 'instagram', nav: 'Instagram Thumbnail Downloader', limited: 'photo',
    title: 'Instagram Thumbnail Downloader — Preview Images | StartDownloading',
    description: 'Every successful analysis already shows the real video thumbnail preview. Use any analyzer below to see it.',
    h1: 'Instagram Thumbnail Downloader',
    intro: 'Good news: every video analysis on StartDownloading already displays the real thumbnail preview image. Paste a public link below and the thumbnail appears with the title before you download anything.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Instagram' }, { label: 'Instagram Thumbnail Downloader' }],
  },
  // ---- Twitter / X ----
  {
    path: '/twitter-video-downloader', kind: 'downloader', platform: 'twitter', nav: 'Twitter Video Downloader',
    title: 'Twitter Video Downloader — Save Public X Videos | StartDownloading',
    description: 'Download publicly available videos from X (Twitter). Paste the post link and choose from the real available qualities.',
    h1: 'Twitter Video Downloader',
    intro: 'Paste a public X (Twitter) post link containing a video. StartDownloading analyzes it and shows the qualities that actually exist.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Twitter / X' }, { label: 'Twitter Video Downloader' }],
  },
  {
    path: '/x-video-downloader', kind: 'downloader', platform: 'twitter', nav: 'X Video Downloader',
    title: 'X Video Downloader — Download Videos From X | StartDownloading',
    description: 'Save public videos from X. Works with x.com and twitter.com links — paste either form below.',
    h1: 'X Video Downloader',
    intro: 'X and Twitter links point to the same place. Paste an x.com or twitter.com post link below to analyze the video it contains.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Twitter / X' }, { label: 'X Video Downloader' }],
  },
  {
    path: '/twitter-gif-downloader', kind: 'downloader', platform: 'twitter', nav: 'Twitter GIF Downloader', limited: 'gif',
    title: 'Twitter GIF Downloader — Save GIFs as Video | StartDownloading',
    description: 'GIFs on X are served as short video files. Analyze the post link and download the clip in its real format.',
    h1: 'Twitter GIF Downloader',
    intro: 'Animated GIFs on X are technically short video clips. Analyze the post link below and download the clip in the format the source provides (usually MP4) — no format conversion is applied.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Twitter / X' }, { label: 'Twitter GIF Downloader' }],
  },
  {
    path: '/twitter-mp4-downloader', kind: 'downloader', platform: 'twitter', nav: 'Twitter MP4 Downloader',
    title: 'Twitter MP4 Downloader — Save X Videos in MP4 | StartDownloading',
    description: 'Get public X videos in MP4 format where the source provides it. Paste the link to check available formats.',
    h1: 'Twitter MP4 Downloader',
    intro: 'X videos are commonly served as MP4. Paste the post link below and the analyzer lists the real MP4 formats for that video.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Twitter / X' }, { label: 'Twitter MP4 Downloader' }],
  },
  {
    path: '/download-twitter-videos', kind: 'downloader', platform: 'twitter', nav: 'Download Twitter Videos',
    title: 'Download Twitter Videos — Free Public Video Downloads | StartDownloading',
    description: 'A simple way to download public Twitter/X videos: paste the link, pick a quality, save the file. No account needed.',
    h1: 'Download Twitter Videos',
    intro: 'Three steps: paste the public post link, choose one of the real qualities shown, and save the file. Only content the platform makes publicly available can be processed.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Twitter / X' }, { label: 'Download Twitter Videos' }],
  },
  // ---- Knowledge hub + categories ----
  {
    path: '/knowledge', kind: 'hub', nav: 'Knowledge Center',
    title: 'Knowledge Center — Guides for Downloading Videos | StartDownloading',
    description: 'How-to guides, device walkthroughs, format explainers, and troubleshooting for downloading publicly available videos.',
    h1: 'Knowledge Center',
    intro: 'Learn how to download publicly available videos on any device, understand formats and quality, and fix common problems.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Center' }],
  },
  {
    path: '/knowledge/how-to-guides', kind: 'category', nav: 'How-To Guides', category: 'how-to',
    title: 'How-To Guides — Download Videos Step by Step | StartDownloading',
    description: 'Step-by-step guides for downloading public videos from YouTube, TikTok, Instagram, X, Shorts, and Reels.',
    h1: 'How-To Guides',
    intro: 'Follow a guide for your platform. Every guide uses the same honest flow: paste a public link, review real qualities, download your choice.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Center', href: '/knowledge' }, { label: 'How-To Guides' }],
  },
  {
    path: '/knowledge/video-guides', kind: 'category', nav: 'Video Guides', category: 'video',
    title: 'Video Guides — Save Videos on Phone, PC & Mac | StartDownloading',
    description: 'Device guides: save public videos on Android, iPhone, phones in general, Windows PC, and Mac.',
    h1: 'Video Guides',
    intro: 'Downloading works in any modern browser. Pick your device below for the exact steps.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Center', href: '/knowledge' }, { label: 'Video Guides' }],
  },
  {
    path: '/knowledge/formats-quality', kind: 'category', nav: 'Formats & Quality', category: 'formats',
    title: 'Formats & Quality — MP4, WebM, HD, 4K Explained | StartDownloading',
    description: 'Understand MP4 vs WebM, what 1080p and 4K mean, and how to pick HD quality when downloading videos.',
    h1: 'Formats & Quality',
    intro: 'What the quality buttons actually mean — and how to choose the right one for your device and connection.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Center', href: '/knowledge' }, { label: 'Formats & Quality' }],
  },
  {
    path: '/knowledge/troubleshooting', kind: 'category', nav: 'Troubleshooting', category: 'trouble',
    title: 'Troubleshooting — Fix Failed Video Downloads | StartDownloading',
    description: 'Why a download can fail and what to do: private videos, unsupported links, timeouts, and oversized files.',
    h1: 'Troubleshooting',
    intro: 'Downloads fail for specific, explainable reasons. Find your symptom below — each article maps to the real messages StartDownloading shows.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Center', href: '/knowledge' }, { label: 'Troubleshooting' }],
  },
  {
    path: '/knowledge/guides', kind: 'category', nav: 'Guides', category: 'guides',
    title: 'Guides — How Video Downloading Works | StartDownloading',
    description: 'Background guides: how downloaders work, saving online videos, staying safe, formats, and choosing quality.',
    h1: 'Guides',
    intro: 'The background knowledge behind the buttons: how the technology works and how to use it responsibly.',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Center', href: '/knowledge' }, { label: 'Guides' }],
  },
];

const ARTICLES = [
  // How-To Guides (8)
  { slug: 'how-to-download-videos', category: 'how-to', nav: 'How to Download Videos', title: 'How to Download Videos — The Basic Flow | StartDownloading', description: 'The universal 3-step flow: paste a public video link, pick a real quality, and save the file on any device.', h1: 'How to Download Videos' },
  { slug: 'how-to-download-youtube-videos', category: 'how-to', nav: 'How to Download YouTube Videos', title: 'How to Download YouTube Videos | StartDownloading', description: 'Copy a public YouTube link, analyze it on StartDownloading, choose a quality from 144p to 4K, and save the MP4.', h1: 'How to Download YouTube Videos' },
  { slug: 'how-to-download-tiktok-videos', category: 'how-to', nav: 'How to Download TikTok Videos', title: 'How to Download TikTok Videos | StartDownloading', description: 'Save public TikTok videos: copy the share link, paste it into the analyzer, and download the available format.', h1: 'How to Download TikTok Videos' },
  { slug: 'how-to-download-instagram-videos', category: 'how-to', nav: 'How to Download Instagram Videos', title: 'How to Download Instagram Videos | StartDownloading', description: 'Download public Instagram videos and Reels by pasting the post link and choosing an available format.', h1: 'How to Download Instagram Videos' },
  { slug: 'how-to-download-twitter-videos', category: 'how-to', nav: 'How to Download Twitter Videos', title: 'How to Download Twitter Videos | StartDownloading', description: 'Save public X (Twitter) videos: copy the post link, analyze it, and download the quality you want.', h1: 'How to Download Twitter Videos' },
  { slug: 'how-to-download-youtube-shorts', category: 'how-to', nav: 'How to Download YouTube Shorts', title: 'How to Download YouTube Shorts | StartDownloading', description: 'Shorts work like regular YouTube videos: paste the Shorts URL, review qualities, and save the clip.', h1: 'How to Download YouTube Shorts' },
  { slug: 'how-to-download-instagram-reels', category: 'how-to', nav: 'How to Download Instagram Reels', title: 'How to Download Instagram Reels | StartDownloading', description: 'Save public Instagram Reels to your device in a few taps using the post link.', h1: 'How to Download Instagram Reels' },
  { slug: 'how-to-download-tiktok-videos-without-watermark', category: 'how-to', nav: 'How to Download TikTok Videos Without Watermark', title: 'TikTok Watermarks — What StartDownloading Does | StartDownloading', description: 'StartDownloading delivers TikTok files exactly as provided and does not remove watermarks. Here is what that means.', h1: 'TikTok Videos and Watermarks' },
  // Video Guides (5)
  { slug: 'how-to-save-videos-to-your-phone', category: 'video', nav: 'How to Save Videos to Your Phone', title: 'How to Save Videos to Your Phone | StartDownloading', description: 'Download public videos directly in your mobile browser and find them in your downloads or gallery.', h1: 'How to Save Videos to Your Phone' },
  { slug: 'how-to-download-videos-on-android', category: 'video', nav: 'How to Download Videos on Android', title: 'How to Download Videos on Android | StartDownloading', description: 'Use Chrome on Android to analyze a public video link and save the file to your Downloads folder.', h1: 'How to Download Videos on Android' },
  { slug: 'how-to-download-videos-on-iphone', category: 'video', nav: 'How to Download Videos on iPhone', title: 'How to Download Videos on iPhone | StartDownloading', description: 'Use Safari on iPhone to download public videos into the Files app Downloads folder.', h1: 'How to Download Videos on iPhone' },
  { slug: 'how-to-download-videos-on-pc', category: 'video', nav: 'How to Download Videos on PC', title: 'How to Download Videos on PC | StartDownloading', description: 'Download public videos on Windows: paste the link in your browser, pick a quality, and save to any folder.', h1: 'How to Download Videos on PC' },
  { slug: 'how-to-download-videos-on-mac', category: 'video', nav: 'How to Download Videos on Mac', title: 'How to Download Videos on Mac | StartDownloading', description: 'Download public videos on macOS with Safari or Chrome and find them in your Downloads folder.', h1: 'How to Download Videos on Mac' },
  // Formats & Quality (5)
  { slug: 'what-is-mp4', category: 'formats', nav: 'What Is MP4?', title: 'What Is MP4? — The Universal Video Format | StartDownloading', description: 'MP4 is the most compatible video container: video + audio in one file that plays almost everywhere.', h1: 'What Is MP4?' },
  { slug: 'mp4-vs-webm', category: 'formats', nav: 'MP4 vs WebM', title: 'MP4 vs WebM — Which Format to Choose | StartDownloading', description: 'MP4 plays almost everywhere; WebM is smaller but less compatible. How to decide when both appear.', h1: 'MP4 vs WebM' },
  { slug: 'what-is-1080p-video', category: 'formats', nav: 'What Is 1080p Video?', title: 'What Is 1080p Video? — Full HD Explained | StartDownloading', description: '1080p means 1920×1080 pixels: sharp Full HD that balances quality and file size for most screens.', h1: 'What Is 1080p Video?' },
  { slug: 'what-is-4k-video', category: 'formats', nav: 'What Is 4K Video?', title: 'What Is 4K Video? — Ultra HD Explained | StartDownloading', description: '4K (2160p) packs four times the pixels of 1080p — stunning on big screens, heavy on storage and bandwidth.', h1: 'What Is 4K Video?' },
  { slug: 'how-to-download-videos-in-hd', category: 'formats', nav: 'How to Download Videos in HD', title: 'How to Download Videos in HD | StartDownloading', description: 'Pick 720p or higher when the analyzer offers it, and know when HD is worth the bigger file.', h1: 'How to Download Videos in HD' },
  // Troubleshooting (4)
  { slug: 'why-cant-i-download-a-video', category: 'trouble', nav: "Why Can't I Download a Video?", title: "Why Can't I Download a Video? — Reasons | StartDownloading", description: 'Private, restricted, unsupported, or removed videos cannot be downloaded. How to tell which reason applies.', h1: "Why Can't I Download a Video?" },
  { slug: 'video-download-failed', category: 'trouble', nav: 'Video Download Failed', title: 'Video Download Failed — What to Do Next | StartDownloading', description: 'A failed download has a specific cause. Match the message you saw to the fix that fits.', h1: 'Video Download Failed' },
  { slug: 'video-downloader-not-working', category: 'trouble', nav: 'Video Downloader Not Working', title: 'Video Downloader Not Working — Checklist | StartDownloading', description: 'Work through this checklist when the downloader seems stuck: link, connection, quality, and retries.', h1: 'Video Downloader Not Working' },
  { slug: 'how-to-fix-a-failed-video-download', category: 'trouble', nav: 'How to Fix a Failed Video Download', title: 'How to Fix a Failed Video Download | StartDownloading', description: 'Practical fixes for the most common failures: try a lower quality, check the link, wait, and retry.', h1: 'How to Fix a Failed Video Download' },
  // Guides (5)
  { slug: 'how-video-downloaders-work', category: 'guides', nav: 'How Video Downloaders Work', title: 'How Video Downloaders Work — Plain Explanation | StartDownloading', description: 'From pasted link to saved file: analysis, quality listing, format selection, merging, and delivery.', h1: 'How Video Downloaders Work' },
  { slug: 'how-to-save-online-videos', category: 'guides', nav: 'How to Save Online Videos', title: 'How to Save Online Videos for Offline Viewing | StartDownloading', description: 'Save publicly available online videos for offline viewing, and respect creators and platform rules.', h1: 'How to Save Online Videos' },
  { slug: 'how-to-download-videos-safely', category: 'guides', nav: 'How to Download Videos Safely', title: 'How to Download Videos Safely | StartDownloading', description: 'Stay safe: use the official site, download only what you are allowed to, and keep your browser updated.', h1: 'How to Download Videos Safely' },
  { slug: 'video-download-formats-explained', category: 'guides', nav: 'Video Download Formats Explained', title: 'Video Download Formats Explained — Containers & Codecs | StartDownloading', description: 'Containers (MP4, WebM) vs codecs (H.264, VP9, AV1): what the analyzer labels mean for compatibility.', h1: 'Video Download Formats Explained' },
  { slug: 'how-to-choose-video-quality', category: 'guides', nav: 'How to Choose Video Quality', title: 'How to Choose Video Quality — Size vs Sharpness | StartDownloading', description: 'Match quality to your screen and connection: when 480p is enough and when 1080p or 4K is worth it.', h1: 'How to Choose Video Quality' },
];

for (const a of ARTICLES) {
  a.path = `/knowledge/${a.slug}`;
  a.kind = 'article';
  a.crumbs = null; // built dynamically from category
}

const CATEGORY_OF = {
  'how-to': '/knowledge/how-to-guides',
  'video': '/knowledge/video-guides',
  'formats': '/knowledge/formats-quality',
  'trouble': '/knowledge/troubleshooting',
  'guides': '/knowledge/guides',
};

const CATEGORY_LABEL = {
  'how-to': 'How-To Guides',
  'video': 'Video Guides',
  'formats': 'Formats & Quality',
  'trouble': 'Troubleshooting',
  'guides': 'Guides',
};

const ALL_ROUTES = [...PAGES.map((p) => p.path), ...ARTICLES.map((a) => a.path)];

function findPage(path) {
  return PAGES.find((p) => p.path === path) || ARTICLES.find((a) => a.path === path) || null;
}

function articlesIn(category) {
  return ARTICLES.filter((a) => a.category === category);
}

module.exports = { SITE_ORIGIN, PAGES, ARTICLES, ALL_ROUTES, CATEGORY_OF, CATEGORY_LABEL, findPage, articlesIn };
