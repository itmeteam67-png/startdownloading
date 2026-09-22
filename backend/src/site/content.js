'use strict';

/* Honest page content. Rules enforced here:
   - No DRM / auth / paywall / access-control bypass claims, ever.
   - Limited capabilities are stated plainly on the page itself.
   - Only public, permitted content. Private/restricted links get errors. */

const LIMIT_NOTES = {
  playlist: {
    title: 'Current playlist support',
    text: 'This build analyzes videos individually: a playlist link resolves to a single video for quality selection and download. Full multi-video playlist queues are not available yet.',
  },
  audio: {
    title: 'About audio downloads',
    text: 'Choosing the "Audio only" quality delivers the source audio track as provided (usually M4A or WebM). MP3 re-encoding is not available in this build.',
  },
  photo: {
    title: 'About photo posts',
    text: 'Whether a photo post resolves depends on what the source exposes. Video links always get the full quality-selection flow; if a photo cannot be resolved you receive an honest error — never a fake file.',
  },
  ephemeral: {
    title: 'About stories',
    text: 'Stories expire and are frequently restricted to followers. Only publicly available story content can be attempted; restricted or expired stories are refused. Access controls are never bypassed.',
  },
  watermark: {
    title: 'About watermarks',
    text: 'StartDownloading delivers files exactly as the source provides them. It does not strip, blur, cover, or remove watermarks or logos of any kind.',
  },
  gif: {
    title: 'About GIFs',
    text: 'Animated GIFs on X are served as short video clips. You download the clip in the format the source provides (usually MP4). No GIF-to-video conversion magic — that is simply how the platform serves them.',
  },
};

const DOWNLOADER_STEPS = [
  { h: '1. Copy the public link', p: 'Open the video on its platform and copy the page URL. It must be publicly available — no login, no private share.' },
  { h: '2. Analyze it here', p: 'Paste the link into the analyzer above and press Download. The server reads the real formats the source provides for that exact video.' },
  { h: '3. Pick a quality and save', p: 'Choose one of the qualities shown — only genuinely available options appear — then press Download again to save the file.' },
];

const PLATFORM_FAQ = {
  youtube: [
    { q: 'Which YouTube qualities can I get?', a: 'Whatever the video actually provides — commonly 144p through 1080p, sometimes 1440p or 2160p. The analyzer lists them after reading the video; nothing is guessed.' },
    { q: 'Does the MP4 have sound?', a: 'Yes. YouTube serves high qualities as separate video and audio streams, and the server merges the best compatible audio into your MP4 automatically.' },
    { q: 'Why does a video fail?', a: 'Private, age-restricted, premium, or removed videos are refused with a clear message. Very long videos at high quality can exceed the processing time limit — try a lower quality.' },
  ],
  tiktok: [
    { q: 'Are TikTok files modified?', a: 'No. Files are delivered exactly as the source provides them — no watermark removal, no re-encoding, nothing added or taken away.' },
    { q: 'Which link should I paste?', a: 'The public video page URL (tiktok.com). Private or login-walled videos are refused with a clear message.' },
    { q: 'Can I get just the audio?', a: 'Yes — analyze the link and choose the audio quality. It arrives in the source audio format (M4A/WebM as provided).' },
  ],
  instagram: [
    { q: 'Which Instagram posts work?', a: 'Publicly available video posts and Reels. Private accounts, login-walled, or expired content (like most stories) cannot be processed.' },
    { q: 'Do Reels need a different tool?', a: 'No — paste the Reel link into the same analyzer. Reels are video posts and are handled the same way.' },
    { q: 'Where is the thumbnail?', a: 'Every successful analysis shows the real thumbnail preview next to the title before you download anything.' },
  ],
  twitter: [
    { q: 'Do x.com links work too?', a: 'Yes. Paste an x.com or twitter.com post link — both forms are recognized and analyzed the same way.' },
    { q: 'What about GIFs?', a: 'GIFs on X are short video clips. Download the clip in the format provided (usually MP4); no conversion is applied.' },
    { q: 'Why do some posts fail?', a: 'Protected accounts, deleted posts, and login-walled content are refused. Only publicly available videos can be processed.' },
  ],
  generic: [
    { q: 'Is it free?', a: 'Yes — no registration and no payment. Rate limits keep the shared service fair for everyone.' },
    { q: 'What qualities will I see?', a: 'Only the ones that genuinely exist for your exact video. The list is built fresh from the source on every analysis.' },
    { q: 'Is my link uploaded anywhere?', a: 'Your link is sent to the server only to analyze that video. Logs keep the hostname, never full URLs or query strings.' },
  ],
};

