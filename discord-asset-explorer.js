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

	class DiscordAssetExplorer {
		constructor() {
			document.getElementById("__dr1zzyx_asset_explorer__")?.remove();
			this.assets = new Map();
			this.pageSize = 80;
			this.visibleCount = this.pageSize;
			this.wreq = null;
			this.init();
		}

		init() {
			console.group("%c[Dr1zzyx] Discord Asset Explorer", "color:#5865f2;font-size:16px;font-weight:bold");
			this.hookWebpack();
			this.extractFromWebpack();
			this.extractFromPerformance();
			this.extractFromDOM();
			this.extractFromCSS();
			this.assetList = this.buildAssetList();
			console.log("✅ " + this.assetList.length + " assets found.");
			console.groupEnd();
			this.exportGlobals();
			this.renderUI();
		}

		hookWebpack() {
			if (typeof webpackChunkdiscord_app === "undefined") return;
			this.wreq = webpackChunkdiscord_app.push([[Symbol("dr1zzyx_ext")], {}, r => r]);
			webpackChunkdiscord_app.pop();
		}

		getExtension(url) {
			try {
				const clean = String(url).split(/[?#]/)[0];
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

		renderUI() {
			this.root = document.createElement("div");
			this.root.id = "__dr1zzyx_asset_explorer__";
			this.root.innerHTML = this.getHTMLTemplate();
			document.body.appendChild(this.root);
			this.cacheDOM();
			this.bindEvents();
			this.populateFilters();
			this.updateGrid();
		}

		getHTMLTemplate() {
			return '<style>:root { --dz-bg: #111214; --dz-card: #1e1f22; --dz-card-hover: rgba(88,101,242,.55); --dz-text: #dbdee1; --dz-muted: #949ba4; --dz-accent: #5865f2; --dz-border: rgba(255,255,255,.07); --dz-shadow: 0 25px 100px rgba(0,0,0,.75); } #__dr1zzyx_asset_explorer__ { position: fixed; inset: 0; z-index: 2147483647; font-family: "gg sans", Whitney, Arial, sans-serif; color: var(--dz-text); animation: dzFadeIn 0.2s ease-out; } @keyframes dzFadeIn { from { opacity: 0; } to { opacity: 1; } } #__dr1zzyx_asset_explorer__ * { box-sizing: border-box; } #__dr1zzyx_asset_explorer__ ::-webkit-scrollbar { width: 8px; } #__dr1zzyx_asset_explorer__ ::-webkit-scrollbar-track { background: var(--dz-bg); } #__dr1zzyx_asset_explorer__ ::-webkit-scrollbar-thumb { background: #2b2d31; border-radius: 4px; } .dz-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.8); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; padding: 25px; } .dz-modal { width: min(1400px, 97vw); height: min(900px, 94vh); background: var(--dz-bg); border: 1px solid var(--dz-border); border-radius: 12px; box-shadow: var(--dz-shadow); display: flex; flex-direction: column; overflow: hidden; } .dz-header { padding: 18px 20px; border-bottom: 1px solid var(--dz-border); display: flex; align-items: center; gap: 14px; } .dz-logo { width: 42px; height: 42px; border-radius: 10px; background: var(--dz-accent); display: grid; place-items: center; font-weight: 900; color: white; font-size: 18px; } .dz-heading { flex: 1; } .dz-heading h2 { margin: 0; font-size: 19px; color: #fff; } .dz-heading p { margin: 4px 0 0; font-size: 12px; color: var(--dz-muted); } .dz-close { border: 0; width: 36px; height: 36px; border-radius: 50%; background: transparent; color: var(--dz-muted); font-size: 24px; cursor: pointer; transition: 0.2s; } .dz-close:hover { background: #f23f42; color: white; } .dz-toolbar { padding: 12px 18px; display: flex; gap: 10px; border-bottom: 1px solid var(--dz-border); background: #17181a; } .dz-input { height: 38px; border: 1px solid var(--dz-border); background: var(--dz-card); color: var(--dz-text); border-radius: 8px; padding: 0 12px; outline: none; transition: 0.2s; } .dz-search { flex: 1; } .dz-input:focus { border-color: var(--dz-accent); } .dz-info { display: flex; align-items: center; justify-content: flex-end; min-width: 100px; font-size: 13px; font-weight: 500; color: var(--dz-accent); } .dz-body { flex: 1; overflow-y: auto; padding: 16px; background: #141517; } .dz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; } .dz-card { background: var(--dz-card); border: 1px solid var(--dz-border); border-radius: 10px; overflow: hidden; transition: border-color 0.2s; display: flex; flex-direction: column; } .dz-card:hover { border-color: var(--dz-card-hover); } .dz-preview { height: 150px; background: repeating-conic-gradient(#17181a 0% 25%, #1b1c1f 0% 50%) 50% / 20px 20px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; } .dz-preview img, .dz-preview video { max-width: 100%; max-height: 100%; object-fit: contain; } .dz-preview audio { width: 90%; } .dz-icon { font-size: 24px; color: var(--dz-muted); font-weight: bold; } .dz-card-body { padding: 12px; flex: 1; display: flex; flex-direction: column; } .dz-type { align-self: flex-start; padding: 3px 8px; border-radius: 4px; background: rgba(88,101,242,.15); color: #aeb5ff; font-size: 10px; text-transform: uppercase; font-weight: bold; } .dz-name { margin-top: 8px; font-family: Consolas, monospace; font-size: 12px; color: var(--dz-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .dz-meta { margin-top: auto; padding-top: 8px; font-size: 11px; color: #80848e; line-height: 1.5; } .dz-actions { display: flex; gap: 8px; margin-top: 10px; } .dz-btn { flex: 1; border: 0; border-radius: 6px; height: 32px; color: var(--dz-text); background: #2b2d31; cursor: pointer; font-size: 12px; font-weight: 500; transition: 0.15s; } .dz-btn:hover { background: #35373c; color: #fff; } .dz-btn-primary { background: var(--dz-accent); color: white; margin: 20px auto 10px; display: block; padding: 10px 24px; } .dz-btn-primary:hover { background: #4752c4; } </style><div class="dz-backdrop"><div class="dz-modal"><div class="dz-header"><div class="dz-heading"><h2>[Dr1zzyx] Discord Asset Explorer</h2></div><button class="dz-close" title="Close">×</button></div><div class="dz-toolbar"><input class="dz-input dz-search" placeholder="Search by hash, extension, module or URL..." spellcheck="false"><select class="dz-input dz-filter"><option value="">All Extensions</option></select><div class="dz-info">0 Assets</div></div><div class="dz-body"><div class="dz-grid"></div><button class="dz-btn dz-btn-primary dz-load-more" style="display:none">Load More</button></div></div></div>';
		}

		cacheDOM() {
			this.$grid = this.root.querySelector(".dz-grid");
			this.$search = this.root.querySelector(".dz-search");
			this.$filter = this.root.querySelector(".dz-filter");
			this.$info = this.root.querySelector(".dz-info");
			this.$loadMore = this.root.querySelector(".dz-load-more");
			this.$close = this.root.querySelector(".dz-close");
			this.$backdrop = this.root.querySelector(".dz-backdrop");
		}

		bindEvents() {
			this.$search.addEventListener(
				"input",
				debounce(() => {
					this.visibleCount = this.pageSize;
					this.updateGrid();
				}, 300)
			);
			this.$filter.addEventListener("change", () => {
				this.visibleCount = this.pageSize;
				this.updateGrid();
			});
			this.$loadMore.addEventListener("click", () => {
				this.visibleCount += this.pageSize;
				this.updateGrid();
			});
			this.$grid.addEventListener("click", e => {
				const btn = e.target.closest(".dz-btn");
				if (!btn) return;
				if (btn.dataset.copy) {
					navigator.clipboard.writeText(btn.dataset.copy).then(() => {
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
				}
			});
			this.handleEsc = e => {
				if (e.key === "Escape") this.destroy();
			};
			document.addEventListener("keydown", this.handleEsc);
			this.$close.addEventListener("click", () => this.destroy());
			this.$backdrop.addEventListener("click", e => {
				if (e.target === this.$backdrop) this.destroy();
			});
		}

		populateFilters() {
			const exts = [...new Set(this.assetList.map(a => a.extension).filter(Boolean))].sort();
			exts.forEach(ext => {
				const opt = document.createElement("option");
				opt.value = ext;
				opt.textContent = ext.toUpperCase();
				this.$filter.appendChild(opt);
			});
		}

		getPreviewHTML(asset) {
			const url = escapeHTML(asset.url);
			const ext = asset.extension;
			if (EXTENSIONS.images.has(ext))
				return '<img src="' + url + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<div class=\\\'dz-icon\\\'>⚠ Error</div>\'">';
			if (EXTENSIONS.videos.has(ext)) return '<video src="' + url + '" controls preload="metadata"></video>';
			if (EXTENSIONS.audios.has(ext)) return '<audio src="' + url + '" controls preload="none"></audio>';
			if (EXTENSIONS.fonts.has(ext)) return '<div class="dz-icon" style="font-family: serif;">Aa</div>';
			return '<div class="dz-icon">.' + escapeHTML(ext || "?") + "</div>";
		}

		updateGrid() {
			const query = this.$search.value.trim().toLowerCase();
			const filterExt = this.$filter.value;
			const filtered = this.assetList.filter(asset => {
				if (filterExt && asset.extension !== filterExt) return false;
				if (!query) return true;
				const haystack = (asset.url + " " + asset.extension + " " + asset.modules.join(" ") + " " + asset.sources.join(" ")).toLowerCase();
				return haystack.includes(query);
			});
			const visible = filtered.slice(0, this.visibleCount);
			this.$info.textContent = filtered.length + " Found";
			this.$grid.innerHTML = visible
				.map(asset => {
					const fileName = escapeHTML(asset.url.split("/").pop().split("?")[0] || asset.url);
					const modules = asset.modules.length ? asset.modules.slice(0, 3).join(", ") + (asset.modules.length > 3 ? "..." : "") : "N/A";
					return (
						'<div class="dz-card"><div class="dz-preview">' +
						this.getPreviewHTML(asset) +
						'</div><div class="dz-card-body"><span class="dz-type">' +
						escapeHTML(asset.extension || "unknown") +
						'</span><div class="dz-name" title="' +
						escapeHTML(asset.url) +
						'">' +
						fileName +
						'</div><div class="dz-meta"><strong>Modules:</strong> ' +
						escapeHTML(modules) +
						"<br><strong>Source:</strong> " +
						escapeHTML(asset.sources.join(", ")) +
						'</div><div class="dz-actions"><button class="dz-btn" data-copy="' +
						escapeHTML(asset.url) +
						'">Copy</button><button class="dz-btn" data-open="' +
						escapeHTML(asset.url) +
						'">Open</button></div></div></div>'
					);
				})
				.join("");
			this.$loadMore.style.display = filtered.length > this.visibleCount ? "block" : "none";
		}

		destroy() {
			document.removeEventListener("keydown", this.handleEsc);
			this.root.remove();
		}
	}

	window.openDr1zzyxExplorer = () => new DiscordAssetExplorer();
	window.openDr1zzyxExplorer();
})();
