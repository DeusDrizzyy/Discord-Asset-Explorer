# 🔎 Discord Asset Explorer

A lightweight JavaScript utility for exploring assets loaded by the Discord desktop client.

The script scans Discord's Webpack modules, loaded resources, DOM elements, and CSS stylesheets to identify available assets and display them in a clean, searchable interface.

## ✨ Features
- 🔍 Search assets by filename, hash, URL, module, or source
- 🗂️ Filter assets by file extension
- 🖼️ Preview images directly in the interface
- 🎬 Preview videos
- 🎵 Play audio files
- 🧩 Identify related Webpack modules
- 📋 Copy asset URLs
- 🔗 Open assets directly
- 📦 Explore resources from multiple Discord sources
- ⚡ Progressive loading for better performance

Supported formats include:
`PNG` · `JPG` · `JPEG` · `WEBP` · `GIF` · `AVIF` · `SVG` · `ICO` · `MP4` · `WEBM` · `MP3` · `OGG` · `WAV` · `WOFF` · `WOFF2` · `TTF` · `OTF` · `JSON` · `WASM` · `CSS` · `JS`

## 🚀 Usage
1. Open the **Discord desktop client**.
2. Open **Developer Tools**.
3. Navigate to the **Console** tab.
4. Paste the complete script into the console.
5. Press `Enter`.

The Asset Explorer will automatically scan the available Discord resources and open its interface.

> ⚠️ Only execute code in the Developer Console if you understand and trust its contents.

## 🛠️ How It Works
Discord Asset Explorer collects resources from several parts of the Discord client, including:

- Webpack modules
- Loaded network resources
- DOM elements
- CSS stylesheets

## 📌 Notes
Discord relies on internal systems that may change without notice. Future Discord updates may require adjustments to the script.

Some assets may only become available after specific parts of the client have been loaded or opened.

## ⚠️ Disclaimer

This project is intended for development, inspection, and research purposes.

It is not affiliated with, endorsed by, or associated with Discord Inc.

Discord and related trademarks are the property of their respective owners.


---

⭐ If you find this project useful, consider starring the repository.