/* Article bodies: lede + sections (h2 + paragraphs). Internal links use
   [label](/path) mini-syntax resolved by the layout renderer. */
const ARTICLE_CONTENT = {
  'how-to-download-videos': {
    lede: 'Every download on StartDownloading follows the same three steps, no matter the platform.',
    sections: [
      { h: 'Step 1 — Copy a public video link', p: ['Open the video in your browser or app and copy its page URL. The video must be publicly available: anything needing a login, a private share, or a payment cannot be processed — by design.'] },
      { h: 'Step 2 — Analyze the link', p: ['Paste the link into the analyzer on the [Video Downloader](/video-downloader) page and press Download. The server reads the video and shows its real title, duration, and the qualities that actually exist.'] },
      { h: 'Step 3 — Choose a quality and save', p: ['Pick one of the offered qualities, press Download again, and the file saves to your device. Higher qualities look sharper but are bigger and take longer — see [How to Choose Video Quality](/knowledge/how-to-choose-video-quality).'] },
    ],
  },
  'how-to-download-youtube-videos': {
    lede: 'YouTube videos download in three steps when the video is public.',
    sections: [
      { h: 'Copy the YouTube URL', p: ['On the video page, copy the address (youtube.com or youtu.be links both work). ForShorts, see [How to Download YouTube Shorts](/knowledge/how-to-download-youtube-shorts).'] },
      { h: 'Analyze it', p: ['Paste the URL into the [YouTube Downloader](/youtube-downloader). The analyzer lists real qualities — often 144p to 1080p, sometimes 1440p or 2160p for newer uploads.'] },
      { h: 'Pick MP4 quality and save', p: ['Choose a quality pill and download. Video-only qualities are merged with audio automatically, so the [MP4](/knowledge/what-is-mp4) plays with sound. If a high quality times out on a long video, try 720p or 480p.'] },
    ],
  },
  'how-to-download-tiktok-videos': {
    lede: 'Public TikTok videos save in a few taps — delivered exactly as provided.',
    sections: [
      { h: 'Copy the share link', p: ['In the TikTok app, tap Share, then Copy link. Only public videos can be processed.'] },
      { h: 'Paste it into the analyzer', p: ['Open the [TikTok Downloader](/tiktok-downloader), paste the link, and press Download to see the formats the source provides.'] },
      { h: 'Save the file', p: ['Choose the offered format and save it. Files arrive unmodified — read [TikTok Videos and Watermarks](/knowledge/how-to-download-tiktok-videos-without-watermark) for what that means.'] },
    ],
  },
  'how-to-download-instagram-videos': {
    lede: 'Public Instagram videos and Reels can be saved with the post link.',
    sections: [
      { h: 'Copy the post link', p: ['Open the post or Reel, tap the share/menu icon, and copy the link. The post must be public — private accounts cannot be processed.'] },
      { h: 'Analyze the link', p: ['Paste it into the [Instagram Downloader](/instagram-downloader). The analyzer shows the title, thumbnail, and real formats.'] },
      { h: 'Download your choice', p: ['Pick a format and save. For Reels specifically, see [How to Download Instagram Reels](/knowledge/how-to-download-instagram-reels).'] },
    ],
  },
  'how-to-download-twitter-videos': {
    lede: 'Videos from public X (Twitter) posts download from the post link.',
    sections: [
      { h: 'Copy the post link', p: ['Open the post (x.com or twitter.com) and copy its URL. The post must be public — protected accounts are refused.'] },
      { h: 'Analyze the post', p: ['Paste the link into the [Twitter Video Downloader](/twitter-video-downloader) to list the real video qualities inside the post.'] },
      { h: 'Save the video', p: ['Choose a quality and download. Animated GIFs are short video clips — see the [Twitter GIF Downloader](/twitter-gif-downloader) notes.'] },
    ],
  },
  'how-to-download-youtube-shorts': {
    lede: 'Shorts are YouTube videos — the same flow applies.',
    sections: [
      { h: 'Copy the Shorts link', p: ['Open the Short (youtube.com/shorts/…) and copy the URL. Public Shorts work exactly like regular uploads.'] },
      { h: 'Analyze it', p: ['Paste the link into the [YouTube Shorts Downloader](/youtube-shorts-downloader). Shorts are usually short, so even high qualities process quickly.'] },
      { h: 'Save the clip', p: ['Pick a quality and download. On phones, see [How to Save Videos to Your Phone](/knowledge/how-to-save-videos-to-your-phone).'] },
    ],
  },
  'how-to-download-instagram-reels': {
    lede: 'Public Reels save from the Reel link in three steps.',
    sections: [
      { h: 'Copy the Reel link', p: ['Open the Reel, tap share, and copy the link. The Reel must come from a public account.'] },
      { h: 'Analyze it', p: ['Paste the link into the [Instagram Reels Downloader](/instagram-reels-downloader) to see available formats.'] },
      { h: 'Save to your device', p: ['Choose a format and save. iPhone users: files land in the Files app — see [How to Download Videos on iPhone](/knowledge/how-to-download-videos-on-iphone).'] },
    ],
  },
  'how-to-download-tiktok-videos-without-watermark': {
    lede: 'The honest answer first: StartDownloading does not remove watermarks.',
    sections: [
      { h: 'Files arrive as provided', p: ['TikTok serves videos with its watermark baked in. StartDownloading delivers the source file untouched — it cannot and does not strip, blur, or cover watermarks. Any tool claiming otherwise is modifying the video, which this service does not do.'] },
      { h: 'What you can do', p: ['Download the public video with the [TikTok Downloader](/tiktok-downloader) and keep the watermark intact — that also respects the creator. If you reuse a clip anywhere, credit the original creator.'] },
      { h: 'Respect creators', p: ['Download only videos you are allowed to save, and follow TikTok’s terms and the creator’s wishes when sharing. See [How to Download Videos Safely](/knowledge/how-to-download-videos-safely).'] },
    ],
  },
  'how-to-save-videos-to-your-phone': {
    lede: 'Phones download in the mobile browser — no app to install.',
    sections: [
      { h: 'Open StartDownloading in your browser', p: ['Go to the [Video Downloader](/video-downloader) in Chrome (Android) or Safari (iPhone). The page and the quality picker are touch-sized.'] },
      { h: 'Analyze and pick a modest quality', p: ['Paste the link and analyze it. On mobile data, 720p or 480p saves time and storage — see [How to Choose Video Quality](/knowledge/how-to-choose-video-quality).'] },
      { h: 'Find the saved file', p: ['Android: check the Downloads folder or gallery. iPhone: Safari saves into the Files app under Downloads.'] },
    ],
  },
  'how-to-download-videos-on-android': {
    lede: 'Chrome on Android handles the whole flow.',
    sections: [
      { h: 'Copy the video link', p: ['From YouTube, TikTok, Instagram, or X, copy the public video or post URL.'] },
      { h: 'Analyze it in Chrome', p: ['Open the [Video Downloader](/video-downloader) in Chrome, paste the link, and press Download to see real qualities.'] },
      { h: 'Save and locate the file', p: ['Choose a quality and download. Find it in Downloads via the Files app or your gallery. If a download stalls, retry on Wi-Fi — see [Video Download Failed](/knowledge/video-download-failed).'] },
    ],
  },
  'how-to-download-videos-on-iphone': {
    lede: 'Safari on iPhone saves videos into the Files app.',
    sections: [
      { h: 'Copy the video link', p: ['Copy the public video or post URL from the source app.'] },
      { h: 'Analyze it in Safari', p: ['Open the [Video Downloader](/video-downloader) in Safari, paste the link, and press Download to list qualities.'] },
      { h: 'Save to Files', p: ['Pick a quality and download. Safari stores it in Files → Downloads (or iCloud Drive, per your settings). From there you can move it to Photos.'] },
    ],
  },
  'how-to-download-videos-on-pc': {
    lede: 'On Windows, any modern browser works — files save where you choose.',
    sections: [
      { h: 'Copy the video link', p: ['Copy the public video URL from YouTube, TikTok, Instagram, or X.'] },
      { h: 'Analyze and choose quality', p: ['Paste it into the [Video Downloader](/video-downloader). Desktop connections are fast, so 1080p is often practical — but very long videos at high quality can still time out; 720p is the reliable sweet spot.'] },
      { h: 'Save the file', p: ['Press Download on your chosen quality and pick a folder in the save dialog. MP4 files play in the built-in Media Player.'] },
    ],
  },
  'how-to-download-videos-on-mac': {
    lede: 'Safari or Chrome on macOS — same three steps.',
    sections: [
      { h: 'Copy the video link', p: ['Copy the public video or post URL from the source site.'] },
      { h: 'Analyze it', p: ['Open the [Video Downloader](/video-downloader), paste the link, and review the real qualities offered.'] },
      { h: 'Save to Downloads', p: ['Download your chosen quality. Find it in the Downloads folder (Finder or the Safari toolbar). MP4 plays in QuickTime Player.'] },
    ],
  },
  'what-is-mp4': {
    lede: 'MP4 is the universal video file: picture and sound in one widely supported container.',
    sections: [
      { h: 'Container, not footage', p: ['MP4 is a container that holds a video stream plus an audio stream (usually H.264 video with AAC audio). Almost every phone, computer, TV, and browser plays it — which is why StartDownloading delivers MP4 as the primary format.'] },
      { h: 'Why merging matters', p: ['Some platforms serve high qualities as separate video-only and audio-only streams. The server merges them into a single MP4 with [FFmpeg](https://ffmpeg.org), so your download has both picture and sound. See [How Video Downloaders Work](/knowledge/how-video-downloaders-work).'] },
      { h: 'When you get something else', p: ['Occasionally a source only offers WebM — see [MP4 vs WebM](/knowledge/mp4-vs-webm). Audio-only choices arrive as M4A/WebM as provided.'] },
    ],
  },
  'mp4-vs-webm': {
    lede: 'Two containers you will meet: MP4 (universal) and WebM (efficient but pickier).',
    sections: [
      { h: 'MP4: maximum compatibility', p: ['MP4 with H.264 video plays on virtually everything, including older phones, TVs, and editors. When both exist, MP4 is the safe default — which is why the analyzer prefers MP4 options per quality.'] },
      { h: 'WebM: smaller, less compatible', p: ['WebM (usually VP9/Opus) can look equal at smaller sizes, but some Apple devices, TVs, and editors handle it poorly. Only choose WebM if your player supports it.'] },
      { h: 'How to decide', p: ['For sharing and archiving: MP4. For web embedding where you control playback: WebM can save bandwidth. The quality pills always show the container, so you decide with full information.'] },
    ],
  },
  'what-is-1080p-video': {
    lede: '1080p — Full HD — means a 1920×1080 picture: sharp on most screens without huge files.',
    sections: [
      { h: 'What the number means', p: ['The "1080" is the vertical pixel count; "p" stands for progressive scan. At 1920×1080 you get about 2 million pixels per frame — crisp on laptops, phones, and TVs up to ~50 inches.'] },
      { h: 'Size vs quality', p: ['A 10-minute 1080p video can exceed 100 MB. On this service, very long 1080p downloads may hit the processing time limit — [720p](/knowledge/how-to-download-videos-in-hd) often looks nearly as good at half the size.'] },
      { h: 'When to pick it', p: ['Choose 1080p for archiving, big-screen viewing, or editing. For casual phone watching, 720p or 480p is usually indistinguishable — see [How to Choose Video Quality](/knowledge/how-to-choose-video-quality).'] },
    ],
  },
  'what-is-4k-video': {
    lede: '4K (2160p) packs four times the pixels of 1080p — spectacular, and heavy.',
    sections: [
      { h: 'What 4K means', p: ['4K Ultra HD is 3840×2160 pixels (labeled 2160p in quality lists). It shines on large 4K TVs and in editing (room to crop), but on a phone screen it looks the same as 1080p while costing 3–4× the data.'] },
      { h: 'Why it is often unavailable', p: ['Only some uploads offer 2160p — the analyzer shows it solely when the source truly provides it. Never trust a downloader that offers 4K for every video; that list is invented.'] },
      { h: 'Practical advice', p: ['Download 4K only on fast Wi-Fi with free storage, and only for screens that show it. Otherwise [1080p](/knowledge/what-is-1080p-video) or 720p is the smarter pick. Long 4K videos will likely exceed processing limits — that is an honest capacity limit, not a bug.'] },
    ],
  },
  'how-to-download-videos-in-hd': {
    lede: 'HD means 720p and up. Here is how to actually get it.',
    sections: [
      { h: 'Pick 720p or higher', p: ['After analysis, choose 720p, 1080p, 1440p, or 2160p — whichever the video really offers. Anything labeled HD that the analyzer does not list does not exist for that video.'] },
      { h: 'Mind the trade-offs', p: ['HD files are much bigger and slower to process. On mobile data or older devices, 720p is the sweet spot; reserve 1080p+ for Wi-Fi and big screens.'] },
      { h: 'If HD fails', p: ['A timeout on a long HD video is the most common HD failure — retry at one step lower. Persistent failures are covered in [How to Fix a Failed Video Download](/knowledge/how-to-fix-a-failed-video-download).'] },
    ],
  },
  'why-cant-i-download-a-video': {
    lede: 'Four honest reasons — and how to identify yours.',
    sections: [
      { h: '1. It is not public', p: ['Private videos, age-restricted content, premium/paid content, and login-walled posts are refused ("This video isn’t publicly downloadable"). Access controls are never bypassed — try a public link instead.'] },
      { h: '2. The platform is unsupported', p: ['Links outside YouTube, TikTok, Instagram, and X return "This platform is not currently supported." Paste a link from a supported platform.'] },
      { h: '3. It was removed or the link is wrong', p: ['Deleted videos and mistyped URLs fail analysis ("not found / unavailable"). Double-check the URL opens in your browser first.'] },
      { h: '4. It is too big or too slow', p: ['Long videos at high quality can exceed size or time limits ("file too large" / "took too long"). Retry at a lower quality.'] },
    ],
  },
  'video-download-failed': {
    lede: 'Match the message you saw to the cause — then act.',
    sections: [
      { h: '"Video isn’t publicly downloadable"', p: ['The video is private, restricted, or premium. No retry will change that; use a public link. Details: [Why Can\'t I Download a Video?](/knowledge/why-cant-i-download-a-video).'] },
      { h: '"Took too long" (timeout)', p: ['The video + quality combination exceeded the processing budget. Retry the same video at a lower quality, or try again later on a faster connection.'] },
      { h: '"File too large"', p: ['The result exceeded the size cap. A lower quality is the fix — each step down roughly halves the file.'] },
      { h: '"Couldn’t process this video"', p: ['A generic engine failure: the source may be rate-limiting or the format changed. Wait a few minutes and retry; if it persists, the video may have become unavailable.'] },
    ],
  },
  'video-downloader-not-working': {
    lede: 'Work through this checklist top to bottom.',
    sections: [
      { h: 'Check the link first', p: ['Does the URL open in your browser? Is it from YouTube, TikTok, Instagram, or X? Is the content public? Nine of ten "not working" reports end here.'] },
      { h: 'Check your side', p: ['Try a different browser, disable aggressive ad-blockers for the site, and confirm your connection loads other pages. The analyzer needs a stable connection for 10–60 seconds.'] },
      { h: 'Check the quality choice', p: ['If analysis works but downloading stalls, the quality is likely too heavy for the time budget — step down to 720p or 480p and retry.'] },
      { h: 'Still stuck?', p: ['Wait a few minutes (rate limits and source hiccups pass), then retry once. Fixes for each message: [How to Fix a Failed Video Download](/knowledge/how-to-fix-a-failed-video-download).'] },
    ],
  },
  'how-to-fix-a-failed-video-download': {
    lede: 'Practical fixes ordered by what works most often.',
    sections: [
      { h: 'Fix 1 — Drop one quality level', p: ['Timeouts and oversized files are the top causes, and both vanish at a lower quality. 1080p → 720p solves most failures.'] },
      { h: 'Fix 2 — Verify and re-paste the link', p: ['Copy the URL fresh from the source page (not from memory or a screenshot). Confirm it plays publicly in a private browser window.'] },
      { h: 'Fix 3 — Wait and retry once', p: ['Sources rate-limit automated reads. One retry after a few minutes often succeeds; hammering the button triggers rate limits ("Too many requests").'] },
      { h: 'Fix 4 — Accept a hard no', p: ['Private, premium, removed, or unsupported content will never succeed. That refusal is the service working correctly — see [Why Can\'t I Download a Video?](/knowledge/why-cant-i-download-a-video).'] },
    ],
  },
  'how-video-downloaders-work': {
    lede: 'From pasted link to saved file in four stages.',
    sections: [
      { h: '1. Validation', p: ['The server checks the URL shape, confirms the platform from the hostname, and screens the destination against SSRF rules. Bad links stop here with precise errors.'] },
      { h: '2. Analysis', p: ['The engine reads the video page and returns real metadata — title, thumbnail, duration — plus the actual format list. StartDownloading turns that into one quality button per real option.'] },
      { h: '3. Selection and processing', p: ['Your chosen format ID — validated against the same video’s format list — drives the download. Video-only qualities are merged with the best audio track into MP4.'] },
      { h: '4. Delivery and cleanup', p: ['The file streams to your browser as an attachment with a sanitized filename, then expires from the server automatically. Nothing accumulates. Try it on the [Video Downloader](/video-downloader).'] },
    ],
  },
  'how-to-save-online-videos': {
    lede: 'Saving public online videos for offline viewing — the responsible way.',
    sections: [
      { h: 'Stick to public content', p: ['Save only videos that are publicly available and that you are allowed to download. Respect creators’ rights, platform terms, and local law — when in doubt, just watch online.'] },
      { h: 'Use the three-step flow', p: ['Copy the public link, analyze it on the [Video Downloader](/video-downloader), pick a real quality, and save. Keep the creator’s watermark and credits intact.'] },
      { h: 'Organize your saves', p: ['Name files clearly when saving, keep them in one media folder, and remember streaming-quality copies are for personal offline viewing — not redistribution.'] },
    ],
  },
  'how-to-download-videos-safely': {
    lede: 'Five habits that keep video downloading safe.',
    sections: [
      { h: 'Use the official site only', p: ['Type the address yourself and look for HTTPS. Never install "downloader" executables, browser extensions, or mobile apps from strangers — this service runs entirely in your browser.'] },
      { h: 'Download only what you may', p: ['Public, permitted content only. Private shares, premium content, and anything behind a login are off-limits — and this service refuses them automatically.'] },
      { h: 'Keep software updated', p: ['An updated browser and OS protect you far more than any antivirus banner. Play MP4 downloads in your system’s built-in player.'] },
      { h: 'Watch for impostors', p: ['Fake "Download" buttons and pop-ups are the classic trap. On StartDownloading there is exactly one analyzer and one quality picker — no pop-ups, no redirects, no accounts.'] },
    ],
  },
  'video-download-formats-explained': {
    lede: 'Containers vs codecs: what the labels on quality buttons mean.',
    sections: [
      { h: 'Containers: MP4, WebM', p: ['The container is the file type. [MP4](/knowledge/what-is-mp4) plays almost everywhere; [WebM](/knowledge/mp4-vs-webm) is efficient but pickier. The analyzer always shows which one you are getting.'] },
      { h: 'Codecs: H.264, VP9, AV1', p: ['The codec is the compression method inside. H.264 (AVC) is the compatibility king; VP9 and AV1 look great per megabyte but need newer players. Same height, different codec = same sharpness, different compatibility.'] },
      { h: 'Why one button per quality', p: ['A video can offer several files at the same height. StartDownloading shows the best MP4 variant per height so the choice stays simple without inventing options. Audio-only tracks appear separately as "Audio only".'] },
    ],
  },
  'how-to-choose-video-quality': {
    lede: 'Match the quality to your screen, connection, and patience.',
    sections: [
      { h: 'Phone on mobile data → 480p', p: ['On a small screen, 480p looks fine and downloads fast. 720p is the ceiling worth paying data for.'] },
      { h: 'Laptop on Wi-Fi → 720p or 1080p', p: ['720p is the reliable default; 1080p for archiving or big screens. Remember long 1080p videos can time out — that is normal, not broken.'] },
      { h: 'Big 4K TV / editing → 4K if offered', p: ['Choose [4K](/knowledge/what-is-4k-video) only when the analyzer genuinely lists 2160p, on fast Wi-Fi, with storage to spare. Otherwise pocket the bandwidth and pick 1080p.'] },
    ],
  },
};

module.exports = { LIMIT_NOTES, DOWNLOADER_STEPS, PLATFORM_FAQ, ARTICLE_CONTENT };
