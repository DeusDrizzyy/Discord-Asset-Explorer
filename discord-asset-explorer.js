(() => {
	const EXTENSIONS = {
		images: new Set(["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "ico"]),
		videos: new Set(["mp4", "webm"]),
		audios: new Set(["mp3", "ogg", "wav"]),
		fonts: new Set(["woff", "woff2", "ttf", "otf"]),
		others: new Set(["json", "wasm", "css", "js"]),
	};
	const ALL_EXTENSIONS = new Set(Object.values(EXTENSIONS).flatMap(set => [...set]));

	const escapeHTML = str => String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m]);
	const debounce = (func, wait) => {
		let timeout;
		return (...args) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	};
	const sleep = ms => new Promise(r => setTimeout(r, ms));
	const fileOf = url => String(url).split(/[?#]/)[0].split("/").pop() || String(url);
	const fmtTime = t => {
		t = Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
		return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
	};
	const ICON_PLAY =
		'<svg class="i-play" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z"/></svg>';
	const ICON_PAUSE =
		'<svg class="i-pause" viewBox="0 0 24 24" width="18" height="18"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
	const ICON_VOL =
		'<svg class="i-vol" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M11 5.2 6.7 9H4v6h2.7l4.3 3.8z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M14.5 9.2a4 4 0 0 1 0 5.6M17 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>';
	const ICON_REPLAY =
		'<svg class="i-replay" viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4"/></svg>';
	const ICON_FS =
		'<svg viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
	const ICON_MUTE =
		'<svg class="i-mute" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M11 5.2 6.7 9H4v6h2.7l4.3 3.8z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15 9.5l5 5M20 9.5l-5 5"/></svg>';
	const SETTINGS_KEY = "discordAssetExplorer.settings.v1";
	const getStore = (() => {
		let cached;
		return () => {
			if (cached !== undefined) return cached;
			cached = null;
			try {
				if (window.localStorage) cached = window.localStorage;
			} catch (e) {}
			if (!cached) {
				try {
					const f = document.createElement("iframe");
					f.id = "__asset_explorer_store__";
					f.style.display = "none";
					document.body.appendChild(f);
					cached = f.contentWindow.localStorage || null;
				} catch (e) {
					cached = null;
				}
			}
			return cached;
		};
	})();
	const loadSettings = () => {
		try {
			const raw = getStore()?.getItem(SETTINGS_KEY);
			if (raw) return JSON.parse(raw) || {};
		} catch (e) {}
		return window.__DISCORD_ASSET_EXPLORER_SETTINGS__ || {};
	};
	const storeSettings = obj => {
		window.__DISCORD_ASSET_EXPLORER_SETTINGS__ = obj;
		try {
			getStore()?.setItem(SETTINGS_KEY, JSON.stringify(obj));
		} catch (e) {}
	};
	const formatBytes = n => {
		if (n == null || isNaN(n)) return "?";
		if (n < 1024) return n + " B";
		if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
		return (n / 1048576).toFixed(2) + " MB";
	};

	const CRC_TABLE = (() => {
		const t = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) c = c && 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			t[n] = c >>> 0;
		}
		return t;
	})();
	const crc32 = data => {
		let c = 0xffffffff;
		for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};

	class StoreZip {
		constructor() {
			this.parts = [];
			this.central = [];
			this.offset = 0;
			this.count = 0;
			this.enc = new TextEncoder();
		}

		add(name, data, date = new Date()) {
			const nameBytes = this.enc.encode(name);
			const crc = crc32(data);
			const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
			const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
			const lh = new DataView(new ArrayBuffer(30));
			lh.setUint32(0, 0x04034b50, true);
			lh.setUint16(4, 20, true);
			lh.setUint16(6, 0x0800, true);
			lh.setUint16(8, 0, true);
			lh.setUint16(10, time, true);
			lh.setUint16(12, day, true);
			lh.setUint32(14, crc, true);
			lh.setUint32(18, data.length, true);
			lh.setUint32(22, data.length, true);
			lh.setUint16(26, nameBytes.length, true);
			lh.setUint16(28, 0, true);
			this.parts.push(lh.buffer, nameBytes, data);
			const ch = new DataView(new ArrayBuffer(46));
			ch.setUint32(0, 0x02014b50, true);
			ch.setUint16(4, 20, true);
			ch.setUint16(6, 20, true);
			ch.setUint16(8, 0x0800, true);
			ch.setUint16(10, 0, true);
			ch.setUint16(12, time, true);
			ch.setUint16(14, day, true);
			ch.setUint32(16, crc, true);
			ch.setUint32(20, data.length, true);
			ch.setUint32(24, data.length, true);
			ch.setUint16(28, nameBytes.length, true);
			ch.setUint32(42, this.offset, true);
			this.central.push(ch.buffer, nameBytes);
			this.offset += 30 + nameBytes.length + data.length;
			this.count++;
		}

		finish() {
			let cdSize = 0;
			for (const p of this.central) cdSize += p.byteLength;
			const end = new DataView(new ArrayBuffer(22));
			end.setUint32(0, 0x06054b50, true);
			end.setUint16(8, this.count, true);
			end.setUint16(10, this.count, true);
			end.setUint32(12, cdSize, true);
			end.setUint32(16, this.offset, true);
			return new Blob([...this.parts, ...this.central, end.buffer], { type: "application/zip" });
		}
	}

	class DiscordAssetExplorer {
		constructor() {
			document.getElementById("__asset_explorer__")?.remove();
			document.getElementById("__asset_lightbox__")?.remove();
			this.assets = new Map();
			this.pageSize = 80;
			this.visibleCount = this.pageSize;
			this.wreq = null;
			this.selected = new Set();
			this.meta = new Map();
			this.metaEls = new Map();
			this.sizeQueue = [];
			this.sizeActive = 0;
			this.sortKey = "extension";
			this.sortDir = 1;
			this.copyFormat = "url";
			this.filtered = [];
			this.busy = false;
			this.lb = null;
			this.fontFaces = new Map();
			this.measureRules = null;
			this.regexOn = false;
			this.regex = null;
			this.dimQueue = [];
			this.dimActive = 0;
			this.sizeLimit = 4;
			this._mPending = 0;
			this._mTimer = null;
			this.destroyed = false;
			this.init();
		}

		init() {
			console.group("%cDiscord Asset Explorer", "color:#5865f2;font-size:16px;font-weight:bold");
			this.hookWebpack();
			this.extractAll();
			this.assetList = this.buildAssetList();
			console.log("✅ " + this.assetList.length + " assets found.");
			console.groupEnd();
			this.exportGlobals();
			this.renderUI();
		}

		extractAll() {
			this.extractFromWebpack();
			this.extractFromPerformance();
			this.extractFromDOM();
			this.extractFromCSS();
		}

		hookWebpack() {
			if (typeof webpackChunkdiscord_app === "undefined") return;
			this.wreq = webpackChunkdiscord_app.push([[Symbol("asset_explorer_ext")], {}, r => r]);
			webpackChunkdiscord_app.pop();
		}

		getExtension(url) {
			try {
				const s = String(url);
				if (s.startsWith("data:")) {
					const m = s.match(/^data:[^/]+\/([a-z0-9+.-]+)/i);
					return m ? m[1].toLowerCase().replace("svg+xml", "svg") : "";
				}
				if (s.startsWith("blob:")) return "";
				const clean = s.split(/[?#]/)[0];
				return clean.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "";
			} catch {
				return "";
			}
		}

		normalizeURL(raw) {
			if (!raw) return null;
			let url = String(raw)
				.replace(/\\(\/|u002F)/g, "/")
				.trim()
				.replace(/^["'`]|["'`]$/g, "");
			if (url.startsWith("data:") || url.startsWith("blob:")) return url;
			if (/^https?:\/\//i.test(url)) return url;
			try {
				if (url.startsWith("//")) return location.protocol + url;
				if (url.startsWith("/")) return new URL(url, location.origin).href;
				if (url.startsWith("assets/")) return new URL("/" + url, location.origin).href;
				if (/^[a-f0-9]{8,}\.[a-z0-9]+$/i.test(url)) return new URL("/assets/" + url, location.origin).href;
				if (this.wreq?.p) return new URL(url, this.wreq.p).href;
			} catch {}
			return null;
		}

		addAsset(raw, source, moduleId = null) {
			const url = this.normalizeURL(raw);
			if (!url) return;
			const extension = this.getExtension(url);
			if (!ALL_EXTENSIONS.has(extension) && !url.startsWith("data:") && !url.startsWith("blob:")) return;
			let item = this.assets.get(url);
			if (!item) {
				item = { url, extension, sources: new Set(), modules: new Set() };
				this.assets.set(url, item);
			}
			item.sources.add(source);
			if (moduleId != null) item.modules.add(String(moduleId));
		}

		extractFromWebpack() {
			if (!this.wreq || !this.wreq.m) return;
			const extPattern = [...ALL_EXTENSIONS].join("|");
			const assetRegex = new RegExp("(?:https?:\\/\\/[^\"'\\\\\\s\\)]+|\\/?assets\\/[^\"'\\\\\\s\\)]+|[a-f0-9]{8,}\\.(?:" + extPattern + "))", "gi");
			for (const [moduleId, fn] of Object.entries(this.wreq.m)) {
				try {
					const source = fn.toString();
					assetRegex.lastIndex = 0;
					let match;
					while ((match = assetRegex.exec(source)) !== null) {
						this.addAsset(match[0], "webpack", moduleId);
					}
				} catch {}
			}
		}

		extractFromPerformance() {
			try {
				performance.getEntriesByType("resource").forEach(entry => {
					this.addAsset(entry.name, "performance");
				});
			} catch {}
		}

		extractFromDOM() {
			document.querySelectorAll("img, video, audio, source, link, script").forEach(el => {
				["src", "href", "poster"].forEach(attr => {
					const value = el.getAttribute(attr);
					if (value) this.addAsset(value, "dom:" + el.tagName.toLowerCase());
				});
			});
		}

		extractFromCSS() {
			const regex = /url\(["']?([^"')]+)["']?\)/g;
			const walkRules = rules => {
				for (const rule of rules) {
					if (rule.cssRules) walkRules(rule.cssRules);
					regex.lastIndex = 0;
					let match;
					while ((match = regex.exec(rule.cssText || "")) !== null) {
						this.addAsset(match[1], "css");
					}
				}
			};
			for (const sheet of [...document.styleSheets]) {
				try {
					if (sheet.cssRules) walkRules(sheet.cssRules);
				} catch {}
			}
		}

		buildAssetList() {
			return [...this.assets.values()]
				.map(item => ({ url: item.url, extension: item.extension, sources: [...item.sources], modules: [...item.modules] }))
				.sort((a, b) => a.extension.localeCompare(b.extension) || a.url.localeCompare(b.url));
		}

		exportGlobals() {
			window.__DISCORD_ASSETS__ = this.assetList;
			window.__copyDiscordAssets = () => {
				const json = JSON.stringify(this.assetList, null, 2);
				try {
					copy(json);
				} catch {
					navigator.clipboard.writeText(json).catch(() => console.error("Failed to copy."));
				}
			};
		}

		async scanChunks() {
			if (this.busy) return;
			if (!this.wreq?.m || !this.wreq.e) return this.setStatus("Webpack chunk loader not available.", null, 3000);
			this.busy = true;
			const tried = new Set();
			const idRegex = /\.e\(\s*["']?(\d+)["']?\s*\)/g;
			const before = this.assets.size;
			let done = 0;
			let total = 0;
			try {
				for (let round = 0; round < 4; round++) {
					const ids = new Set();
					for (const fn of Object.values(this.wreq.m)) {
						try {
							const src = fn.toString();
							idRegex.lastIndex = 0;
							let m;
							while ((m = idRegex.exec(src)) !== null) if (!tried.has(m[1])) ids.add(m[1]);
						} catch {}
					}
					if (!ids.size) break;
					const queue = [...ids];
					queue.forEach(id => tried.add(id));
					total += queue.length;
					const worker = async () => {
						while (queue.length) {
							const id = queue.shift();
							try {
								await Promise.race([this.wreq.e(id), sleep(15000).then(() => Promise.reject(new Error("timeout")))]);
								if (typeof this.wreq.u === "function") this.addAsset(this.wreq.u(id), "chunk");
							} catch {}
							done++;
							this.setStatus("Scanning chunks " + done + "/" + total + " (round " + (round + 1) + ")", (done / total) * 100);
						}
					};
					await Promise.all(Array.from({ length: 6 }, worker));
				}
				this.extractAll();
				this.refreshList();
				this.setStatus("Chunk scan done: " + (this.assets.size - before) + " new assets from " + total + " chunks.", null, 4000);
			} finally {
				this.busy = false;
			}
		}

		refreshList() {
			this.assetList = this.buildAssetList();
			window.__DISCORD_ASSETS__ = this.assetList;
			this.populateFilters();
			this.updateGrid();
		}

		detectTheme() {
			const h = document.documentElement;
			const b = document.body;
			const has = c => h.classList.contains(c) || (b && b.classList.contains(c));
			if (has("theme-light") || h.dataset.theme === "light") return "light";
			if (has("theme-dark") || has("theme-darker") || has("theme-midnight") || h.dataset.theme === "dark") return "dark";
			return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
		}

		applyTheme() {
			const t = this.detectTheme();
			if (t === this.theme) return;
			this.theme = t;
			this.root.dataset.aeTheme = t;
			this.root.querySelectorAll(".ae-wave").forEach(c => this.paintPlayer(this.playerOf(c)));
		}

		initTheme() {
			this.theme = null;
			this.applyTheme();
			this._themeMO = new MutationObserver(() => this.applyTheme());
			this._themeMO.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
			if (document.body) this._themeMO.observe(document.body, { attributes: true, attributeFilter: ["class"] });
			this._themeMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
			this._themeMQFn = () => this.applyTheme();
			this._themeMQ?.addEventListener?.("change", this._themeMQFn);
		}

		renderUI() {
			this.root = document.createElement("div");
			this.root.id = "__asset_explorer__";
			this.root.innerHTML = this.getHTMLTemplate();
			document.body.appendChild(this.root);
			this.initTheme();
			this.cacheDOM();
			this.initSelects();
			this.bindEvents();
			this.initTooltips();
			this.populateFilters();
			this.initSettings();
			this.updateGrid();
		}

		getHTMLTemplate() {
			return `<style>
:root { --ae-bg:#111214; --ae-card:#1e1f22; --ae-card-hover:rgba(88,101,242,.55); --ae-text:#dbdee1; --ae-muted:#949ba4; --ae-accent:#5865f2; --ae-border:rgba(255,255,255,.07); --ae-shadow:0 25px 100px rgba(0,0,0,.75); }
#__asset_explorer__ { position:fixed; inset:0; z-index:2147483647; font-family:"gg sans",Whitney,Arial,sans-serif; color:var(--ae-text); animation:aeFadeIn .2s ease-out; }
@keyframes aeFadeIn { from{opacity:0} to{opacity:1} }
#__asset_explorer__ * { box-sizing:border-box; }
#__asset_explorer__ ::-webkit-scrollbar { width:8px; }
#__asset_explorer__ ::-webkit-scrollbar-track { background:var(--ae-bg); }
#__asset_explorer__ ::-webkit-scrollbar-thumb { background:#2b2d31; border-radius:4px; }
.ae-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.8); backdrop-filter:blur(4px); display:flex; justify-content:center; align-items:center; padding:25px; }
.ae-modal { width:min(1400px,97vw); height:min(900px,94vh); background:var(--ae-bg); border:1px solid var(--ae-border); border-radius:12px; box-shadow:var(--ae-shadow); display:flex; flex-direction:column; overflow:hidden; }
.ae-header { padding:18px 20px; border-bottom:1px solid var(--ae-border); display:flex; align-items:center; gap:14px; position:relative; }
.ae-heading { flex:1; }
.ae-heading h2 { margin:0; font-size:19px; color:#fff; }
.ae-heading p { margin:4px 0 0; font-size:12px; color:var(--ae-muted); }
.ae-close { border:0; width:36px; height:36px; border-radius:50%; background:transparent; color:var(--ae-muted); font-size:24px; cursor:pointer; transition:.2s; }
.ae-close:hover { background:transparent; color:#fff; }
.ae-toolbar { padding:10px 18px; display:flex; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--ae-border); background:#17181a; align-items:center; }
.ae-input { height:36px; border:1px solid var(--ae-border); background:var(--ae-card); color:var(--ae-text); border-radius:8px; padding:0 10px; outline:none; transition:.2s; font-size:13px; }
.ae-search { flex:1; min-width:200px; }
.ae-input:focus { border-color:var(--ae-accent); }
.ae-info { margin-left:auto; font-size:13px; font-weight:500; color:var(--ae-accent); white-space:nowrap; }
.ae-toolbar { position:relative; z-index:1; }
.ae-toolbar.ae-toolbar-top { z-index:6; }
.ae-select { position:relative; display:inline-block; }
.ae-select > select { display:none; }
.ae-select-btn { display:flex; align-items:center; gap:8px; font-family:inherit; cursor:pointer; user-select:none; }
.ae-select-btn:hover { border-color:rgba(255,255,255,.16); }
.ae-select.open .ae-select-btn { border-color:var(--ae-accent); }
.ae-select-label { display:grid; text-align:left; white-space:nowrap; }
.ae-select-label > * { grid-area:1/1; }
.ae-select-label .sz { visibility:hidden; height:0; overflow:hidden; pointer-events:none; }
.ae-select-chev { flex:none; color:var(--ae-muted); transition:transform .28s cubic-bezier(.16,1,.3,1), color .15s; }
.ae-select.open .ae-select-chev { transform:rotate(180deg); color:#fff; }
.ae-select-menu { position:absolute; top:calc(100% + 6px); left:0; z-index:20; min-width:100%; width:max-content; max-width:340px; max-height:288px; overflow-y:auto; padding:6px; background:#1e1f22; border:1px solid var(--ae-border); border-radius:10px; box-shadow:var(--ae-shadow); visibility:hidden; opacity:0; transform:translateY(-8px) scale(.95); transform-origin:top left; pointer-events:none; will-change:opacity,transform; transition:opacity .15s cubic-bezier(.4,0,1,1), transform .18s cubic-bezier(.4,0,1,1), visibility 0s linear .18s; }
.ae-select-menu.align-right { left:auto; right:0; transform-origin:top right; }
.ae-select.open .ae-select-menu { visibility:visible; opacity:1; transform:none; pointer-events:auto; transition:opacity .16s ease-out, transform .28s cubic-bezier(.16,1,.3,1), visibility 0s; }
.ae-select.open .ae-opt { animation:aeOptIn .26s cubic-bezier(.16,1,.3,1) both; animation-delay:calc(min(var(--i,0),9) * 16ms); }
@keyframes aeOptIn { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion:reduce) { .ae-select-menu, .dl-menu, .ae-select-chev { transition-duration:.01s !important; } .ae-select.open .ae-opt { animation:none; } }
.ae-opt { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 10px; border-radius:6px; font-size:13px; color:var(--ae-text); cursor:pointer; white-space:nowrap; }
.ae-opt.selected { color:#fff; font-weight:600; }
.ae-opt.active { background:var(--ae-accent); color:#fff; }
.ae-opt svg { flex:none; visibility:hidden; color:#8b95ff; }
.ae-opt.selected svg { visibility:visible; }
.ae-opt.active svg { color:#fff; }
.ae-tbtn { height:32px; border:0; border-radius:6px; padding:0 12px; background:#2b2d31; color:var(--ae-text); cursor:pointer; font-size:12px; font-weight:500; transition:.15s; }
.ae-tbtn:hover { background:#35373c; color:#fff; }
.ae-status { display:none; position:relative; height:26px; background:#17181a; border-bottom:1px solid var(--ae-border); font-size:12px; color:var(--ae-text); }
.ae-status.on { display:block; }
.ae-status-fill { position:absolute; left:0; top:0; bottom:0; width:0; background:rgba(88,101,242,.35); transition:width .15s; }
.ae-status span { position:relative; line-height:26px; padding:0 18px; }
.ae-body { flex:1; overflow-y:auto; padding:16px; background:#141517; }
.ae-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
.ae-card { background:var(--ae-card); border:1px solid var(--ae-border); border-radius:10px; overflow:hidden; transition:border-color .2s; display:flex; flex-direction:column; }
.ae-card:hover { border-color:var(--ae-card-hover); }
.ae-card.ae-selected { border-color:var(--ae-accent); box-shadow:0 0 0 1px var(--ae-accent); }
.ae-preview { height:150px; background:repeating-conic-gradient(#17181a 0% 25%,#1b1c1f 0% 50%) 50%/20px 20px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
.ae-preview img, .ae-preview video { max-width:100%; max-height:100%; object-fit:contain; }
.ae-video { position:relative; width:100%; height:100%; background:#000; user-select:none; }
.ae-video video { width:100%; height:100%; max-width:none; max-height:none; object-fit:contain; display:block; cursor:pointer; }
.ae-vbig { position:absolute; left:50%; top:calc(50% - 16px); transform:translate(-50%,-50%); width:44px; height:44px; padding:0; border:0; border-radius:50%; background:rgba(0,0,0,.6); color:#fff; display:grid; place-items:center; cursor:pointer; backdrop-filter:blur(4px); transition:transform .1s, background-color .1s, opacity .15s; }
.ae-vbig:hover { background:rgba(0,0,0,.8); transform:translate(-50%,-50%) scale(1.08); }
.ae-video.playing .ae-vbig, .ae-video.ended .ae-vbig { opacity:0; pointer-events:none; }
.ae-vbar { position:absolute; left:0; right:0; bottom:0; height:32px; display:flex; align-items:center; gap:6px; padding:0 6px; background:rgba(0,0,0,.45); backdrop-filter:blur(2px); color:#fff; z-index:3; }
.ae-vbtn { flex:none; width:24px; height:24px; padding:0; border:0; background:transparent; color:#fff; display:grid; place-items:center; cursor:pointer; border-radius:4px; opacity:.9; transition:opacity .1s, background-color .1s; }
.ae-vbtn:hover { opacity:1; background:rgba(255,255,255,.15); }
.ae-vbtn svg { display:block; }
.ae-video .i-pause, .ae-video.playing .i-play { display:none; }
.ae-video.playing .i-pause { display:block; }
.ae-video .i-replay { display:none; }
.ae-video.ended .i-replay { display:block; }
.ae-video.ended .i-play, .ae-video.ended .i-pause { display:none; }
.ae-video .i-mute, .ae-video.muted .i-vol { display:none; }
.ae-video.muted .i-mute { display:block; }
.ae-vtime { flex:none; font-size:11px; font-weight:500; font-variant-numeric:tabular-nums; white-space:nowrap; color:#dbdee1; }
.ae-vprog { flex:1; min-width:20px; height:14px; display:flex; align-items:center; cursor:pointer; touch-action:none; }
.ae-vtrack { position:relative; width:100%; height:4px; border-radius:2px; background:rgba(255,255,255,.3); }
.ae-vfill { position:absolute; left:0; top:0; bottom:0; width:0; border-radius:2px; background:var(--ae-accent); }
.ae-vprog:hover .ae-vtrack { height:6px; }
.ae-video:fullscreen { width:100vw; height:100vh; }
.ae-video:fullscreen .ae-vbar { height:44px; padding:0 14px; gap:10px; }
.ae-video:fullscreen .ae-vtime { font-size:13px; }
.ae-vbar { transition:opacity .25s; }
.ae-video:fullscreen .ae-vbar { transition:opacity .25s; }
.ae-video.ae-idle .ae-vbar { opacity:0; pointer-events:none; }
.ae-video.ae-idle, .ae-video.ae-idle video { cursor:none; }
.ae-preview img { cursor:zoom-in; }
.ae-audio { display:flex; align-items:center; gap:8px; width:calc(100% - 16px); height:48px; padding:0 10px 0 8px; background:#2b2d31; border-radius:24px; box-shadow:0 0 0 1px rgba(255,255,255,.05), 0 2px 8px rgba(0,0,0,.35); user-select:none; }
.ae-audio audio { display:none; }
.ae-play { flex:none; width:32px; height:32px; padding:0; border:0; border-radius:50%; background:var(--ae-accent); color:#fff; display:grid; place-items:center; cursor:pointer; transition:background-color .1s, transform .1s; }
.ae-play:hover { background:#4752c4; }
.ae-play:active { transform:scale(.93); }
.ae-play svg { display:block; }
.ae-audio .i-pause, .ae-audio.playing .i-play { display:none; }
.ae-audio.playing .i-pause { display:block; }
.ae-wave { flex:1; min-width:0; height:32px; display:block; cursor:pointer; touch-action:none; }
.ae-atime { flex:none; min-width:28px; text-align:right; font-size:12px; font-weight:500; font-variant-numeric:tabular-nums; color:#b5bac1; }
.ae-vol { flex:none; width:20px; height:20px; padding:0; border:0; background:transparent; color:#b5bac1; display:grid; place-items:center; cursor:pointer; transition:color .1s; }
.ae-vol:hover { color:#fff; }
.ae-vol svg { display:block; }
.ae-audio .i-mute, .ae-audio.muted .i-vol { display:none; }
.ae-audio.muted .i-mute { display:block; }
.ae-audio.ae-aerr .ae-atime { color:#f23f43; }
.ae-icon { font-size:24px; color:var(--ae-muted); font-weight:bold; }
.ae-measure { width:270px; }
.ae-tbtn.ae-regex { min-width:36px; font-family:Consolas,monospace; font-weight:700; }
.ae-tbtn.on, .ae-tbtn.on:hover { background:var(--ae-accent); color:#fff; }
.ae-input.ae-bad { border-color:#f23f43; }
.ae-font { width:100%; height:100%; padding:10px 14px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; text-align:center; font-family:serif; color:var(--ae-text); opacity:.45; transition:opacity .2s; overflow:hidden; }
.ae-font.ready { opacity:1; }
.ae-font-big { font-size:46px; line-height:1; white-space:nowrap; }
.ae-font-line { max-width:100%; font-size:14px; line-height:1.3; overflow:hidden; overflow-wrap:anywhere; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.ae-font-digits { font-size:12px; opacity:.75; white-space:nowrap; }
.ae-font.err { opacity:1; }
.ae-font.err .ae-font-line, .ae-font.err .ae-font-digits { display:none; }
.ae-font.err::after { content:'Preview unavailable'; font:11px Arial,sans-serif; color:var(--ae-muted); }
.ae-check { position:absolute; top:8px; left:8px; z-index:2; width:24px; height:24px; background:rgba(17,18,20,.6); backdrop-filter:blur(4px); border-radius:7px; display:grid; place-items:center; cursor:pointer; opacity:.55; transition:opacity .15s, background .15s; }
.ae-card:hover .ae-check, .ae-card.ae-selected .ae-check { opacity:1; }
.ae-check input { appearance:none; -webkit-appearance:none; width:16px; height:16px; margin:0; cursor:pointer; border:2px solid #b5bac1; border-radius:5px; background:transparent center/12px no-repeat; transition:background-color .15s, border-color .15s, transform .1s; }
.ae-check:hover input { border-color:#fff; }
.ae-check input:active { transform:scale(.88); }
.ae-check input:checked { background-color:var(--ae-accent); border-color:var(--ae-accent); background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.4l2.3 2.3 4.7-5' fill='none' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); }
.ae-card-body { padding:12px; flex:1; display:flex; flex-direction:column; }
.ae-type { align-self:flex-start; padding:3px 8px; border-radius:4px; background:rgba(88,101,242,.15); color:#aeb5ff; font-size:10px; text-transform:uppercase; font-weight:bold; }
.ae-name { margin-top:8px; font-family:Consolas,monospace; font-size:12px; color:var(--ae-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ae-dim { margin-top:4px; font-size:11px; color:#aeb5ff; font-family:Consolas,monospace; }
.ae-meta { margin-top:auto; padding-top:8px; font-size:11px; color:#80848e; line-height:1.5; }
.ae-actions { display:flex; gap:6px; margin-top:10px; }
.ae-btn { flex:1; border:0; border-radius:6px; height:32px; color:var(--ae-text); background:#2b2d31; cursor:pointer; font-size:12px; font-weight:500; transition:.15s; }
.ae-btn:hover { background:#35373c; color:#fff; }
.ae-btn-primary { background:var(--ae-accent); color:#fff; margin:20px auto 10px; display:block; padding:10px 24px; flex:none; }
.ae-btn-primary:hover { background:#4752c4; }
.dl-wrap { position:relative; }
.dl-btn { height:32px; border:0; border-radius:3px; padding:0 16px; background:var(--ae-accent); color:#fff; font-weight:500; font-size:14px; box-shadow:none; cursor:pointer; display:flex; align-items:center; gap:6px; transition:background-color .1s ease; }
.dl-btn:hover { background:#4752c4; }
.dl-menu { position:absolute; right:0; top:42px; width:260px; background:#1e1f22; border:1px solid var(--ae-border); border-radius:10px; box-shadow:var(--ae-shadow); padding:6px; z-index:10; visibility:hidden; opacity:0; transform:translateY(-8px) scale(.95); transform-origin:top right; pointer-events:none; will-change:opacity,transform; transition:opacity .15s cubic-bezier(.4,0,1,1), transform .18s cubic-bezier(.4,0,1,1), visibility 0s linear .18s; }
.dl-menu.open { visibility:visible; opacity:1; transform:none; pointer-events:auto; transition:opacity .16s ease-out, transform .28s cubic-bezier(.16,1,.3,1), visibility 0s; }
.dl-menu-item { width:100%; text-align:left; border:0; background:transparent; color:var(--ae-text); padding:9px 10px; border-radius:6px; cursor:pointer; font-size:13px; display:flex; justify-content:space-between; }
.dl-menu-item:hover { background:var(--ae-accent); color:#fff; }
.dl-menu-item small { opacity:.7; }
.ae-tip { --ae-tip-bg:#0a0a0c; --ae-tip-border:rgba(151,151,159,.2); position:fixed; z-index:2147483647; left:0; top:0; display:flex; align-items:center; box-sizing:border-box; max-width:200px; padding:8px 12px; background:var(--ae-tip-bg); color:#d4d5d8; border-radius:8px; box-shadow:inset 0 0 0 1px var(--ae-tip-border), 0 12px 24px rgba(0,0,0,.24); text-align:center; pointer-events:none; user-select:none; opacity:0; transform:scale(.92); transition:opacity .12s ease, transform .14s cubic-bezier(.2,.9,.3,1.15); will-change:opacity,transform; }
.ae-tip.top { transform-origin:var(--ae-arrow-x,50%) 100%; }
.ae-tip.bottom { transform-origin:var(--ae-arrow-x,50%) 0; }
.ae-tip.show { opacity:1; transform:scale(1); }
.ae-tip-text { overflow:hidden; overflow-wrap:anywhere; font-size:14px; font-weight:500; line-height:18px; }
.ae-tip-caret { position:absolute; left:var(--ae-arrow-x,50%); margin-left:-8px; width:16px; height:10px; overflow:visible; pointer-events:none; z-index:1; }
.ae-tip.top .ae-tip-caret { top:calc(100% - 1.4px); }
.ae-tip.bottom .ae-tip-caret { bottom:calc(100% - 1.4px); transform:scaleY(-1); }
.ae-tip-fill { fill:var(--ae-tip-bg); stroke:none; }
.ae-tip-stroke { fill:none; stroke:var(--ae-tip-border); stroke-width:2; stroke-linejoin:round; }
#__asset_explorer__[data-ae-theme="light"] { color-scheme:light; --ae-bg:#ffffff; --ae-card:#ffffff; --ae-card-hover:rgba(88,101,242,.55); --ae-text:#313338; --ae-muted:#5c5e66; --ae-border:rgba(0,0,0,.1); --ae-shadow:0 12px 48px rgba(0,0,0,.22); }
#__asset_explorer__[data-ae-theme="dark"] { color-scheme:dark; }
#__asset_explorer__[data-ae-theme="light"] ::-webkit-scrollbar-thumb { background:#c4c9ce; }
#__asset_explorer__[data-ae-theme="light"] .ae-backdrop { background:rgba(0,0,0,.5); }
#__asset_explorer__[data-ae-theme="light"] .ae-heading h2 { color:#060607; }
#__asset_explorer__[data-ae-theme="light"] .ae-close:hover { color:#060607; }
#__asset_explorer__[data-ae-theme="light"] .ae-toolbar { background:#f2f3f5; }
#__asset_explorer__[data-ae-theme="light"] .ae-input { border-color:rgba(0,0,0,.14); }
#__asset_explorer__[data-ae-theme="light"] .ae-select-btn:hover { border-color:rgba(0,0,0,.28); }
#__asset_explorer__[data-ae-theme="light"] .ae-select.open .ae-select-chev { color:#060607; }
#__asset_explorer__[data-ae-theme="light"] .ae-select-menu, #__asset_explorer__[data-ae-theme="light"] .dl-menu { background:#ffffff; }
#__asset_explorer__[data-ae-theme="light"] .ae-opt.selected { color:#060607; }
#__asset_explorer__[data-ae-theme="light"] .ae-opt.active { color:#fff; }
#__asset_explorer__[data-ae-theme="light"] .ae-tbtn, #__asset_explorer__[data-ae-theme="light"] .ae-btn:not(.ae-btn-primary) { background:#e3e5e8; }
#__asset_explorer__[data-ae-theme="light"] .ae-tbtn:hover, #__asset_explorer__[data-ae-theme="light"] .ae-btn:not(.ae-btn-primary):hover { background:#d7d9dc; color:#060607; }
#__asset_explorer__[data-ae-theme="light"] .ae-status { background:#f2f3f5; }
#__asset_explorer__[data-ae-theme="light"] .ae-tbtn.on, #__asset_explorer__[data-ae-theme="light"] .ae-tbtn.on:hover { background:var(--ae-accent); color:#fff; }
#__asset_explorer__[data-ae-theme="light"] .ae-body { background:#f2f3f5; }
#__asset_explorer__[data-ae-theme="light"] .ae-preview { background:repeating-conic-gradient(#e3e5e8 0% 25%,#eceef0 0% 50%) 50%/20px 20px; }
#__asset_explorer__[data-ae-theme="light"] .ae-audio { background:#e3e5e8; box-shadow:0 0 0 1px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.12); }
#__asset_explorer__[data-ae-theme="light"] .ae-atime, #__asset_explorer__[data-ae-theme="light"] .ae-vol { color:#4e5058; }
#__asset_explorer__[data-ae-theme="light"] .ae-vol:hover { color:#060607; }
#__asset_explorer__[data-ae-theme="light"] .ae-audio.ae-aerr .ae-atime { color:#d83c3e; }
#__asset_explorer__[data-ae-theme="light"] .ae-check { background:rgba(255,255,255,.8); }
#__asset_explorer__[data-ae-theme="light"] .ae-check input:not(:checked) { border-color:#80848e; }
#__asset_explorer__[data-ae-theme="light"] .ae-check:hover input:not(:checked) { border-color:#060607; }
#__asset_explorer__[data-ae-theme="light"] .ae-type { color:#4752c4; }
#__asset_explorer__[data-ae-theme="light"] .ae-dim { color:#4752c4; }
#__asset_explorer__[data-ae-theme="light"] .ae-meta { color:#5c5e66; }
</style>
<div class="ae-backdrop"><div class="ae-modal">
  <div class="ae-header">
    <div class="ae-heading"><h2>Discord Asset Explorer</h2></div>
    <div class="dl-wrap">
      <button class="dl-btn" data-act="dl-toggle" title="Download assets">⬇ Download</button>
      <div class="dl-menu">
        <button class="dl-menu-item" data-act="dl-sel-files">Selected, separate files <small class="dl-n-sel"></small></button>
        <button class="dl-menu-item" data-act="dl-sel-zip">Selected, one ZIP <small class="dl-n-sel"></small></button>
        <button class="dl-menu-item" data-act="dl-flt-zip">All filtered, one ZIP <small class="dl-n-flt"></small></button>
        <button class="dl-menu-item" data-act="dl-flt-files">All filtered, separate files <small class="dl-n-flt"></small></button>
      </div>
    </div>
    <button class="ae-close" title="Close">×</button>
  </div>
  <div class="ae-toolbar">
    <input class="ae-input ae-search" placeholder="Search by hash, extension, module or URL..." spellcheck="false">
    <button class="ae-tbtn ae-regex" type="button" aria-pressed="false" title="Regex search: match file names by pattern (case-insensitive)">.*</button>
    <select class="ae-input ae-filter"><option value="">All Extensions</option></select>
    <select class="ae-input ae-source"><option value="">All Sources</option></select>
    <select class="ae-input ae-status-filter"><option value="">All assets</option><option value="selected">Selected only</option></select>
    <input class="ae-input ae-measure" placeholder="Size filter: over 100 KB, wider than 512px" title="Filter by file size and image dimensions. Examples: over 100 KB, under 2 MB, wider than 512px, taller than 64, 512x512, square. Combine with commas." spellcheck="false">
    <select class="ae-input ae-sort">
      <option value="name">Sort: Name</option>
      <option value="extension" selected>Sort: Extension</option>
      <option value="modules">Sort: Module count</option>
      <option value="source">Sort: Source</option>
    </select>
    <button class="ae-tbtn ae-sortdir" title="Toggle sort direction">▲</button>
    <select class="ae-input ae-fmt" title="Copy format">
      <option value="url">Copy: URL</option>
      <option value="md">Copy: Markdown</option>
      <option value="css">Copy: CSS url()</option>
      <option value="html">Copy: &lt;img&gt;</option>
    </select>
    <div class="ae-info">0 Assets</div>
  </div>
  <div class="ae-toolbar">
    <button class="ae-tbtn" data-act="selall">Select all filtered</button>
    <button class="ae-tbtn" data-act="clear">Clear selection</button>
    <button class="ae-tbtn" data-act="copysel">Copy selected</button>
    <button class="ae-tbtn" data-act="scan" title="Loads Discord's async webpack chunks to find more assets">Scan lazy chunks</button>
  </div>
  <div class="ae-status"><div class="ae-status-fill"></div><span></span></div>
  <div class="ae-body"><div class="ae-grid"></div><button class="ae-btn ae-btn-primary ae-load-more" style="display:none">Load More</button></div>
</div></div>`;
		}

		cacheDOM() {
			const q = s => this.root.querySelector(s);
			this.$grid = q(".ae-grid");
			this.$search = q(".ae-search");
			this.$filter = q(".ae-filter");
			this.$source = q(".ae-source");
			this.$statusFilter = q(".ae-status-filter");
			this.$sort = q(".ae-sort");
			this.$sortDir = q(".ae-sortdir");
			this.$fmt = q(".ae-fmt");
			this.$measure = q(".ae-measure");
			this.$regex = q(".ae-regex");
			this.$info = q(".ae-info");
			this.$loadMore = q(".ae-load-more");
			this.$close = q(".ae-close");
			this.$backdrop = q(".ae-backdrop");
			this.$menu = q(".dl-menu");
			this.$status = q(".ae-status");
			this.$statusFill = q(".ae-status-fill");
			this.$statusText = q(".ae-status span");
		}

		initSelects() {
			this.selects = [];
			this.root.querySelectorAll(".ae-toolbar select").forEach(sel => this.selects.push(this.enhanceSelect(sel)));
			this.root.addEventListener("pointerdown", e => {
				this.selects.forEach(sl => {
					if (sl.open && !sl.wrap.contains(e.target)) this.closeSelect(sl);
				});
			});
		}

		enhanceSelect(sel) {
			const wrap = document.createElement("div");
			wrap.className = "ae-select";
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "ae-input ae-select-btn";
			btn.setAttribute("aria-haspopup", "listbox");
			btn.setAttribute("aria-expanded", "false");
			if (sel.title) btn.setAttribute("aria-label", sel.title);
			btn.innerHTML =
				'<span class="ae-select-label"></span>' +
				'<svg class="ae-select-chev" viewBox="0 0 24 24" width="16" height="16"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
			const menu = document.createElement("div");
			menu.className = "ae-select-menu";
			menu.setAttribute("role", "listbox");
			sel.parentNode.insertBefore(wrap, sel);
			wrap.append(btn, menu, sel);
			sel.closest(".ae-toolbar").classList.add("ae-toolbar-top");

			const sl = { sel, wrap, btn, menu, label: btn.firstChild, open: false, active: -1 };

			btn.addEventListener("click", () => (sl.open ? this.closeSelect(sl) : this.openSelect(sl)));
			menu.addEventListener("mousedown", e => e.preventDefault());
			menu.addEventListener("mouseover", e => {
				const o = e.target.closest(".ae-opt");
				if (o) this.setActiveOpt(sl, Number(o.dataset.i), false);
			});
			menu.addEventListener("click", e => {
				const o = e.target.closest(".ae-opt");
				if (o) this.chooseOpt(sl, Number(o.dataset.i));
			});
			btn.addEventListener("keydown", e => {
				const n = sel.options.length;
				if (e.key === "Escape" && sl.open) {
					e.preventDefault();
					e.stopPropagation();
					return this.closeSelect(sl);
				}
				if (e.key === "Tab") return sl.open && this.closeSelect(sl);
				if (!["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(e.key)) return;
				e.preventDefault();
				if (!sl.open) return this.openSelect(sl);
				if (e.key === "ArrowDown") this.setActiveOpt(sl, Math.min(n - 1, sl.active + 1), true);
				else if (e.key === "ArrowUp") this.setActiveOpt(sl, Math.max(0, sl.active - 1), true);
				else if (e.key === "Home") this.setActiveOpt(sl, 0, true);
				else if (e.key === "End") this.setActiveOpt(sl, n - 1, true);
				else this.chooseOpt(sl, sl.active);
			});

			this.refreshSelect(sl);
			return sl;
		}

		refreshSelect(sl) {
			const opts = [...sl.sel.options];
			const cur = opts[sl.sel.selectedIndex];
			sl.label.textContent = "";
			opts.forEach(o => {
				const sz = document.createElement("span");
				sz.className = "sz";
				sz.textContent = o.textContent;
				sl.label.appendChild(sz);
			});
			const now = document.createElement("span");
			now.textContent = cur ? cur.textContent : "";
			sl.label.appendChild(now);

			sl.menu.textContent = "";
			opts.forEach((o, i) => {
				const d = document.createElement("div");
				d.className = "ae-opt" + (i === sl.sel.selectedIndex ? " selected" : "");
				d.dataset.i = i;
				d.style.setProperty("--i", i);
				d.setAttribute("role", "option");
				const t = document.createElement("span");
				t.textContent = o.textContent;
				d.appendChild(t);
				d.insertAdjacentHTML(
					"beforeend",
					'<svg viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
				);
				sl.menu.appendChild(d);
			});
			sl.active = sl.sel.selectedIndex;
		}

		setActiveOpt(sl, i, scroll) {
			sl.active = i;
			[...sl.menu.children].forEach((el, k) => el.classList.toggle("active", k === i));
			if (scroll) sl.menu.children[i]?.scrollIntoView({ block: "nearest" });
		}

		openSelect(sl) {
			this.selects.forEach(o => o !== sl && o.open && this.closeSelect(o));
			this.refreshSelect(sl);
			sl.menu.classList.remove("align-right");
			const lim = this.root.querySelector(".ae-modal").getBoundingClientRect().right - 8;
			if (sl.btn.getBoundingClientRect().left + sl.menu.offsetWidth > lim) sl.menu.classList.add("align-right");
			sl.open = true;
			sl.wrap.classList.add("open");
			sl.btn.setAttribute("aria-expanded", "true");
			this.setActiveOpt(sl, sl.sel.selectedIndex, false);
			const cur = sl.menu.children[sl.sel.selectedIndex];
			if (cur) sl.menu.scrollTop = Math.max(0, cur.offsetTop - sl.menu.clientHeight / 2 + cur.offsetHeight / 2);
		}

		closeSelect(sl) {
			sl.open = false;
			sl.wrap.classList.remove("open");
			sl.btn.setAttribute("aria-expanded", "false");
		}

		chooseOpt(sl, i) {
			if (i < 0) return this.closeSelect(sl);
			const changed = sl.sel.selectedIndex !== i;
			sl.sel.selectedIndex = i;
			if (changed) sl.sel.dispatchEvent(new Event("change", { bubbles: true }));
			this.refreshSelect(sl);
			this.closeSelect(sl);
			sl.btn.focus();
		}

		initTooltips() {
			const tip = document.createElement("div");
			tip.className = "ae-tip";
			tip.setAttribute("role", "tooltip");
			tip.innerHTML =
				'<svg class="ae-tip-caret" width="16" height="10" viewBox="0 0 16 10" xmlns="http://www.w3.org/2000/svg">' +
				'<defs><clipPath id="ae_tip_clip"><path d="M10.3426 7.0715C9.14163 8.57272 6.85837 8.57272 5.65739 7.0715L0 0H16Z"></path></clipPath></defs>' +
				'<path class="ae-tip-fill" d="M10.3426 7.0715C9.14163 8.57272 6.85837 8.57272 5.65739 7.0715L0 0H16Z"></path>' +
				'<path class="ae-tip-stroke" clip-path="url(#ae_tip_clip)" d="M0 0L5.65739 7.0715C6.85837 8.57272 9.14163 8.57272 10.3426 7.0715L16 0"></path>' +
				'</svg><div class="ae-tip-text"></div>';
			const tipText = tip.querySelector(".ae-tip-text");
			this.root.appendChild(tip);
			let target = null;

			const hide = () => {
				tip.classList.remove("show");
				target = null;
			};
			const show = el => {
				tipText.textContent = el.dataset.tip;
				tip.classList.remove("top", "bottom", "show");
				tip.style.left = "0px";
				tip.style.top = "0px";
				const w = tip.offsetWidth;
				const h = tip.offsetHeight;
				const r = el.getBoundingClientRect();
				const gap = 4;
				const placeTop = r.top - h - gap - 6 >= 4;
				const cx = r.left + r.width / 2;
				const left = Math.max(8, Math.min(cx - w / 2, window.innerWidth - w - 8));
				const arrowX = Math.max(16, Math.min(cx - left, w - 16));
				tip.style.left = left + "px";
				tip.style.top = (placeTop ? r.top - h - gap - 6 : r.bottom + gap + 6) + "px";
				tip.style.setProperty("--ae-arrow-x", arrowX + "px");
				tip.classList.add(placeTop ? "top" : "bottom");
				void tip.offsetWidth;
				tip.classList.add("show");
			};

			this.root.addEventListener("mouseover", e => {
				const el = e.target.closest("[title], [data-tip]");
				if (!el || !this.root.contains(el) || el === target) return;
				if (el.hasAttribute("title")) {
					el.dataset.tip = el.getAttribute("title");
					el.removeAttribute("title");
				}
				if (!el.dataset.tip) return;
				target = el;
				show(el);
			});
			this.root.addEventListener("mouseout", e => {
				if (target && !target.contains(e.relatedTarget)) hide();
			});
			this.root.addEventListener("mousedown", hide);
			this.root.addEventListener("wheel", hide, { passive: true });
			this.root.addEventListener("scroll", hide, true);
		}

		bindEvents() {
			const reset = () => {
				this.visibleCount = this.pageSize;
				this.updateGrid();
			};
			this.$search.addEventListener("input", debounce(reset, 300));
			[this.$filter, this.$source, this.$statusFilter].forEach(el => el.addEventListener("change", reset));
			this.$sort.addEventListener("change", () => {
				this.sortKey = this.$sort.value;
				reset();
			});
			this.$sortDir.addEventListener("click", () => {
				this.sortDir *= -1;
				this.$sortDir.textContent = this.sortDir === 1 ? "▲" : "▼";
				reset();
			});
			this.$fmt.addEventListener("change", () => (this.copyFormat = this.$fmt.value));
			const defaultSearchPH = this.$search.getAttribute("placeholder");
			const syncRegex = () => {
				const v = this.$search.value.trim();
				this.regex = null;
				let err = "";
				if (this.regexOn && v) {
					try {
						this.regex = new RegExp(v, "i");
					} catch (e) {
						err = "Invalid regex: " + e.message;
					}
				}
				this.$search.classList.toggle("ae-bad", !!err);
				delete this.$search.dataset.tip;
				if (err) this.$search.setAttribute("title", err);
				else this.$search.removeAttribute("title");
			};
			this.$search.addEventListener("input", syncRegex);
			this.$regex.addEventListener("click", () => {
				this.regexOn = !this.regexOn;
				this.$regex.classList.toggle("on", this.regexOn);
				this.$regex.setAttribute("aria-pressed", String(this.regexOn));
				this.$search.setAttribute("placeholder", this.regexOn ? "Regex on file name, e.g. ^emoji.*\.(png|webp)$" : defaultSearchPH);
				syncRegex();
				reset();
			});
			const defaultMeasureTip = this.$measure.getAttribute("title");
			this.$measure.addEventListener(
				"input",
				debounce(() => {
					const res = this.parseMeasure(this.$measure.value);
					this.$measure.classList.toggle("ae-bad", !!res.error);
					this.$measure.setAttribute("title", res.error || defaultMeasureTip);
					this.measureRules = !res.error && res.rules.length ? res.rules : null;
					this.sizeLimit = this.measureRules ? 12 : 4;
					reset();
				}, 350)
			);
			this.$loadMore.addEventListener("click", () => {
				this.visibleCount += this.pageSize;
				this.updateGrid();
			});

			this.$grid.addEventListener("click", e => {
				const img = e.target.closest(".ae-preview img");
				if (img) return this.openLightbox(img.getAttribute("src"));
				const btn = e.target.closest(".ae-btn");
				if (!btn) return;
				if (btn.dataset.copy) {
					this.copyText(this.formatCopy(btn.dataset.copy)).then(() => {
						const original = btn.textContent;
						btn.textContent = "Copied!";
						btn.style.background = "#23a559";
						setTimeout(() => {
							btn.textContent = original;
							btn.style.background = "";
						}, 1500);
					});
				} else if (btn.dataset.open) {
					window.open(btn.dataset.open, "_blank", "noopener,noreferrer");
				} else if (btn.dataset.dl) {
					this.downloadOne(btn.dataset.dl);
				}
			});
			this.$grid.addEventListener("change", e => {
				const cb = e.target.closest("input[data-sel]");
				if (!cb) return;
				const url = cb.dataset.sel;
				cb.checked ? this.selected.add(url) : this.selected.delete(url);
				cb.closest(".ae-card").classList.toggle("ae-selected", cb.checked);
				this.updateInfo();
			});
			this.$grid.addEventListener(
				"load",
				e => {
					const t = e.target;
					if (t.tagName !== "IMG") return;
					const url = t.closest(".ae-card")?.dataset.url;
					if (!url) return;
					const m = this.getMeta(url);
					m.w = t.naturalWidth;
					m.h = t.naturalHeight;
					this.paintMeta(url);
					this.scheduleMeasure();
				},
				true
			);
			this.$grid.addEventListener(
				"error",
				e => {
					if (e.target.tagName === "IMG")
						e.target.replaceWith(Object.assign(document.createElement("div"), { className: "ae-icon", textContent: "⚠ Error" }));
				},
				true
			);

			this.bindAudioEvents();
			this.bindVideoEvents();

			this.root.addEventListener("click", e => {
				const b = e.target.closest("[data-act]");
				if (!b) {
					this.$menu.classList.remove("open");
					return;
				}
				this.handleAction(b.dataset.act);
			});

			this.handleEsc = e => {
				if (e.key !== "Escape") return;
				if (this.lb) this.closeLightbox();
				else this.destroy();
			};
			document.addEventListener("keydown", this.handleEsc);
			this.$close.addEventListener("click", () => this.destroy());
			this.$backdrop.addEventListener("click", e => {
				if (e.target === this.$backdrop) this.destroy();
			});
		}

		async handleAction(act) {
			if (act !== "dl-toggle") this.$menu.classList.remove("open");
			switch (act) {
				case "dl-toggle":
					return this.$menu.classList.toggle("open");
				case "selall":
					this.filtered.forEach(a => this.selected.add(a.url));
					return this.updateGrid();
				case "clear":
					this.selected.clear();
					return this.updateGrid();
				case "copysel": {
					const urls = [...this.selected];
					if (!urls.length) return this.setStatus("Nothing selected.", null, 2000);
					await this.copyText(urls.map(u => this.formatCopy(u)).join("\n"));
					return this.setStatus("Copied " + urls.length + " entries.", null, 2000);
				}
				case "scan":
					return this.scanChunks();
				case "dl-sel-files":
					return this.downloadMany([...this.selected]);
				case "dl-sel-zip":
					return this.downloadZip([...this.selected], "discord-assets-selected");
				case "dl-flt-zip":
					return this.downloadZip(
						this.filtered.map(a => a.url),
						"discord-assets"
					);
				case "dl-flt-files":
					return this.downloadMany(this.filtered.map(a => a.url));
			}
		}

		populateFilters() {
			const fill = (el, values, firstLabel, labeler = v => v.toUpperCase()) => {
				const cur = el.value;
				el.innerHTML = '<option value="">' + firstLabel + "</option>";
				values.forEach(v => {
					const opt = document.createElement("option");
					opt.value = v;
					opt.textContent = labeler(v);
					el.appendChild(opt);
				});
				el.value = values.includes(cur) ? cur : "";
			};
			fill(this.$filter, [...new Set(this.assetList.map(a => a.extension).filter(Boolean))].sort(), "All Extensions");
			const srcs = new Set(["webpack", "dom", "css", "performance"]);
			this.assetList.forEach(a => a.sources.forEach(s => srcs.add(s.split(":")[0])));
			fill(this.$source, [...srcs].sort(), "All Sources", v => v);
			this.selects?.forEach(sl => this.refreshSelect(sl));
		}

		getMeta(url) {
			let m = this.meta.get(url);
			if (!m) this.meta.set(url, (m = { w: null, h: null, size: null, sizeTried: false }));
			return m;
		}

		paintMeta(url) {
			const el = this.metaEls.get(url);
			if (!el) return;
			const m = this.getMeta(url);
			const parts = [];
			if (m.w) parts.push(m.w + "×" + m.h);
			if (m.size != null) parts.push(formatBytes(m.size));
			else if (m.sizeTried) parts.push("size n/a");
			el.textContent = parts.join(" · ") || "...";
		}

		queueSize(url) {
			const m = this.getMeta(url);
			if (m.sizeTried || m.size != null) return;
			m.sizeTried = true;
			if (url.startsWith("data:")) {
				m.size = Math.round((url.length - url.indexOf(",") - 1) * 0.75);
				m.sizeDone = true;
				return this.paintMeta(url);
			}
			if (url.startsWith("blob:")) {
				m.sizeDone = true;
				return;
			}
			this.sizeQueue.push(url);
			this.pumpSizes();
		}

		pumpSizes() {
			while (this.sizeActive < (this.sizeLimit || 4) && this.sizeQueue.length) {
				const url = this.sizeQueue.shift();
				this.sizeActive++;
				fetch(url, { method: "HEAD" })
					.then(r => {
						const len = r.headers.get("content-length");
						if (len != null) this.getMeta(url).size = Number(len);
					})
					.catch(() => {})
					.finally(() => {
						this.sizeActive--;
						this.getMeta(url).sizeDone = true;
						this.paintMeta(url);
						this.pumpSizes();
						this.scheduleMeasure();
					});
			}
		}

		getPreviewHTML(asset) {
			const url = escapeHTML(asset.url);
			const ext = asset.extension;
			if (EXTENSIONS.images.has(ext)) return '<img src="' + url + '" loading="lazy" referrerpolicy="no-referrer" alt="' + escapeHTML(asset.name) + '">';
			if (EXTENSIONS.videos.has(ext))
				return (
					'<div class="ae-video">' +
					'<video src="' +
					url +
					'" preload="metadata" playsinline></video>' +
					'<button class="ae-vbig" type="button" data-v="play" title="Play">' +
					ICON_PLAY.replace(/width="18" height="18"/, 'width="24" height="24"') +
					"</button>" +
					'<div class="ae-vbar">' +
					'<button class="ae-vbtn" type="button" data-v="play" title="Play / Pause">' +
					ICON_PLAY +
					ICON_PAUSE +
					ICON_REPLAY +
					"</button>" +
					'<span class="ae-vtime">0:00</span>' +
					'<div class="ae-vprog" data-v="seek"><div class="ae-vtrack"><div class="ae-vfill"></div></div></div>' +
					'<button class="ae-vbtn" type="button" data-v="mute" title="Mute">' +
					ICON_VOL +
					ICON_MUTE +
					"</button>" +
					'<button class="ae-vbtn" type="button" data-v="fs" title="Fullscreen">' +
					ICON_FS +
					"</button>" +
					"</div></div>"
				);
			if (EXTENSIONS.audios.has(ext))
				return (
					'<div class="ae-audio" data-audio="' +
					url +
					'">' +
					'<button class="ae-play" type="button">' +
					ICON_PLAY +
					ICON_PAUSE +
					"</button>" +
					'<canvas class="ae-wave"></canvas>' +
					'<span class="ae-atime">0:00</span>' +
					'<button class="ae-vol" type="button">' +
					ICON_VOL +
					ICON_MUTE +
					"</button>" +
					'<audio src="' +
					url +
					'" preload="none"></audio></div>'
				);
			if (EXTENSIONS.fonts.has(ext))
				return (
					'<div class="ae-font" data-font="' +
					url +
					'">' +
					'<div class="ae-font-big">Aa Gg</div>' +
					'<div class="ae-font-line">The quick brown fox jumps over the lazy dog</div>' +
					'<div class="ae-font-digits">0123456789 !?&amp;@#</div>' +
					"</div>"
				);
			return '<div class="ae-icon">.' + escapeHTML(ext || "?") + "</div>";
		}

		playerOf(node) {
			const el = node && node.closest && node.closest(".ae-audio");
			return el && el._dzp;
		}

		initSettings() {
			const st = loadSettings();
			const setSel = (el, v) => {
				if (typeof v === "string" && [...el.options].some(o => o.value === v)) el.value = v;
			};
			setSel(this.$sort, st.sortKey);
			this.sortKey = this.$sort.value;
			if (st.sortDir === -1) {
				this.sortDir = -1;
				this.$sortDir.textContent = "▼";
			}
			setSel(this.$fmt, st.copyFormat);
			this.copyFormat = this.$fmt.value;
			setSel(this.$filter, st.ext);
			setSel(this.$source, st.source);
			if (typeof st.measure === "string" && st.measure.trim()) {
				this.$measure.value = st.measure;
				const res = this.parseMeasure(st.measure);
				this.$measure.classList.toggle("ae-bad", !!res.error);
				if (res.error) this.$measure.setAttribute("title", res.error);
				this.measureRules = !res.error && res.rules.length ? res.rules : null;
				this.sizeLimit = this.measureRules ? 12 : 4;
			}
			if (typeof st.search === "string" && st.search) this.$search.value = st.search;
			if (st.regex === true) this.$regex.click();
			this.selects?.forEach(sl => this.refreshSelect(sl));
			const save = () => this.saveSettings();
			this.root.addEventListener("change", save);
			this.$sortDir.addEventListener("click", save);
			this.$regex.addEventListener("click", save);
			this.$search.addEventListener("input", debounce(save, 500));
			this.$measure.addEventListener("input", debounce(save, 500));
		}

		saveSettings() {
			storeSettings({
				sortKey: this.sortKey,
				sortDir: this.sortDir,
				copyFormat: this.copyFormat,
				ext: this.$filter.value,
				source: this.$source.value,
				measure: this.$measure.value.trim(),
				search: this.$search.value,
				regex: this.regexOn,
			});
		}

		parseMeasure(text) {
			const t = text.trim().toLowerCase();
			const rules = [];
			if (!t) return { rules };
			const OPS = [
				[/^(at least|minimum|min|>=|≥)/, "gte"],
				[/^(at most|maximum|max|<=|≤)/, "lte"],
				[/^(exactly|==|=)/, "eq"],
				[/^(over|larger than|bigger than|greater than|more than|above|>)/, "gt"],
				[/^(under|smaller than|less than|below|<)/, "lt"],
			];
			const UNITS = { b: 1, k: 1024, kb: 1024, kib: 1024, m: 1048576, mb: 1048576, mib: 1048576, g: 1073741824, gb: 1073741824, gib: 1073741824 };
			for (const raw of t.split(/\s*(?:,|;|&|\band\b)\s*/)) {
				const c = raw.trim();
				if (!c) continue;
				let m;
				if ((m = c.match(/^(\d+)\s*[x×]\s*(\d+)$/))) {
					rules.push({ k: "w", op: "eq", v: +m[1] }, { k: "h", op: "eq", v: +m[2] });
					continue;
				}
				if (c === "square") {
					rules.push({ k: "sq" });
					continue;
				}
				if ((m = c.match(/^(wider|taller|narrower|shorter)(?:\s+than)?\s*(\d+(?:\.\d+)?)\s*(?:px)?$/))) {
					rules.push({ k: m[1] === "wider" || m[1] === "narrower" ? "w" : "h", op: m[1] === "wider" || m[1] === "taller" ? "gt" : "lt", v: +m[2] });
					continue;
				}
				let axis = null;
				let rest = c;
				if ((m = c.match(/^(width|height|w|h)\s*(.*)$/))) {
					axis = m[1][0];
					rest = m[2];
				}
				let op = null;
				for (const [re, o] of OPS) {
					const mm = rest.match(re);
					if (mm) {
						op = o;
						rest = rest.slice(mm[0].length).trim();
						break;
					}
				}
				const nm = rest.match(/^(\d+(?:\.\d+)?)\s*(px|b|kb|kib|k|mb|mib|m|gb|gib|g)?$/);
				if (!nm || (!op && !axis)) return { rules: [], error: 'Cannot read "' + raw.trim() + '". Try: over 100 KB, wider than 512px, 512x512, square' };
				const unit = nm[2];
				const v = parseFloat(nm[1]);
				if (unit && unit !== "px") {
					if (axis) return { rules: [], error: 'Cannot read "' + raw.trim() + '". Width and height are in px' };
					rules.push({ k: "size", op: op || "eq", v: v * UNITS[unit] });
				} else if (unit === "px" || axis) {
					rules.push({ k: axis || "max", op: op || "eq", v });
				} else {
					return { rules: [], error: 'Add a unit to "' + raw.trim() + '" (KB, MB or px)' };
				}
			}
			return { rules };
		}

		cmp(a, op, b) {
			if (op === "gt") return a > b;
			if (op === "gte") return a >= b;
			if (op === "lt") return a < b;
			if (op === "lte") return a <= b;
			return a === b;
		}

		measureMatch(a) {
			const m = this.getMeta(a.url);
			const isImg = EXTENSIONS.images.has(a.extension);
			let pending = false;
			for (const r of this.measureRules) {
				if (r.k === "size") {
					if (m.size == null && !m.sizeDone) this.queueSize(a.url);
					if (m.size == null) {
						if (m.sizeDone) return false;
						pending = true;
						continue;
					}
					if (!this.cmp(m.size, r.op, r.v)) return false;
					continue;
				}
				if (!isImg) return false;
				if (m.w == null) {
					if (m.dimDone) return false;
					this.queueDims(a.url);
					pending = true;
					continue;
				}
				if (r.k === "sq") {
					if (!m.w || m.w !== m.h) return false;
					continue;
				}
				const val = r.k === "w" ? m.w : r.k === "h" ? m.h : Math.max(m.w, m.h);
				if (!this.cmp(val, r.op, r.v)) return false;
			}
			if (pending) this._mPending++;
			return !pending;
		}

		queueDims(url) {
			const m = this.getMeta(url);
			if (m.dimTried) return;
			m.dimTried = true;
			this.dimQueue.push(url);
			this.pumpDims();
		}

		pumpDims() {
			while (this.dimActive < 8 && this.dimQueue.length) {
				const url = this.dimQueue.shift();
				this.dimActive++;
				const img = new Image();
				img.referrerPolicy = "no-referrer";
				const done = ok => {
					img.onload = img.onerror = null;
					const m = this.getMeta(url);
					if (ok && m.w == null) {
						m.w = img.naturalWidth;
						m.h = img.naturalHeight;
					}
					m.dimDone = true;
					this.dimActive--;
					if (this.destroyed) return;
					this.paintMeta(url);
					this.pumpDims();
					this.scheduleMeasure();
				};
				img.onload = () => done(true);
				img.onerror = () => done(false);
				img.src = url;
			}
		}

		scheduleMeasure() {
			if (this.destroyed || !this.measureRules || this._mTimer) return;
			this._mTimer = setTimeout(() => {
				this._mTimer = null;
				if (this.destroyed || !this.measureRules) return;
				const next = this.getFiltered();
				const same = next.length === this.filtered.length && next.every((a, i) => a === this.filtered[i]);
				if (same) this.updateInfo();
				else this.updateGrid();
			}, 400);
		}

		initFonts() {
			const els = this.$grid.querySelectorAll(".ae-font");
			if (!els.length) return;
			if (!this.fontIO) {
				this.fontIO = new IntersectionObserver(
					entries => {
						entries.forEach(en => {
							if (!en.isIntersecting) return;
							this.fontIO.unobserve(en.target);
							this.loadFont(en.target);
						});
					},
					{ rootMargin: "200px" }
				);
			}
			els.forEach(el => this.fontIO.observe(el));
		}

		loadFont(el) {
			const url = el.dataset.font;
			let entry = this.fontFaces.get(url);
			if (!entry) {
				const family = "ae-fp-" + this.fontFaces.size;
				const face = new FontFace(family, 'url("' + url.replace(/"/g, "%22") + '")');
				entry = {
					family,
					face,
					promise: face.load().then(
						f => {
							document.fonts.add(f);
							return true;
						},
						() => false
					),
				};
				this.fontFaces.set(url, entry);
			}
			entry.promise.then(ok => {
				if (!el.isConnected) return;
				if (ok) {
					el.style.fontFamily = '"' + entry.family + '", serif';
					el.classList.add("ready");
				} else el.classList.add("err");
			});
		}

		teardownFonts() {
			this.fontIO?.disconnect();
		}

		teardownAudio() {
			this.audioIO?.disconnect();
			this.audioRO?.disconnect();
			this.peakQueue = [];
			this.$grid.querySelectorAll(".ae-audio").forEach(el => {
				const p = el._dzp;
				if (p) cancelAnimationFrame(p.raf);
				const a = el.querySelector("audio");
				if (a) {
					a.pause();
					a.removeAttribute("src");
					a.load();
				}
			});
		}

		initPlayer(el) {
			if (!this.peakCache) {
				this.peakCache = new Map();
				this.peakQueue = [];
				this.peakActive = 0;
			}
			if (!this.audioIO) {
				this.audioIO = new IntersectionObserver(
					entries =>
						entries.forEach(en => {
							if (!en.isIntersecting) return;
							this.audioIO.unobserve(en.target);
							this.queuePeaks(en.target._dzp);
						}),
					{ root: this.root.querySelector(".ae-body"), rootMargin: "300px" }
				);
				this.audioRO = new ResizeObserver(entries => entries.forEach(en => this.paintPlayer(this.playerOf(en.target))));
			}
			const p = (el._dzp = {
				el,
				url: el.dataset.audio,
				audio: el.querySelector("audio"),
				canvas: el.querySelector(".ae-wave"),
				timeEl: el.querySelector(".ae-atime"),
				peaks: null,
				dur: NaN,
				reveal: 0,
				raf: 0,
				seeking: false,
			});
			const cached = this.peakCache.get(p.url);
			if (cached && cached.peaks) {
				p.peaks = cached.peaks;
				p.dur = cached.duration;
				p.reveal = 1;
			} else {
				this.audioIO.observe(el);
			}
			this.audioRO.observe(p.canvas);
			this.paintPlayer(p);
		}

		queuePeaks(p) {
			if (!p) return;
			this.peakQueue.push(p);
			this.pumpPeaks();
		}

		pumpPeaks() {
			while (this.peakActive < 3 && this.peakQueue.length) {
				const p = this.peakQueue.shift();
				if (!p.el.isConnected) continue;
				this.peakActive++;
				this.loadPeaks(p.url)
					.then(r => {
						if (!p.el.isConnected) return;
						p.peaks = r.peaks;
						p.dur = r.duration;
						this.animateReveal(p);
					})
					.catch(() => {})
					.finally(() => {
						this.peakActive--;
						this.pumpPeaks();
					});
			}
		}

		async loadPeaks(url) {
			const cached = this.peakCache.get(url);
			if (cached) return cached;
			const N = 128;
			let result;
			try {
				const res = await fetch(url);
				if (!res.ok) throw new Error("http " + res.status);
				const buf = await res.arrayBuffer();
				if (buf.byteLength > 25 * 1024 * 1024) throw new Error("too large");
				const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
				const audio = await new Promise((ok, no) => new Ctx(1, 1, 44100).decodeAudioData(buf, ok, no));
				const chans = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
				const len = audio.length;
				const size = Math.max(1, Math.floor(len / N));
				const stride = Math.max(1, Math.floor(size / 500));
				const peaks = new Float32Array(N);
				let max = 0;
				for (let i = 0; i < N; i++) {
					let sum = 0;
					let cnt = 0;
					for (let j = i * size, end = Math.min(len, j + size); j < end; j += stride) {
						for (const c of chans) sum += c[j] * c[j];
						cnt += chans.length;
					}
					peaks[i] = cnt ? Math.sqrt(sum / cnt) : 0;
					if (peaks[i] > max) max = peaks[i];
				}
				for (let i = 0; i < N; i++) peaks[i] = max > 0 ? Math.pow(peaks[i] / max, 0.75) : 0;
				result = { peaks, duration: audio.duration };
			} catch {
				let h = 2166136261;
				for (let i = 0; i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 16777619);
				const peaks = new Float32Array(N);
				let v = 0.5;
				for (let i = 0; i < N; i++) {
					h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
					v = 0.55 * v + 0.45 * (0.2 + 0.7 * ((h % 1000) / 1000));
					peaks[i] = v;
				}
				result = { peaks, duration: NaN };
			}
			this.peakCache.set(url, result);
			return result;
		}

		animateReveal(p) {
			const t0 = performance.now();
			const step = now => {
				if (!p.el.isConnected) return;
				const k = Math.min(1, (now - t0) / 350);
				p.reveal = 1 - Math.pow(1 - k, 3);
				this.paintPlayer(p);
				if (k < 1) requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		}

		paintPlayer(p) {
			if (!p) return;
			const a = p.audio;
			const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : p.dur;
			const started = a.currentTime > 0 || !a.paused;
			p.timeEl.textContent = fmtTime(started ? a.currentTime : dur);

			const c = p.canvas;
			const w = c.clientWidth;
			const h = c.clientHeight;
			if (!w || !h) return;
			const dpr = window.devicePixelRatio || 1;
			if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
				c.width = Math.round(w * dpr);
				c.height = Math.round(h * dpr);
			}
			const ctx = c.getContext("2d");
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);

			const BAR = 2;
			const GAP = 2;
			const n = Math.max(8, Math.floor((w + GAP) / (BAR + GAP)));
			const x0 = (w - (n * (BAR + GAP) - GAP)) / 2;
			const progress = dur ? Math.min(1, a.currentTime / dur) : 0;
			const done = progress * n;
			const peaks = p.peaks;
			for (let i = 0; i < n; i++) {
				let v = 0;
				if (peaks) {
					const lo = Math.floor((i * peaks.length) / n);
					const hi = Math.max(lo + 1, Math.floor(((i + 1) * peaks.length) / n));
					for (let j = lo; j < hi; j++) if (peaks[j] > v) v = peaks[j];
				}
				const bh = Math.max(BAR, v * p.reveal * (h - 2));
				ctx.fillStyle =
					this.theme === "light" ? (i < done ? "#313338" : peaks ? "#80848e" : "#a9abb3") : i < done ? "#ffffff" : peaks ? "#a3a6ac" : "#6d6f78";
				const x = x0 + i * (BAR + GAP);
				const y = (h - bh) / 2;
				ctx.beginPath();
				if (ctx.roundRect) ctx.roundRect(x, y, BAR, bh, BAR / 2);
				else ctx.rect(x, y, BAR, bh);
				ctx.fill();
			}
		}

		seekTo(p, clientX) {
			const r = p.canvas.getBoundingClientRect();
			const dur = Number.isFinite(p.audio.duration) && p.audio.duration > 0 ? p.audio.duration : p.dur;
			if (!dur || !r.width) return;
			p.audio.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * dur;
			this.paintPlayer(p);
		}

		bindVideoEvents() {
			const grid = this.$grid;
			const vidOf = n => n.closest(".ae-video");
			const paint = v => {
				const w = v.parentNode.closest ? v.closest(".ae-video") : null;
				if (!w) return;
				const d = v.duration;
				const t = v.currentTime;
				const fill = w.querySelector(".ae-vfill");
				if (fill) fill.style.width = (d ? Math.min(100, (t / d) * 100) : 0) + "%";
				const te = w.querySelector(".ae-vtime");
				if (te) te.textContent = Number.isFinite(d) && d > 0 ? fmtTime(t) + " / " + fmtTime(d) : fmtTime(t);
			};
			const toggle = v => {
				if (v.ended) v.currentTime = 0;
				v.paused || v.ended ? v.play().catch(() => {}) : v.pause();
			};
			const seekTo = (bar, clientX) => {
				const v = vidOf(bar).querySelector("video");
				if (!Number.isFinite(v.duration)) return;
				const r = bar.getBoundingClientRect();
				v.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * v.duration;
				paint(v);
			};
			grid.addEventListener("click", e => {
				const w = vidOf(e.target);
				if (!w) return;
				const v = w.querySelector("video");
				const act = e.target.closest("[data-v]")?.dataset.v;
				if (e.target === v || act === "play") toggle(v);
				else if (act === "mute") {
					v.muted = !v.muted;
					w.classList.toggle("muted", v.muted);
				} else if (act === "fs") {
					document.fullscreenElement ? document.exitFullscreen() : w.requestFullscreen?.();
				}
			});
			let dragBar = null;
			grid.addEventListener("pointerdown", e => {
				const bar = e.target.closest(".ae-vprog");
				if (!bar) return;
				dragBar = bar;
				bar.setPointerCapture?.(e.pointerId);
				seekTo(bar, e.clientX);
			});
			grid.addEventListener("pointermove", e => dragBar && seekTo(dragBar, e.clientX));
			const endDrag = () => (dragBar = null);
			grid.addEventListener("pointerup", endDrag);
			grid.addEventListener("pointercancel", endDrag);
			const on = (type, fn) => grid.addEventListener(type, e => e.target.tagName === "VIDEO" && vidOf(e.target) && fn(e.target, vidOf(e.target)), true);
			on("timeupdate", v => paint(v));
			on("loadedmetadata", v => paint(v));
			on("durationchange", v => paint(v));
			const isFs = w => document.fullscreenElement === w;
			const wake = w => {
				w.classList.remove("ae-idle");
				clearTimeout(w._idleT);
				const v = w.querySelector("video");
				if (isFs(w) && !v.paused && !v.ended) w._idleT = setTimeout(() => isFs(w) && !v.paused && !v.ended && w.classList.add("ae-idle"), 2500);
			};
			grid.addEventListener("pointermove", e => {
				const w = vidOf(e.target);
				if (w && isFs(w)) wake(w);
			});
			grid.addEventListener("click", e => {
				const w = vidOf(e.target);
				if (w && isFs(w)) wake(w);
			});
			document.addEventListener("fullscreenchange", () => {
				grid.querySelectorAll(".ae-video").forEach(w => wake(w));
			});
			on("play", (v, w) => {
				w.classList.remove("ended");
				w.classList.add("playing");
				wake(w);
				grid.querySelectorAll(".ae-video video").forEach(o => o !== v && !o.paused && o.pause());
			});
			on("ended", (v, w) => {
				w.classList.remove("playing");
				w.classList.add("ended");
				wake(w);
			});
			on("seeked", (v, w) => !v.ended && w.classList.remove("ended"));
			on("pause", (v, w) => {
				w.classList.remove("playing");
				wake(w);
			});
			on("error", (v, w) => w.classList.add("errored"));
		}

		bindAudioEvents() {
			const g = this.$grid;
			g.addEventListener("click", e => {
				const play = e.target.closest(".ae-play");
				const vol = e.target.closest(".ae-vol");
				if (!play && !vol) return;
				const p = this.playerOf(e.target);
				if (!p) return;
				if (play) {
					if (p.audio.paused) {
						p.el.classList.remove("ae-aerr");
						p.audio.play().catch(() => {});
					} else p.audio.pause();
				} else {
					p.audio.muted = !p.audio.muted;
					p.el.classList.toggle("muted", p.audio.muted);
				}
			});

			g.addEventListener("pointerdown", e => {
				const c = e.target.closest(".ae-wave");
				const p = c && this.playerOf(c);
				if (!p) return;
				p.seeking = true;
				c.setPointerCapture(e.pointerId);
				this.seekTo(p, e.clientX);
			});
			g.addEventListener("pointermove", e => {
				const p = e.target.closest(".ae-wave") && this.playerOf(e.target);
				if (p && p.seeking) this.seekTo(p, e.clientX);
			});
			const endSeek = e => {
				const p = e.target.closest(".ae-wave") && this.playerOf(e.target);
				if (p) p.seeking = false;
			};
			g.addEventListener("pointerup", endSeek);
			g.addEventListener("pointercancel", endSeek);

			const onMedia = e => {
				if (e.target.tagName !== "AUDIO") return;
				const p = this.playerOf(e.target);
				if (!p) return;
				switch (e.type) {
					case "play":
						g.querySelectorAll("audio").forEach(o => o !== p.audio && o.pause());
						p.el.classList.add("playing");
						cancelAnimationFrame(p.raf);
						const tick = () => {
							this.paintPlayer(p);
							if (!p.audio.paused) p.raf = requestAnimationFrame(tick);
						};
						tick();
						return;
					case "pause":
						p.el.classList.remove("playing");
						break;
					case "ended":
						p.el.classList.remove("playing");
						p.audio.currentTime = 0;
						break;
					case "error":
						if (!p.audio.getAttribute("src")) return;
						p.el.classList.remove("playing");
						p.el.classList.add("ae-aerr");
						p.timeEl.textContent = "err";
						return;
				}
				this.paintPlayer(p);
			};
			["play", "pause", "ended", "seeked", "timeupdate", "loadedmetadata", "durationchange", "error"].forEach(t => g.addEventListener(t, onMedia, true));
		}

		getFiltered() {
			const query = this.$search.value.trim().toLowerCase();
			const ext = this.$filter.value;
			const src = this.$source.value;
			const status = this.$statusFilter.value;
			let list = this.assetList.filter(a => {
				if (ext && a.extension !== ext) return false;
				if (src && !a.sources.some(s => s.split(":")[0] === src)) return false;
				if (status === "selected" && !this.selected.has(a.url)) return false;
				if (!query) return true;
				if (this.regexOn) return this.regex ? this.regex.test(fileOf(a.url)) : true;
				return (a.url + " " + a.extension + " " + a.modules.join(" ") + " " + a.sources.join(" ")).toLowerCase().includes(query);
			});
			this._mPending = 0;
			if (this.measureRules) list = list.filter(a => this.measureMatch(a));
			const k = this.sortKey;
			const d = this.sortDir;
			const name = a => fileOf(a.url).toLowerCase();
			list.sort((a, b) => {
				let c;
				if (k === "name") c = name(a).localeCompare(name(b));
				else if (k === "modules") c = a.modules.length - b.modules.length;
				else if (k === "source") c = (a.sources[0] || "").localeCompare(b.sources[0] || "");
				else c = a.extension.localeCompare(b.extension);
				return c * d || a.url.localeCompare(b.url);
			});
			return list;
		}

		updateGrid() {
			this.filtered = this.getFiltered();
			const visible = this.filtered.slice(0, this.visibleCount);
			this.teardownAudio();
			this.teardownFonts();
			this.$grid.innerHTML = visible
				.map(asset => {
					const url = escapeHTML(asset.url);
					const modules = asset.modules.length ? asset.modules.slice(0, 3).join(", ") + (asset.modules.length > 3 ? "..." : "") : "N/A";
					const sel = this.selected.has(asset.url);
					const check = '<label class="ae-check"><input type="checkbox" data-sel="' + url + '"' + (sel ? " checked" : "") + "></label>";
					return (
						'<div class="ae-card' +
						(sel ? " ae-selected" : "") +
						'" data-url="' +
						url +
						'">' +
						'<div class="ae-preview">' +
						check +
						this.getPreviewHTML(asset) +
						"</div>" +
						'<div class="ae-card-body"><span class="ae-type">' +
						escapeHTML(asset.extension || "unknown") +
						"</span>" +
						'<div class="ae-name" title="' +
						url +
						'">' +
						escapeHTML(fileOf(asset.url)) +
						"</div>" +
						'<div class="ae-dim" data-meta="' +
						url +
						'">...</div>' +
						'<div class="ae-meta"><strong>Modules:</strong> ' +
						escapeHTML(modules) +
						"<br><strong>Source:</strong> " +
						escapeHTML(asset.sources.join(", ")) +
						"</div>" +
						'<div class="ae-actions"><button class="ae-btn" data-copy="' +
						url +
						'">Copy</button>' +
						'<button class="ae-btn" data-open="' +
						url +
						'">Open</button>' +
						'<button class="ae-btn" data-dl="' +
						url +
						'">Save</button>' +
						"</div></div></div>"
					);
				})
				.join("");
			this.$grid.querySelectorAll(".ae-audio").forEach(el => this.initPlayer(el));
			this.initFonts();
			this.metaEls = new Map();
			this.$grid.querySelectorAll("[data-meta]").forEach(el => {
				const url = el.dataset.meta;
				this.metaEls.set(url, el);
				this.paintMeta(url);
				this.queueSize(url);
			});
			this.$loadMore.style.display = this.filtered.length > this.visibleCount ? "block" : "none";
			this.updateInfo();
		}

		updateInfo() {
			this.$info.textContent = this.filtered.length + " Found | " + this.selected.size + " selected";
			if (this.measureRules && this._mPending) this.$info.textContent += " | measuring " + this._mPending;
			this.root.querySelectorAll(".dl-n-sel").forEach(el => (el.textContent = this.selected.size));
			this.root.querySelectorAll(".dl-n-flt").forEach(el => (el.textContent = this.filtered.length));
		}

		setStatus(text, pct = null, autoHide = 0) {
			this.$status.classList.add("on");
			this.$statusText.textContent = text;
			this.$statusFill.style.width = (pct == null ? 0 : Math.min(100, pct)) + "%";
			clearTimeout(this._statusTimer);
			if (autoHide) this._statusTimer = setTimeout(() => this.$status.classList.remove("on"), autoHide);
		}

		formatCopy(url) {
			switch (this.copyFormat) {
				case "md":
					return "![" + fileOf(url) + "](" + url + ")";
				case "css":
					return 'url("' + url + '")';
				case "html":
					return '<img src="' + url + '" alt="">';
				default:
					return url;
			}
		}

		async copyText(text) {
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.cssText = "position:fixed;opacity:0";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				ta.remove();
			}
		}

		fileNameFor(url, i = 0) {
			const ext = this.getExtension(url);
			if (/^(data|blob):/.test(url)) return "inline_" + i + "." + (ext || "bin");
			let name;
			try {
				name = decodeURIComponent(new URL(url).pathname.split("/").pop());
			} catch {
				name = fileOf(url);
			}
			name = (name || "").replace(/[\\/:*?"<>|]/g, "_") || "asset_" + i;
			if (!/\.[a-z0-9]+$/i.test(name) && ext) name += "." + ext;
			return name;
		}

		saveBlob(blob, name) {
			const href = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = href;
			a.download = name;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(href), 15000);
		}

		async downloadOne(url, i = 0) {
			try {
				const r = await fetch(url);
				if (!r.ok) throw new Error(r.status);
				this.saveBlob(await r.blob(), this.fileNameFor(url, i));
				return true;
			} catch {
				window.open(url, "_blank", "noopener,noreferrer");
				return false;
			}
		}

		async downloadMany(urls) {
			if (!urls.length) return this.setStatus("Nothing to download.", null, 2000);
			if (
				urls.length > 30 &&
				!confirm("Download " + urls.length + " files separately? Your browser may ask to allow multiple downloads. A ZIP is usually easier.")
			)
				return;
			if (this.busy) return;
			this.busy = true;
			try {
				for (let i = 0; i < urls.length; i++) {
					this.setStatus("Downloading " + (i + 1) + "/" + urls.length, ((i + 1) / urls.length) * 100);
					await this.downloadOne(urls[i], i);
					await sleep(150);
				}
				this.setStatus("Downloaded " + urls.length + " files.", null, 3000);
			} finally {
				this.busy = false;
			}
		}

		async downloadZip(urls, baseName) {
			if (!urls.length) return this.setStatus("Nothing to download.", null, 2000);
			if (this.busy) return;
			this.busy = true;
			const zip = new StoreZip();
			const used = new Set();
			const failed = [];
			const queue = urls.map((u, i) => [u, i]);
			let done = 0;
			let bytes = 0;
			const worker = async () => {
				while (queue.length) {
					const [url, i] = queue.shift();
					try {
						const r = await fetch(url);
						if (!r.ok) throw new Error(r.status);
						const data = new Uint8Array(await r.arrayBuffer());
						const ext = this.getExtension(url) || "misc";
						let path = ext + "/" + this.fileNameFor(url, i);
						for (let n = 2; used.has(path.toLowerCase()); n++) path = path.replace(/(\.[^./]+)?$/, "_" + n + "$1");
						used.add(path.toLowerCase());
						zip.add(path, data);
						bytes += data.length;
					} catch {
						failed.push(url);
					}
					done++;
					this.setStatus("Zipping " + done + "/" + urls.length + " (" + formatBytes(bytes) + ")", (done / urls.length) * 100);
				}
			};
			try {
				await Promise.all(Array.from({ length: 6 }, worker));
				if (!zip.count) return this.setStatus("No files could be fetched (CORS or network).", null, 4000);
				if (failed.length) {
					zip.add("_failed.txt", new TextEncoder().encode(failed.join("\n")));
					console.warn("Failed to fetch:", failed);
				}
				this.saveBlob(zip.finish(), baseName + ".zip");
				this.setStatus(
					"ZIP ready: " +
						(zip.count - (failed.length ? 1 : 0)) +
						" files" +
						(failed.length ? ", " + failed.length + " failed (listed in _failed.txt)" : "") +
						".",
					null,
					5000
				);
			} finally {
				this.busy = false;
			}
		}

		openLightbox(src) {
			this.closeLightbox();
			const el = document.createElement("div");
			el.id = "__asset_lightbox__";
			el.style.cssText =
				"position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:grab;";
			const img = document.createElement("img");
			img.src = src;
			img.draggable = false;
			img.style.cssText =
				"max-width:92vw;max-height:92vh;transform-origin:center;user-select:none;image-rendering:auto;background:repeating-conic-gradient(#17181a 0% 25%,#1b1c1f 0% 50%) 50%/20px 20px;";
			const hint = document.createElement("div");
			hint.textContent = "Drag to pan | double-click to reset | Esc to close";
			hint.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:#949ba4;font:12px Arial,sans-serif;pointer-events:none;";
			const pill = document.createElement("div");
			pill.style.cssText =
				"position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:rgba(255,255,255,.75);font:12px Arial,sans-serif;white-space:nowrap;pointer-events:none;user-select:none;font-variant-numeric:tabular-nums;";
			el.append(img, hint, pill);
			const st = { s: 1, x: 0, y: 0, drag: null };
			const updatePill = () => {
				const nw = img.naturalWidth;
				const w = Math.round(img.offsetWidth * st.s);
				const h = Math.round(img.offsetHeight * st.s);
				pill.textContent = "Scroll to zoom" + (nw ? "  ·  " + Math.round((w / nw) * 100) + "%  ·  " + w + " × " + h + " px" : "");
			};
			const apply = () => {
				img.style.transform = "translate(" + st.x + "px," + st.y + "px) scale(" + st.s + ")";
				updatePill();
			};
			img.addEventListener("load", updatePill);
			updatePill();
			el.addEventListener(
				"wheel",
				e => {
					e.preventDefault();
					st.s = Math.min(40, Math.max(0.1, st.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
					apply();
				},
				{ passive: false }
			);
			el.addEventListener("mousedown", e => {
				st.drag = { x: e.clientX - st.x, y: e.clientY - st.y, moved: false };
				el.style.cursor = "grabbing";
			});
			window.addEventListener(
				"mousemove",
				(this._lbMove = e => {
					if (!st.drag) return;
					st.drag.moved = true;
					st.x = e.clientX - st.drag.x;
					st.y = e.clientY - st.drag.y;
					apply();
				})
			);
			window.addEventListener(
				"mouseup",
				(this._lbUp = () => {
					st.drag = null;
					el.style.cursor = "grab";
				})
			);
			el.addEventListener("dblclick", () => {
				st.s = 1;
				st.x = st.y = 0;
				apply();
			});
			el.addEventListener("click", e => {
				if (e.target === el && !st.drag?.moved) this.closeLightbox();
			});
			document.body.appendChild(el);
			this.lb = el;
		}

		closeLightbox() {
			if (!this.lb) return;
			window.removeEventListener("mousemove", this._lbMove);
			window.removeEventListener("mouseup", this._lbUp);
			this.lb.remove();
			this.lb = null;
		}

		destroy() {
			this.teardownAudio();
			this.closeLightbox();
			document.removeEventListener("keydown", this.handleEsc);
			this.destroyed = true;
			clearTimeout(this._mTimer);
			this.dimQueue = [];
			this.sizeQueue = [];
			this.teardownFonts();
			this.fontFaces.forEach(e => document.fonts.delete(e.face));
			this.fontFaces.clear();
			this._themeMO?.disconnect();
			this._themeMQ?.removeEventListener?.("change", this._themeMQFn);
			this.root.remove();
		}
	}

	window.openAssetExplorer = () => new DiscordAssetExplorer();
	window.openAssetExplorer();
})();
