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

The script scans Discord's Webpack modules, loaded resources, browser cache, DOM elements, and CSS stylesheets to find available assets, then shows them in a searchable, filterable interface with built-in previews and bulk export. It can also discover Discord's lazy Webpack resources and scan their files as text to uncover additional assets without executing the chunks.

## Features

**Discovery**
- Scans Webpack modules, network resources, browser Cache Storage, DOM elements, and CSS stylesheets
- The **Get more assets (lazy chunks)** button discovers additional Webpack JS/CSS resources and scans them as text (with live progress) to find more assets without executing the chunks

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
- Live font specimens for WOFF, WOFF2, TTF, OTF, EOT, and TTC files
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
- Toggle the window with `Ctrl` + `Shift` + `K`, even while typing in a field
- Filter, sort, copy-format, and search settings are remembered between runs
- Results are cached between openings, so reopening is nearly instant
- Progressive loading for better performance
- Close with `Esc`, `Ctrl` + `Shift` + `K`, the close button, or by clicking outside the window

Supported formats include:
`PNG` · `JPG` · `JPEG` · `JFIF` · `WEBP` · `GIF` · `APNG` · `AVIF` · `BMP` · `SVG` · `ICO` · `TIFF` · `MP4` · `WEBM` · `MOV` · `M4V` · `OGV` · `MKV` · `M3U8` · `MP3` · `OGG` · `WAV` · `M4A` · `AAC` · `FLAC` · `OPUS` · `WEBA` · `WOFF` · `WOFF2` · `TTF` · `OTF` · `EOT` · `TTC` · `JSON` · `WASM` · `CSS` · `JS` · `XML` · `TXT` · `WEBMANIFEST` · `LOTTIE` · `RLOTTIE` · `PDF` · `VTT` · `GLSL` · `RIVE`

## Usage
1. Open the **Discord desktop client**.
2. Open **Developer Tools**.
3. Navigate to the **Console** tab.
4. Paste the complete script into the console.
5. Press `Enter`.

The Asset Explorer will automatically scan the available Discord resources and open its interface.

To reopen it after closing, press `Ctrl` + `Shift` + `K` (`Cmd` + `Shift` + `K` on macOS), or run:

```js
openAssetExplorer()
```

The shortcut works as a toggle (it also closes the window) and stays active until you reload Discord. Running the script again replaces the previous instance.

The full asset list is also available in the console as `window.__DISCORD_ASSETS__`, and `window.__copyDiscordAssets()` copies it as JSON.

> Only execute code in the Developer Console if you understand and trust its contents.

## Tips
- Click **Get more assets (lazy chunks)** first if you are looking for assets from parts of the client you have not opened yet.
- Use the size filter to find large files or specific icon sizes, for example `square, under 64 KB`.
- For bulk downloads, prefer a ZIP over separate files, since browsers may prompt before allowing many downloads.
- Downloads and file sizes are fetched by your browser, so assets that block cross-origin requests may fail to download or show an unknown size.

## How It Works
Discord Asset Explorer collects resources from several parts of the Discord client, including:

- Webpack modules
- Lazy Webpack JS/CSS resources (on demand)
- Loaded network resources
- Browser Cache Storage
- DOM elements
- CSS stylesheets

The additional lazy-resource scan resolves Discord's Webpack chunk files and reads their contents as text instead of executing them. CSS `url()` references and asset paths found inside those files are added to the results.

File sizes are read with background `HEAD` requests, image dimensions from the loaded previews, and ZIP files are built in the browser with a small built-in writer, so no external libraries are needed.

Videos and fonts are only loaded when they scroll into view. Pending network requests are cancelled and all listeners, timers, and media are released when the window closes.

## Notes
Discord relies on internal systems that may change without notice. Future Discord updates may require adjustments to the script.

Some assets may only become available after specific parts of the client have been loaded or opened, or after running **Get more assets (lazy chunks)**.

The additional scan fetches Discord-owned Webpack resources and analyzes their contents without executing the discovered chunks, so it may briefly use extra network and CPU while scanning.

The `Ctrl` + `Shift` + `K` shortcut may conflict with a browser or custom Discord keybind (for example, Firefox uses it for the console).

Closing the window while a ZIP is being built cancels it.

## Disclaimer

This project is intended for development, inspection, and research purposes.

It is not affiliated with, endorsed by, or associated with Discord Inc.

Discord and related trademarks are the property of their respective owners.

---

## Contributors

<table>
  <tr>
    <td align="center" width="200">
      <a href="https://github.com/DeusDrizzyy">
        <img src="https://github.com/DeusDrizzyy.png?size=140" width="120" height="120" style="border-radius: 50%;" alt="DeusDrizzyy" />
        <br />
        <strong>DeusDrizzyy</strong>
      </a>
      <br />
      <sub>Creator &amp; Maintainer</sub>
    </td>
    <td align="center" width="200">
      <a href="https://github.com/ItzMeShadow999">
        <img src="https://github.com/ItzMeShadow999.png?size=140" width="120" height="120" style="border-radius: 50%;" alt="ItzMeShadow999" />
        <br />
        <strong>ItzMeShadow999</strong>
      </a>
      <br />
      <sub>Contributor</sub>
    </td>
  </tr>
</table>

Contributions are always welcome. Feel free to open an issue or submit a pull request.

---

<div align="center">

If you find this project useful, consider starring the repository.

</div>