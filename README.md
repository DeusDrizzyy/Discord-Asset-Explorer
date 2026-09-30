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

The script scans Discord's Webpack modules, loaded resources, DOM elements, and CSS stylesheets to identify available assets and display them in a clean, searchable interface.

## Features
- Search assets by filename, hash, URL, module, or source
- Filter assets by file extension
- Preview images directly in the interface
- Preview videos
- Play audio files
- Identify related Webpack modules
- Copy asset URLs
- Open assets directly
- Explore resources from multiple Discord sources
- Progressive loading for better performance

Supported formats include:
`PNG` · `JPG` · `JPEG` · `WEBP` · `GIF` · `AVIF` · `SVG` · `ICO` · `MP4` · `WEBM` · `MP3` · `OGG` · `WAV` · `WOFF` · `WOFF2` · `TTF` · `OTF` · `JSON` · `WASM` · `CSS` · `JS`

## Usage
1. Open the **Discord desktop client**.
2. Open **Developer Tools**.
3. Navigate to the **Console** tab.
4. Paste the complete script into the console.
5. Press `Enter`.

The Asset Explorer will automatically scan the available Discord resources and open its interface.

> Only execute code in the Developer Console if you understand and trust its contents.

## How It Works
Discord Asset Explorer collects resources from several parts of the Discord client, including:

- Webpack modules
- Loaded network resources
- DOM elements
- CSS stylesheets

## Notes
Discord relies on internal systems that may change without notice. Future Discord updates may require adjustments to the script.

Some assets may only become available after specific parts of the client have been loaded or opened.

## Disclaimer

This project is intended for development, inspection, and research purposes.

It is not affiliated with, endorsed by, or associated with Discord Inc.

Discord and related trademarks are the property of their respective owners.


---

<div align="center">

If you find this project useful, consider starring the repository.

</div>
