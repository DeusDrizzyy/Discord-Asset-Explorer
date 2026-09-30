<div align="center">

<img src="https://cdn.discordapp.com/assets/content/c92ddc6e60cbb4934debf8ee99ddd9be4bab2f0f3f66bccd2d672c128e3561b9.svg" alt="Discord Asset Explorer" width="240">

# Discord Asset Explorer

**A lightweight JavaScript utility for exploring assets loaded by the Discord desktop client.**

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Discord](https://img.shields.io/badge/Discord-Desktop-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Runs In](https://img.shields.io/badge/Runs%20in-DevTools%20Console-blue?style=for-the-badge&logo=googlechrome&logoColor=white)
![Dependencies](https://img.shields.io/badge/Dependencies-None-success?style=for-the-badge)
![Purpose](https://img.shields.io/badge/Purpose-Research%20%26%20Inspection-orange?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)

</div>

---

The script scans Discord's Webpack modules, loaded resources, DOM elements, and CSS stylesheets to find available assets, then shows them in a searchable, filterable interface with built-in previews and bulk export. It can also load Discord's lazy Webpack chunks to uncover assets that have not been loaded yet.

## Features

**Discovery**
- Scans Webpack modules, network resources, DOM elements, and CSS stylesheets
- "Scan lazy chunks" loads Discord's async Webpack chunks (with live progress) to find more assets

**Search and filtering**
- Search by filename, hash, URL, module, or source
- Regex search toggle (case-insensitive)
- Filter by file extension and by source
- "Selected only" view
- Size and dimension filter written in plain language, for example `over 100 KB`, `under 2 MB`, `wider than 512px`, `taller than 64`, `512x512`, or `square` (combine with commas)
- Sort by name, extension, module count, or source, ascending or descending

**Previews**
- Image previews with a full-screen lightbox (scroll to zoom, drag to pan, double-click to reset)
- Custom video player with seek, mute, and fullscreen
- Custom audio player with a waveform
- Live font specimens for WOFF, WOFF2, TTF, and OTF files
- File size and image dimensions shown on each card

**Copy and export**
- Copy asset URLs as plain URL, Markdown image, CSS `url()`, or an `<img>` tag
- Select individual assets or everything that matches the current filters
- Copy selected assets in your chosen format
- Save single files, or download selected or filtered assets as separate files
- Download selected or filtered assets as a single ZIP, organized into folders by extension (files that could not be fetched are listed in `_failed.txt`)
- Open any asset directly in a new tab
- Related Webpack modules shown for each asset

**Interface**
- Light and dark theme that follows Discord's theme
- Filter, sort, copy-format, and search settings are remembered between runs
- Progressive loading for better performance
- Close with `Esc`, the close button, or by clicking outside the window

Supported formats include:
`PNG` · `JPG` · `JPEG` · `WEBP` · `GIF` · `AVIF` · `SVG` · `ICO` · `MP4` · `WEBM` · `MP3` · `OGG` · `WAV` · `WOFF` · `WOFF2` · `TTF` · `OTF` · `JSON` · `WASM` · `CSS` · `JS`

## Usage
1. Open the **Discord desktop client**.
2. Open **Developer Tools**.
3. Navigate to the **Console** tab.
4. Paste the complete script into the console.
5. Press `Enter`.

The Asset Explorer will automatically scan the available Discord resources and open its interface.

To reopen it after closing, run:

```js
openAssetExplorer()
```

The full asset list is also available in the console as `window.__DISCORD_ASSETS__`, and `window.__copyDiscordAssets()` copies it as JSON.

> Only execute code in the Developer Console if you understand and trust its contents.

## Tips
- Click **Scan lazy chunks** first if you are looking for assets from parts of the client you have not opened yet.
- Use the size filter to find large files or specific icon sizes, for example `square, under 64 KB`.
- For bulk downloads, prefer a ZIP over separate files, since browsers may prompt before allowing many downloads.
- Downloads and file sizes are fetched by your browser, so assets that block cross-origin requests may fail to download or show an unknown size.

## How It Works
Discord Asset Explorer collects resources from several parts of the Discord client, including:

- Webpack modules
- Lazy-loaded Webpack chunks (on demand)
- Loaded network resources
- DOM elements
- CSS stylesheets

File sizes are read with background `HEAD` requests, image dimensions from the loaded previews, and ZIP files are built in the browser with a small built-in writer, so no external libraries are needed.

## Notes
Discord relies on internal systems that may change without notice. Future Discord updates may require adjustments to the script.

Some assets may only become available after specific parts of the client have been loaded or opened, or after running **Scan lazy chunks**.

Scanning lazy chunks causes the client to load chunks it had not loaded yet, so it may briefly use extra network and memory.

## Disclaimer

This project is intended for development, inspection, and research purposes.

It is not affiliated with, endorsed by, or associated with Discord Inc.

Discord and related trademarks are the property of their respective owners.


---

<div align="center">

If you find this project useful, consider starring the repository.

</div>
