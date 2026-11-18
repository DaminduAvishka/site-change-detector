# What's New? Site Change Detector (demo v0.1)

A very first model: pick a site to track, and when you come back, a popup lists what is new or gone.
Plain JavaScript, no build step. Manifest V3.

## Load it in Chrome
1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose this folder (the one containing `manifest.json`).
3. Pin the extension from the puzzle-piece menu.

## Try it with the demo site (about 1 minute)
1. In a terminal: `cd demo-site && python3 -m http.server 8000`
2. Open http://localhost:8000 (reload it once if it was open before you installed the extension).
3. Click the extension icon, then **Track this site**. A baseline snapshot is saved.
4. On the page, click **Publish an update** (this plays the website owner).
5. Reload the page. The icon shows a green badge. Open the popup to see new sections, links and text.
6. Publish more updates (3 in total, the last one also removes a news item), or press **Reset site**.

Also try it on a real site you track, then revisit it after the site publishes something.

## How it works
- `content.js` runs on pages of tracked sites only. It takes a snapshot of the main content
  (headings, text blocks, links) using `extractSnapshot()` in `lib.js`.
- `background.js` compares it with the snapshot saved at the previous visit (`diffSnapshots()`),
  stores the result and sets the badge count.
- `popup.js` reads the stored result and draws the list. Page text is inserted with `textContent` only.
- Everything stays in `chrome.storage.local` on your machine. Nothing is sent anywhere.

## Known limits (on purpose, for a first demo)
- Compares against your previous visit only, no background checking while you are away.
- Noise filtering is basic: it uses `<main>` or `<article>`, and drops nav, footer, ads and cookie banners.
  Pages with rotating content (carousels, "trending", timestamps) will show false changes.
- Edited text shows up as one removed line plus one added line.
- Snapshots live in `chrome.storage.local` (about 10 MB). Move to IndexedDB for many sites.

## Good next steps
1. Background checks with `chrome.alarms` and the site's `sitemap.xml` to spot new pages.
2. Better noise handling: take two snapshots and ignore what differs between them.
3. Word-level text diffs with `jsdiff`.
4. An AI summary of the diff ("3 new blog posts, pricing page updated").
