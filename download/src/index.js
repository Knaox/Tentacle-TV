// ─── Configuration ────────────────────────────────────────────────────────────
// Toggle platforms on/off. Set enabled: false to hide from download + status table.
// status: "available" | "soon" | "beta"
const CONFIG = {
  github: "https://github.com/Knaox/Tentacle-TV",
  ghcr: "ghcr.io/knaox/tentacle-tv:latest",
  latestJson: "https://github.com/Knaox/Tentacle-TV/releases/latest/download/latest.json",

  // ── Platforms ──
  web:       { enabled: true,  status: "available", tech: "React 19 + Vite 6 + Tailwind CSS" },
  macOS:     { enabled: true,  status: "available", tech: "Tauri v2 + mpv (signed & notarized)" },
  windows:   { enabled: true,  status: "available", tech: "Tauri v2 + mpv (MSI / EXE)", storeUrl: "https://apps.microsoft.com/detail/9nkhl0t84245?hl=fr-FR&gl=US" },
  iOS:       { enabled: true,  status: "soon",      tech: "React Native + Expo", storeUrl: "" },
  android:   { enabled: true,  status: "soon",      tech: "React Native + Expo", storeUrl: "" },
  androidTV: { enabled: true,  status: "soon",      tech: "React Native (Android TV)" },
  appleTV:   { enabled: true,  status: "soon",      tech: "React Native (tvOS)" },
};

// ─── Latest.json fetcher ──────────────────────────────────────────────────────
async function fetchLatest() {
  try {
    const res = await fetch(CONFIG.latestJson, {
      cf: { cacheTtl: 3600, cacheEverything: true },
      headers: { "User-Agent": "Tentacle-TV-Download-Worker" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Per-platform version fetcher ────────────────────────────────────────────
const VERSION_SOURCES = {
  web:     "apps/web/package.json",
  desktop: null, // from latest.json
  mobile:  "apps/mobile/package.json",
  tv:      "apps/tv/package.json",
  backend: "apps/backend/package.json",
};

async function fetchWindowsStoreVersion() {
  try {
    // Microsoft Display Catalog API — public, no auth required
    const productId = "9NKHL0T84245";
    const res = await fetch(
      `https://displaycatalog.mp.microsoft.com/v7.0/products/${productId}?languages=en-us&market=US`,
      { cf: { cacheTtl: 3600, cacheEverything: true } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pkg = data.Product?.DisplaySkuAvailabilities?.[0]?.Sku?.Properties?.Packages?.[0];
    if (!pkg?.PackageFullName) return null;
    // PackageFullName: "DamienROUGE.Tentacle_1.2.3.0_x64__nc896ct3kqbem"
    const ver = pkg.PackageFullName.split("_")[1]; // "1.2.3.0"
    return ver ? ver.replace(/\.0$/, "") : null;    // "1.2.3"
  } catch {
    return null;
  }
}

async function fetchVersions(latest) {
  const versions = { desktop: latest?.version || null };
  const entries = Object.entries(VERSION_SOURCES).filter(([, path]) => path);

  const [pkgResults, winStoreVer] = await Promise.all([
    Promise.allSettled(
      entries.map(async ([key, path]) => {
        const url = `https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/${path}`;
        const res = await fetch(url, {
          cf: { cacheTtl: 3600, cacheEverything: true },
          headers: { "User-Agent": "Tentacle-TV-Download-Worker" },
        });
        if (!res.ok) return [key, null];
        const pkg = await res.json();
        return [key, pkg.version || null];
      }),
    ),
    fetchWindowsStoreVersion(),
  ]);

  for (const r of pkgResults) {
    if (r.status === "fulfilled") {
      const [key, ver] = r.value;
      versions[key] = ver;
    }
  }
  versions.windowsStore = winStoreVer || versions.desktop;
  return versions;
}

function extractMacDmg(latest) {
  if (!latest?.platforms) return null;
  const key = Object.keys(latest.platforms).find(
    (k) => k.includes("darwin") || k.includes("macos"),
  );
  if (!key) return null;
  const url = latest.platforms[key]?.url;
  if (!url) return null;
  // DMG includes version in filename: Tentacle.TV_1.2.0_aarch64.dmg
  // but tar.gz does not: Tentacle.TV_aarch64.app.tar.gz
  const version = latest.version?.replace(/^v/, "");
  if (version) {
    return url.replace(
      /_(aarch64|x86_64|x64|universal)\.app\.tar\.gz(?:\?.*)?$/,
      `_${version}_$1.dmg`,
    );
  }
  return url.replace(/\.app\.tar\.gz(?:\?.*)?$/, ".dmg");
}

function extractWindowsExe(latest) {
  if (!latest?.platforms) return null;
  const key = Object.keys(latest.platforms).find(
    (k) => k.includes("windows") || k.includes("win64"),
  );
  if (!key) return null;
  const url = latest.platforms[key]?.url;
  if (!url) return null;
  // nsis.zip already contains "-setup": Tentacle.TV_1.2.0_x64-setup.nsis.zip
  return url.replace(/\.nsis\.zip(?:\?.*)?$/, ".exe");
}

// ─── HTML page ────────────────────────────────────────────────────────────────
function renderPage(latest, versions = {}) {
  const version = latest?.version ? `v${latest.version.replace(/^v/, "")}` : null;
  const macDmg = extractMacDmg(latest);
  const macUrl = macDmg || `${CONFIG.github}/releases/latest`;
  const winExe = extractWindowsExe(latest);
  const winStoreUrl = CONFIG.windows.storeUrl;
  const winUrl = winStoreUrl || winExe || `${CONFIG.github}/releases/latest`;
  const winSub = winStoreUrl ? "Microsoft Store" : (winExe ? "Installer · .exe" : "View on GitHub");
  // Download cards: only show if enabled AND has a real download link
  const showMac = CONFIG.macOS.enabled && CONFIG.macOS.status === "available";
  const showWin = CONFIG.windows.enabled && (winStoreUrl || winExe);
  const showIOS = CONFIG.iOS.enabled && CONFIG.iOS.storeUrl;
  const showAndroid = CONFIG.android.enabled && CONFIG.android.storeUrl;
  const showMobile = showIOS || showAndroid;
  const showDesktop = showMac || showWin;

  // Format version badge for table
  const fmtVer = (v) => v ? `<code class="ver">v${v.replace(/^v/, "")}</code>` : "—";

  // Platform status table — only enabled platforms, with per-platform version
  const platforms = [
    CONFIG.web.enabled       && { name: "Web",        ...CONFIG.web,       version: versions.web },
    CONFIG.macOS.enabled     && { name: "macOS",      ...CONFIG.macOS,     version: versions.desktop },
    CONFIG.windows.enabled   && { name: "Windows",    ...CONFIG.windows,   version: versions.windowsStore },
    CONFIG.iOS.enabled       && { name: "iOS",        ...CONFIG.iOS,       version: versions.mobile },
    CONFIG.android.enabled   && { name: "Android",    ...CONFIG.android,   version: versions.mobile },
    CONFIG.androidTV.enabled && { name: "Android TV", ...CONFIG.androidTV, version: versions.tv },
    CONFIG.appleTV.enabled   && { name: "Apple TV",   ...CONFIG.appleTV,   version: versions.tv },
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tentacle TV — Your Jellyfin, everywhere</title>
  <meta name="description" content="Premium multi-platform media client for Jellyfin. Stream your library with a sleek glassmorphism interface on macOS, Windows, iOS, Android and Docker.">
  <meta name="theme-color" content="#080812">
  <meta property="og:title" content="Tentacle TV">
  <meta property="og:description" content="A premium, modern media client for Jellyfin. Self-hosted, multi-platform, open source.">
  <meta property="og:type" content="website">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(favicon())}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${css()}</style>
</head>
<body>
  <div class="grain"></div>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>

  <!-- ═══ Hero ═══ -->
  <header class="hero fadeUp">
    <div class="logo-wrap">
      ${logoSvg()}
    </div>
    <h1 class="hero-title">Tentacle TV</h1>
    <span class="badge">Latest</span>
    <p class="hero-sub">A premium, modern media client for <strong>Jellyfin</strong>.</p>
    <p class="hero-desc">Stream your library through a sleek, dark-themed interface with glassmorphism design,<br class="hide-mobile"> smooth animations, and powerful features &mdash; all self-hosted.</p>
  </header>

  <main>

    ${showDesktop ? `
    <!-- ═══ Download ═══ -->
    <section class="section fadeUp" style="animation-delay:.1s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("download")} Download</h2>
        <span class="section-badge">Desktop</span>
      </div>
      <div class="cards">
        ${showMac ? `
        <a href="${macUrl}" class="card featured">
          <div class="card-icon">${macSvg()}</div>
          <div class="card-body">
            <span class="card-label">macOS ${version ? `<span class="card-ver">${version}</span>` : ""}</span>
            <span class="card-sub">${macDmg ? "Apple Silicon · .dmg · Signed & Notarized" : "View on GitHub Releases"}</span>
          </div>
          <span class="card-action">${iconSvg("arrow-down")}</span>
        </a>` : ""}
        ${showWin ? `
        <a href="${winUrl}" class="card"${winStoreUrl ? ' target="_blank" rel="noopener"' : ""}>
          <div class="card-icon">${windowsSvg()}</div>
          <div class="card-body">
            <span class="card-label">Windows ${versions.windowsStore ? `<span class="card-ver">v${versions.windowsStore.replace(/^v/,"")}</span>` : ""}</span>
            <span class="card-sub">${winSub}</span>
          </div>
          <span class="card-action">${iconSvg("arrow-down")}</span>
        </a>` : ""}
      </div>
      ${version ? `<p class="section-note">Auto-updates built-in via Tauri updater.</p>` : ""}
    </section>` : ""}

    ${showMobile ? `
    <!-- ═══ Mobile ═══ -->
    <section class="section fadeUp" style="animation-delay:.15s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("phone")} Mobile</h2>
      </div>
      <div class="cards">
        ${showIOS ? `
        <a href="${CONFIG.iOS.storeUrl || CONFIG.github + '/releases'}" class="card" target="_blank" rel="noopener">
          <div class="card-icon">${iosSvg()}</div>
          <div class="card-body">
            <span class="card-label">iOS</span>
            <span class="card-sub">${CONFIG.iOS.storeUrl ? "App Store" : "Coming soon"}</span>
          </div>
          <span class="card-action">${iconSvg("external")}</span>
        </a>` : ""}
        ${showAndroid ? `
        <a href="${CONFIG.android.storeUrl || CONFIG.github + '/releases'}" class="card" target="_blank" rel="noopener">
          <div class="card-icon">${androidSvg()}</div>
          <div class="card-body">
            <span class="card-label">Android</span>
            <span class="card-sub">${CONFIG.android.storeUrl ? "Google Play" : "Coming soon"}</span>
          </div>
          <span class="card-action">${iconSvg("external")}</span>
        </a>` : ""}
      </div>
    </section>` : ""}

    <!-- ═══ Docker ═══ -->
    <section class="section fadeUp" style="animation-delay:.2s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("docker")} Self-Host with Docker</h2>
        ${versions.backend ? `<span class="section-badge">v${versions.backend.replace(/^v/,"")}</span>` : `<span class="section-badge">Recommended</span>`}
      </div>
      <p class="section-desc">The fastest way to get Tentacle TV running. Copy, paste, done.</p>

      <div class="tabs">
        <button class="tab active" onclick="switchTab(event,'tab-allinone')">All-in-one</button>
        <button class="tab" onclick="switchTab(event,'tab-external')">External DB</button>
      </div>

      <div id="tab-allinone" class="tab-panel active">
        <p class="code-desc">Includes MariaDB + Tentacle TV in a single stack:</p>
        <div class="code-block">
          <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          <pre><code>${escHtml(dockerComposeAllInOne())}</code></pre>
        </div>
        <div class="code-block mini">
          <pre><code>docker compose up -d</code></pre>
        </div>
      </div>

      <div id="tab-external" class="tab-panel">
        <p class="code-desc">Already have a MariaDB/MySQL instance? Use this minimal config:</p>
        <div class="code-block">
          <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          <pre><code>${escHtml(dockerComposeExternal())}</code></pre>
        </div>
        <div class="code-block mini">
          <pre><code>docker compose -f docker-compose.external.yml up -d</code></pre>
        </div>
      </div>

      <div class="info-box">
        ${iconSvg("info")}
        <div>
          <strong>First launch:</strong> Open <code>http://your-server:3000</code> &mdash; the setup wizard guides you through database, Jellyfin connection, and admin account creation.
        </div>
      </div>
    </section>

    <!-- ═══ Environment Variables ═══ -->
    <section class="section fadeUp" style="animation-delay:.25s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("settings")} Configuration</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Variable</th><th>Description</th><th>Default</th></tr></thead>
          <tbody>
            <tr><td><code>DATABASE_URL</code></td><td>MariaDB connection string</td><td>&mdash;</td></tr>
            <tr><td><code>JWT_SECRET</code></td><td>Secret key for token signing</td><td>&mdash;</td></tr>
            <tr><td><code>PORT</code></td><td>Server listening port</td><td><code>3000</code></td></tr>
            <tr><td><code>HOST</code></td><td>Server bind address</td><td><code>0.0.0.0</code></td></tr>
            <tr><td><code>RATE_LIMIT</code></td><td>Max requests/min per IP</td><td><code>1000</code></td></tr>
          </tbody>
        </table>
      </div>
      <p class="section-note">Jellyfin URL and API key are configured through the web setup wizard and stored in the database.</p>
    </section>

    <!-- ═══ Features ═══ -->
    <section class="section fadeUp" style="animation-delay:.3s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("sparkle")} Features</h2>
      </div>
      <div class="features-grid">
        <div class="feature">
          <div class="feature-icon">${iconSvg("play")}</div>
          <h3>Video Playback</h3>
          <p>HTML5 + HLS streaming (web), native mpv with Direct Play, Dolby Vision & Atmos (desktop). Resume, track switching, per-library preferences.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">${iconSvg("palette")}</div>
          <h3>Glassmorphism UI</h3>
          <p>Premium dark theme with purple/pink accents, dynamic hero banners, animated media cards, global search with <kbd>Ctrl+K</kbd>. Fully responsive.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">${iconSvg("puzzle")}</div>
          <h3>Plugin System</h3>
          <p>Built-in admin marketplace with one-click install. Multiple registry sources, SHA256 verification, auto-navigation integration.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">${iconSvg("shield")}</div>
          <h3>Administration</h3>
          <p>Setup wizard, invite system, support tickets, TV pairing via 4-digit code, real-time notifications. Full control.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">${iconSvg("globe")}</div>
          <h3>Multi-language</h3>
          <p>English and French with i18next. More languages can be added through the translation system.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">${iconSvg("refresh")}</div>
          <h3>Auto-Updates</h3>
          <p>Desktop app auto-updates via Tauri updater. Docker images auto-pull with Watchtower. Always up to date.</p>
        </div>
      </div>
    </section>

    <!-- ═══ Tech Stack ═══ -->
    <section class="section fadeUp" style="animation-delay:.35s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("code")} Tech Stack</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Layer</th><th>Technology</th></tr></thead>
          <tbody>
            <tr><td>Web</td><td>React 19, Vite 6, Tailwind CSS, Framer Motion</td></tr>
            <tr><td>Desktop</td><td>Tauri v2 (Rust), native mpv player</td></tr>
            <tr><td>Mobile</td><td>React Native 0.76, Expo 52, NativeWind</td></tr>
            <tr><td>Backend</td><td>Fastify 5, Prisma 6, MariaDB 11</td></tr>
            <tr><td>Data</td><td>TanStack Query v5</td></tr>
            <tr><td>Video</td><td>hls.js (web), mpv (desktop), react-native-video</td></tr>
            <tr><td>Language</td><td>TypeScript 5.7, strict mode</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ═══ Architecture ═══ -->
    <section class="section fadeUp" style="animation-delay:.4s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("layers")} Architecture</h2>
      </div>
      <div class="code-block arch">
        <pre><code>${escHtml(architectureDiagram())}</code></pre>
      </div>
      <div class="arch-cards">
        <div class="arch-card">
          <strong>Tentacle Backend</strong> <code>/api/*</code>
          <p>Auth, invites, tickets, config, pairing, plugins</p>
        </div>
        <div class="arch-card">
          <strong>Jellyfin Proxy</strong> <code>/api/jellyfin/*</code>
          <p>Streaming, media browsing, user data via backend proxy</p>
        </div>
      </div>
    </section>

    <!-- ═══ Platforms ═══ -->
    <section class="section fadeUp" style="animation-delay:.45s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("devices")} Platform Status</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Platform</th><th>Version</th><th>Status</th><th>Technology</th></tr></thead>
          <tbody>
            ${platforms.map(p => `<tr><td>${p.name}</td><td>${fmtVer(p.version)}</td><td><span class="status-badge ${p.status === "available" ? "ok" : p.status === "beta" ? "beta" : "soon"}">${p.status === "available" ? "Available" : p.status === "beta" ? "Beta" : "Coming soon"}</span></td><td>${p.tech}</td></tr>`).join("\n            ")}
          </tbody>
        </table>
      </div>
    </section>

    <!-- ═══ Resources ═══ -->
    <section class="section fadeUp" style="animation-delay:.5s">
      <div class="section-header">
        <h2 class="section-title">${iconSvg("link")} Resources</h2>
      </div>
      <div class="links">
        <a href="${CONFIG.github}" target="_blank" rel="noopener">${iconSvg("github")} GitHub</a>
        <a href="${CONFIG.github}#readme" target="_blank" rel="noopener">${iconSvg("book")} Documentation</a>
        <a href="${CONFIG.github}/releases" target="_blank" rel="noopener">${iconSvg("tag")} All Releases</a>
        <a href="${CONFIG.github}/pkgs/container/tentacle-tv" target="_blank" rel="noopener">${iconSvg("docker")} Docker Image</a>
        <a href="${CONFIG.github}/issues/new" target="_blank" rel="noopener">${iconSvg("bug")} Report a Bug</a>
        <a href="${CONFIG.github}/blob/main/PRIVACY.md" target="_blank" rel="noopener">${iconSvg("shield")} Privacy</a>
        <a href="${CONFIG.github}/blob/main/LICENSE" target="_blank" rel="noopener">${iconSvg("scale")} MIT License</a>
      </div>
    </section>
  </main>

  <footer class="footer fadeUp" style="animation-delay:.55s">
    <div class="footer-logo">${logoSvgSmall()}</div>
    <p>&copy; 2025 Tentacle TV &middot; MIT License &middot; Made with love for Jellyfin</p>
  </footer>

  <script>${js()}</script>
</body>
</html>`;
}

// ─── Static content ───────────────────────────────────────────────────────────
function dockerComposeAllInOne() {
  return `services:
  db:
    image: mariadb:11
    container_name: tentacle-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: tentacle_db
      MYSQL_USER: tentacle_user
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
    volumes:
      - tentacle-db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    image: ghcr.io/knaox/tentacle-tv:latest
    container_name: tentacle-tv
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://tentacle_user:\${MYSQL_PASSWORD}@db:3306/tentacle_db
      JWT_SECRET: \${JWT_SECRET}
      PORT: "3000"
      HOST: "0.0.0.0"
    volumes:
      - tentacle-data:/app/apps/backend/data
    ports:
      - "3000:3000"

volumes:
  tentacle-db-data:
  tentacle-data:`;
}

function dockerComposeExternal() {
  return `services:
  web:
    image: ghcr.io/knaox/tentacle-tv:latest
    container_name: tentacle-tv
    restart: unless-stopped
    environment:
      JWT_SECRET: \${JWT_SECRET}
      PORT: "3000"
      HOST: "0.0.0.0"
    volumes:
      - tentacle-data:/app/apps/backend/data
    ports:
      - "3000:3000"

volumes:
  tentacle-data:`;
}

function architectureDiagram() {
  return `┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Web App   │────▶│   Backend   │────▶│    MariaDB      │
│  (React 19) │     │ (Fastify 5) │     │  (Prisma ORM)   │
└─────────────┘     └──────┬──────┘     └─────────────────┘
                           │
┌─────────────┐            │            ┌─────────────────┐
│ Desktop App │────────────┘       ┌───▶│ Jellyfin Server │
│  (Tauri v2) │                    │    └─────────────────┘
└─────────────┘            ▲───────┘
                           │
                     /api/jellyfin/*
                      (proxy route)`;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function css() {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080812;--bg2:#0c0c1a;
  --surface:rgba(255,255,255,.035);--surface-hover:rgba(255,255,255,.065);
  --border:rgba(255,255,255,.07);--border-hover:rgba(139,92,246,.3);
  --text:#e8e6f4;--text-dim:rgba(255,255,255,.42);--text-muted:rgba(255,255,255,.28);
  --violet:#8B5CF6;--violet-dim:#7C3AED;--violet-glow:rgba(139,92,246,.2);
  --pink:#EC4899;--pink-glow:rgba(236,72,153,.15);
  --green:#34D399;--amber:#FBBF24;
  --radius:16px;--radius-sm:12px;--radius-xs:8px;
}
html{font-family:'DM Sans',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);
  -webkit-font-smoothing:antialiased;scroll-behavior:smooth;font-size:15px}
body{min-height:100vh;display:flex;flex-direction:column;align-items:center;
  padding:0 1.25rem 2rem;overflow-x:hidden}
a{color:inherit;text-decoration:none}
strong{font-weight:600}
code{font-family:'DM Mono',ui-monospace,monospace;font-size:.85em;
  background:rgba(139,92,246,.1);padding:.1em .35em;border-radius:4px;color:var(--violet)}
kbd{font-family:'DM Mono',monospace;font-size:.8em;padding:.1em .4em;
  border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--text-dim)}

/* Grain overlay */
.grain{position:fixed;inset:0;pointer-events:none;opacity:.025;z-index:999;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:128px}

/* Glow blobs */
.glow{position:fixed;border-radius:50%;pointer-events:none;filter:blur(120px);opacity:.12}
.glow-1{width:600px;height:600px;background:var(--violet);top:-200px;left:-150px}
.glow-2{width:500px;height:500px;background:var(--pink);bottom:-250px;right:-200px}

/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.fadeUp{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) both}

/* ═══ Hero ═══ */
.hero{text-align:center;padding:4.5rem 0 3rem;max-width:640px}
.logo-wrap{margin-bottom:1.25rem}
.logo-wrap svg{width:88px;height:auto;filter:drop-shadow(0 0 32px rgba(139,92,246,.35))}
.hero-title{font-size:2.6rem;font-weight:700;letter-spacing:-.03em;margin-bottom:.6rem;
  background:linear-gradient(135deg,#fff 0%,var(--violet) 50%,var(--pink) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.badge{display:inline-block;font-family:'DM Mono',monospace;font-size:.72rem;font-weight:500;
  padding:.2rem .65rem;border-radius:999px;margin-bottom:.75rem;
  background:var(--violet-glow);color:var(--violet);border:1px solid rgba(139,92,246,.25)}
.hero-sub{font-size:1.15rem;color:var(--text);margin-bottom:.4rem}
.hero-desc{font-size:.92rem;color:var(--text-dim);line-height:1.6}

/* ═══ Main ═══ */
main{width:100%;max-width:680px}

/* ═══ Section ═══ */
.section{margin-bottom:2.75rem}
.section-header{display:flex;align-items:center;gap:.5rem;margin-bottom:.85rem}
.section-title{display:flex;align-items:center;gap:.45rem;font-size:.82rem;font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--text-dim)}
.section-title svg{width:15px;height:15px;opacity:.6}
.section-badge{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
  padding:.15rem .5rem;border-radius:999px;background:rgba(52,211,153,.12);color:var(--green);
  border:1px solid rgba(52,211,153,.2)}
.section-desc{font-size:.9rem;color:var(--text-dim);margin-bottom:1rem;line-height:1.5}
.section-note{font-size:.8rem;color:var(--text-muted);margin-top:.6rem}

/* ═══ Cards ═══ */
.cards{display:flex;flex-direction:column;gap:.5rem}
.card{display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  transition:all .2s ease;cursor:pointer;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;inset:0;opacity:0;
  background:linear-gradient(135deg,rgba(139,92,246,.06),rgba(236,72,153,.04));transition:opacity .2s}
.card:hover::before{opacity:1}
.card:hover{border-color:var(--border-hover);box-shadow:0 0 28px var(--violet-glow)}
.card.featured{background:linear-gradient(135deg,rgba(139,92,246,.08),rgba(236,72,153,.04));
  border-color:rgba(139,92,246,.18)}
.card.featured:hover{border-color:rgba(139,92,246,.4);box-shadow:0 0 40px var(--violet-glow)}
.card-icon{width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
  background:rgba(255,255,255,.04);border-radius:10px}
.card-icon svg{width:22px;height:22px;fill:var(--text)}
.card-body{flex:1;display:flex;flex-direction:column;gap:.15rem;position:relative;z-index:1}
.card-label{font-size:1rem;font-weight:600}
.card-ver{font-size:.65rem;font-weight:500;color:var(--accent);background:rgba(139,92,246,.12);padding:1px 7px;border-radius:9px;margin-left:6px;vertical-align:middle}
.card-sub{font-family:'DM Mono',monospace;font-size:.72rem;color:var(--text-dim)}
.card-action{width:34px;height:34px;display:flex;align-items:center;justify-content:center;
  border-radius:50%;background:rgba(255,255,255,.05);flex-shrink:0;transition:all .2s;position:relative;z-index:1}
.card:hover .card-action{background:rgba(139,92,246,.18)}
.card-action svg{width:15px;height:15px;fill:var(--text)}

/* ═══ Tabs ═══ */
.tabs{display:flex;gap:.25rem;margin-bottom:1rem;background:var(--surface);
  border-radius:var(--radius-xs);padding:3px;border:1px solid var(--border);width:fit-content}
.tab{font-family:inherit;font-size:.8rem;font-weight:500;padding:.4rem .85rem;
  border-radius:6px;border:none;background:none;color:var(--text-dim);cursor:pointer;transition:all .2s}
.tab:hover{color:var(--text)}
.tab.active{background:rgba(139,92,246,.15);color:var(--violet)}
.tab-panel{display:none}
.tab-panel.active{display:block}

/* ═══ Code blocks ═══ */
.code-block{position:relative;background:var(--bg2);border:1px solid var(--border);
  border-radius:var(--radius-sm);overflow:hidden;margin-bottom:.5rem}
.code-block pre{padding:1rem 1.25rem;overflow-x:auto;font-family:'DM Mono',monospace;
  font-size:.78rem;line-height:1.65;color:var(--text-dim);white-space:pre}
.code-block.mini{background:rgba(139,92,246,.06);border-color:rgba(139,92,246,.15)}
.code-block.mini pre{padding:.6rem 1rem;color:var(--violet)}
.code-block.arch pre{padding:1.25rem;text-align:center;color:var(--text-dim);font-size:.72rem;line-height:1.5}
.copy-btn{position:absolute;top:.5rem;right:.5rem;font-family:'DM Mono',monospace;font-size:.7rem;
  padding:.25rem .55rem;border-radius:6px;border:1px solid var(--border);background:var(--surface);
  color:var(--text-dim);cursor:pointer;transition:all .15s;z-index:2}
.copy-btn:hover{background:var(--surface-hover);color:var(--text);border-color:var(--border-hover)}
.copy-btn.copied{background:rgba(52,211,153,.15);color:var(--green);border-color:rgba(52,211,153,.3);
  transform:scale(1.05);transition:all .15s}
.code-desc{font-size:.82rem;color:var(--text-dim);margin-bottom:.5rem}

/* ═══ Info box ═══ */
.info-box{display:flex;align-items:flex-start;gap:.75rem;padding:1rem 1.15rem;margin-top:.75rem;
  background:rgba(139,92,246,.05);border:1px solid rgba(139,92,246,.12);border-radius:var(--radius-sm);
  font-size:.82rem;color:var(--text-dim);line-height:1.55}
.info-box svg{width:18px;height:18px;flex-shrink:0;margin-top:.1rem;fill:var(--violet);opacity:.7}

/* ═══ Table ═══ */
.table-wrap{overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--border);
  background:var(--surface)}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th{text-align:left;padding:.6rem 1rem;font-weight:600;color:var(--text-dim);font-size:.72rem;
  text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);background:rgba(255,255,255,.015)}
td{padding:.55rem 1rem;border-bottom:1px solid rgba(255,255,255,.03);color:var(--text-dim)}
tr:last-child td{border-bottom:none}
.status-badge{font-size:.7rem;font-weight:600;padding:.15rem .45rem;border-radius:999px}
.status-badge.ok{background:rgba(52,211,153,.12);color:var(--green)}
.status-badge.beta{background:rgba(139,92,246,.12);color:var(--violet)}
.status-badge.soon{background:rgba(251,191,36,.1);color:var(--amber)}
code.ver{font-family:'DM Mono',monospace;font-size:.7rem;color:var(--accent);background:rgba(139,92,246,.1);padding:.1rem .4rem;border-radius:4px}

/* ═══ Features Grid ═══ */
.features-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.feature{padding:1.1rem;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-sm);transition:border-color .2s}
.feature:hover{border-color:var(--border-hover)}
.feature-icon{margin-bottom:.5rem}
.feature-icon svg{width:20px;height:20px;fill:var(--violet);opacity:.7}
.feature h3{font-size:.88rem;font-weight:600;margin-bottom:.3rem}
.feature p{font-size:.78rem;color:var(--text-dim);line-height:1.5}

/* ═══ Architecture ═══ */
.arch-cards{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.5rem}
.arch-card{padding:.85rem 1rem;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-sm);font-size:.82rem}
.arch-card strong{display:block;margin-bottom:.2rem;font-size:.85rem}
.arch-card code{font-size:.72rem}
.arch-card p{font-size:.75rem;color:var(--text-dim);margin-top:.3rem}

/* ═══ Resource links ═══ */
.links{display:flex;flex-wrap:wrap;gap:.4rem}
.links a{display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:500;
  padding:.5rem .85rem;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-sm);color:var(--text-dim);transition:all .2s}
.links a:hover{color:var(--text);border-color:var(--border-hover);background:var(--surface-hover)}
.links a svg{width:14px;height:14px;fill:currentColor;opacity:.55}

/* ═══ Footer ═══ */
.footer{margin-top:auto;padding:3rem 0 1rem;text-align:center}
.footer-logo{margin-bottom:.75rem}
.footer-logo svg{width:32px;height:auto;opacity:.3}
.footer p{font-size:.78rem;color:var(--text-muted)}

/* ═══ Responsive ═══ */
.hide-mobile{display:inline}
@media(max-width:600px){
  body{padding:0 1rem 1.5rem}
  .hero{padding:3rem 0 2rem}
  .hero-title{font-size:2rem}
  .logo-wrap svg{width:68px}
  .hide-mobile{display:none}
  .features-grid{grid-template-columns:1fr}
  .arch-cards{grid-template-columns:1fr}
  .code-block pre{font-size:.7rem;padding:.75rem}
  .section-header{flex-wrap:wrap}
}
@media(max-width:400px){
  .hero-title{font-size:1.7rem}
  .tabs{width:100%}
  .tab{flex:1;text-align:center}
}
`;
}

// ─── JavaScript ───────────────────────────────────────────────────────────────
function js() {
  return `
function switchTab(e,id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  e.currentTarget.classList.add('active');
  document.getElementById(id).classList.add('active');
}
function copyCode(btn){
  var code=btn.parentElement.querySelector('code').textContent;
  var done=function(){
    btn.classList.add('copied');
    btn.innerHTML='&#10003; Copied!';
    setTimeout(function(){btn.classList.remove('copied');btn.textContent='Copy';},2000);
  };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(done).catch(function(){fallbackCopy(code);done();});
  }else{fallbackCopy(code);done();}
}
function fallbackCopy(text){
  var ta=document.createElement('textarea');
  ta.value=text;ta.style.cssText='position:fixed;left:-9999px';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);
}
`;
}

// ─── Real Tentacle TV Pirate Logo ─────────────────────────────────────────────
function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 560" width="512" height="560">
  <defs>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8B5CF6"/>
      <stop offset="50%" style="stop-color:#A855F7"/>
      <stop offset="100%" style="stop-color:#EC4899"/>
    </linearGradient>
    <linearGradient id="tentacleGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7C3AED"/>
      <stop offset="100%" style="stop-color:#DB2777"/>
    </linearGradient>
    <linearGradient id="tentacleGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#9333EA"/>
      <stop offset="100%" style="stop-color:#F472B6"/>
    </linearGradient>
    <linearGradient id="cheekGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F9A8D4"/>
      <stop offset="100%" style="stop-color:#F472B6"/>
    </linearGradient>
    <linearGradient id="shineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:white;stop-opacity:0.35"/>
      <stop offset="100%" style="stop-color:white;stop-opacity:0"/>
    </linearGradient>
    <linearGradient id="hatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#2D2D2D"/>
      <stop offset="100%" style="stop-color:#1A1A1A"/>
    </linearGradient>
    <linearGradient id="hatBandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#8B5CF6"/>
      <stop offset="50%" style="stop-color:#A855F7"/>
      <stop offset="100%" style="stop-color:#EC4899"/>
    </linearGradient>
    <linearGradient id="skullGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFFFF"/>
      <stop offset="100%" style="stop-color:#E2E8F0"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#7C3AED" flood-opacity="0.3"/>
    </filter>
    <filter id="hatShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <!-- Tentacles -->
  <path d="M160 358 Q120 418 100 468 Q85 508 110 528 Q130 543 145 518 Q160 493 155 448 Q152 418 170 388" fill="url(#tentacleGrad1)" opacity=".85"/>
  <path d="M352 358 Q392 418 412 468 Q427 508 402 528 Q382 543 367 518 Q352 493 357 448 Q360 418 342 388" fill="url(#tentacleGrad1)" opacity=".85"/>
  <path d="M140 348 Q90 388 60 448 Q40 498 65 523 Q88 546 100 508 Q115 468 120 428 Q125 398 150 368" fill="url(#tentacleGrad2)" opacity=".8"/>
  <path d="M372 348 Q422 388 452 448 Q472 498 447 523 Q424 546 412 508 Q397 468 392 428 Q387 398 362 368" fill="url(#tentacleGrad2)" opacity=".8"/>
  <path d="M185 363 Q165 428 150 478 Q138 518 160 536 Q180 550 188 520 Q195 490 195 448 Q195 413 200 383" fill="url(#tentacleGrad1)"/>
  <path d="M327 363 Q347 428 362 478 Q374 518 352 536 Q332 550 324 520 Q317 490 317 448 Q317 413 312 383" fill="url(#tentacleGrad1)"/>
  <path d="M220 373 Q210 438 205 488 Q200 523 220 538 Q240 548 242 516 Q244 484 240 448 Q237 418 235 388" fill="url(#tentacleGrad2)"/>
  <path d="M292 373 Q302 438 307 488 Q312 523 292 538 Q272 548 270 516 Q268 484 272 448 Q275 418 277 388" fill="url(#tentacleGrad2)"/>
  <!-- Suction cups -->
  <circle cx="108" cy="498" r="5" fill="#DDD6FE" opacity=".5"/>
  <circle cx="150" cy="506" r="5" fill="#DDD6FE" opacity=".5"/>
  <circle cx="215" cy="510" r="4" fill="#DDD6FE" opacity=".5"/>
  <circle cx="297" cy="510" r="4" fill="#DDD6FE" opacity=".5"/>
  <circle cx="362" cy="506" r="5" fill="#DDD6FE" opacity=".5"/>
  <circle cx="404" cy="498" r="5" fill="#DDD6FE" opacity=".5"/>
  <circle cx="95" cy="473" r="4" fill="#DDD6FE" opacity=".4"/>
  <circle cx="145" cy="483" r="4" fill="#DDD6FE" opacity=".4"/>
  <circle cx="210" cy="488" r="3.5" fill="#DDD6FE" opacity=".4"/>
  <circle cx="302" cy="488" r="3.5" fill="#DDD6FE" opacity=".4"/>
  <circle cx="367" cy="483" r="4" fill="#DDD6FE" opacity=".4"/>
  <circle cx="417" cy="473" r="4" fill="#DDD6FE" opacity=".4"/>
  <!-- Body -->
  <ellipse cx="256" cy="268" rx="130" ry="140" fill="url(#bodyGrad)" filter="url(#shadow)"/>
  <ellipse cx="240" cy="223" rx="80" ry="70" fill="url(#shineGrad)" opacity=".5"/>
  <!-- Eyes -->
  <ellipse cx="210" cy="263" rx="38" ry="42" fill="white"/>
  <ellipse cx="302" cy="263" rx="38" ry="42" fill="white"/>
  <ellipse cx="215" cy="268" rx="22" ry="26" fill="#1E1B4B"/>
  <ellipse cx="307" cy="268" rx="22" ry="26" fill="#1E1B4B"/>
  <ellipse cx="218" cy="266" rx="12" ry="14" fill="#0F0A2A"/>
  <ellipse cx="310" cy="266" rx="12" ry="14" fill="#0F0A2A"/>
  <circle cx="224" cy="256" r="8" fill="white" opacity=".9"/>
  <circle cx="316" cy="256" r="8" fill="white" opacity=".9"/>
  <circle cx="212" cy="272" r="4" fill="white" opacity=".5"/>
  <circle cx="304" cy="272" r="4" fill="white" opacity=".5"/>
  <!-- Eyebrows -->
  <path d="M180 230 Q195 220 225 226" stroke="#6D28D9" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M287 226 Q317 220 332 230" stroke="#6D28D9" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <!-- Smile -->
  <path d="M228 316 Q256 343 284 316" stroke="#6D28D9" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Cheeks -->
  <ellipse cx="170" cy="303" rx="20" ry="14" fill="url(#cheekGrad)" opacity=".45"/>
  <ellipse cx="342" cy="303" rx="20" ry="14" fill="url(#cheekGrad)" opacity=".45"/>
  <!-- Pirate Hat -->
  <ellipse cx="256" cy="155" rx="155" ry="22" fill="#1A1A1A" filter="url(#hatShadow)"/>
  <ellipse cx="256" cy="153" rx="150" ry="18" fill="#2D2D2D"/>
  <ellipse cx="256" cy="151" rx="145" ry="14" fill="url(#hatGrad)"/>
  <path d="M145 155 Q140 100 165 60 Q195 20 256 8 Q317 20 347 60 Q372 100 367 155 Z" fill="url(#hatGrad)" filter="url(#hatShadow)"/>
  <path d="M175 140 Q178 95 200 62 Q225 32 256 25 Q280 32 300 55 Q310 72 310 90" fill="white" opacity=".06"/>
  <path d="M152 145 Q155 138 165 135 Q210 128 256 126 Q302 128 347 135 Q357 138 360 145 Q357 152 347 155 Q302 162 256 164 Q210 162 165 155 Q155 152 152 145 Z" fill="url(#hatBandGrad)"/>
  <!-- Skull -->
  <ellipse cx="256" cy="88" rx="18" ry="20" fill="url(#skullGrad)"/>
  <ellipse cx="256" cy="95" rx="12" ry="8" fill="url(#skullGrad)"/>
  <ellipse cx="249" cy="84" rx="5" ry="6" fill="#1A1A1A"/>
  <ellipse cx="263" cy="84" rx="5" ry="6" fill="#1A1A1A"/>
  <path d="M254 92 L256 96 L258 92" fill="#1A1A1A" stroke="#1A1A1A" stroke-width="1"/>
  <path d="M248 100 L264 100" stroke="#1A1A1A" stroke-width="1.5"/>
  <line x1="251" y1="100" x2="251" y2="103" stroke="#1A1A1A" stroke-width="1"/>
  <line x1="256" y1="100" x2="256" y2="103" stroke="#1A1A1A" stroke-width="1"/>
  <line x1="261" y1="100" x2="261" y2="103" stroke="#1A1A1A" stroke-width="1"/>
  <!-- Crossbones -->
  <path d="M228 78 Q245 95 270 108" stroke="url(#skullGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M228 108 Q245 95 270 78" stroke="url(#skullGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="226" cy="76" r="4" fill="url(#skullGrad)"/>
  <circle cx="226" cy="110" r="4" fill="url(#skullGrad)"/>
  <circle cx="272" cy="76" r="4" fill="url(#skullGrad)"/>
  <circle cx="272" cy="110" r="4" fill="url(#skullGrad)"/>
  <path d="M145 155 Q150 148 170 145" stroke="#3D3D3D" stroke-width="1.5" fill="none" opacity=".5"/>
  <path d="M367 155 Q362 148 342 145" stroke="#3D3D3D" stroke-width="1.5" fill="none" opacity=".5"/>
</svg>`;
}

function logoSvgSmall() {
  // Simplified mini version for footer
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 560" width="32" height="35">
  <defs>
    <linearGradient id="fbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8B5CF6"/><stop offset="100%" style="stop-color:#EC4899"/>
    </linearGradient>
  </defs>
  <ellipse cx="256" cy="268" rx="130" ry="140" fill="url(#fbg)" opacity=".6"/>
  <ellipse cx="210" cy="263" rx="30" ry="34" fill="white" opacity=".8"/>
  <ellipse cx="302" cy="263" rx="30" ry="34" fill="white" opacity=".8"/>
  <ellipse cx="215" cy="268" rx="16" ry="20" fill="#1E1B4B"/>
  <ellipse cx="307" cy="268" rx="16" ry="20" fill="#1E1B4B"/>
  <path d="M228 316 Q256 340 284 316" stroke="#6D28D9" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
</svg>`;
}

function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#EC4899"/></linearGradient></defs><circle cx="16" cy="16" r="14" fill="url(#fg)" opacity=".15"/><ellipse cx="16" cy="17" rx="10" ry="11" fill="url(#fg)"/><ellipse cx="13" cy="16.5" rx="3" ry="3.5" fill="white"/><ellipse cx="19.5" cy="16.5" rx="3" ry="3.5" fill="white"/><ellipse cx="13.5" cy="17" rx="1.8" ry="2.2" fill="#1E1B4B"/><ellipse cx="20" cy="17" rx="1.8" ry="2.2" fill="#1E1B4B"/><path d="M14 22 Q16 24 18 22" stroke="#6D28D9" stroke-width=".8" fill="none" stroke-linecap="round"/></svg>`;
}

// ─── Icon library ─────────────────────────────────────────────────────────────
function iconSvg(name) {
  const icons = {
    "download": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    "arrow-down": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
    "external": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM5 5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5h-2v5H5V7h5V5H5z"/></svg>`,
    "docker": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.98 11.08h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .1.09.19.19.19m-2.95-5.43h2.12a.19.19 0 0 0 .19-.19V3.58a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .1.09.19.19.19m0 2.71h2.12a.19.19 0 0 0 .19-.19V6.29a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .11.09.19.19.19m-2.93 0h2.12a.19.19 0 0 0 .19-.19V6.29a.19.19 0 0 0-.19-.19H8.1a.19.19 0 0 0-.19.19v1.88c0 .11.08.19.19.19m-2.96 0h2.12a.19.19 0 0 0 .19-.19V6.29a.19.19 0 0 0-.19-.19H5.14a.19.19 0 0 0-.19.19v1.88c0 .11.09.19.19.19m5.89 2.72h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .1.09.19.19.19m-2.93 0h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19H8.1a.19.19 0 0 0-.19.19v1.88c0 .1.08.19.19.19m-2.96 0h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19H5.14a.19.19 0 0 0-.19.19v1.88c0 .1.09.19.19.19m12.24 1.49c-.88-.56-1.83-.63-2.83-.49-.14-.67-.48-1.24-1.01-1.65a.15.15 0 0 0-.2.02l-.08.11a.15.15 0 0 0 .02.18c.57.48.83 1.09.92 1.82-1.06.27-1.98.74-2.71 1.62H2.34a.2.2 0 0 0-.2.17c-.08.5-.11 1-.07 1.51.15 1.87.83 3.47 2.1 4.77a8.27 8.27 0 0 0 4.18 2.35c1.8.44 3.6.46 5.42.1a9.17 9.17 0 0 0 3.48-1.53c1.43-1.07 2.35-2.49 2.85-4.21.7.07 1.42-.04 2.05-.47.53-.35.85-.82 1.01-1.41a.16.16 0 0 0-.09-.18z"/></svg>`,
    "phone": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    "settings": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    "sparkle": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>`,
    "play": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    "palette": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="11.5" r="2.5"/><circle cx="6.5" cy="11.5" r="2.5"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="8.5" cy="18.5" r="2.5"/></svg>`,
    "puzzle": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z"/></svg>`,
    "shield": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    "globe": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    "refresh": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
    "code": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    "layers": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    "devices": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    "link": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    "github": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
    "book": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    "tag": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    "bug": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    "scale": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>`,
    "info": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  };
  return icons[name] || "";
}

// ─── Platform icons ───────────────────────────────────────────────────────────
function macSvg() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
</svg>`;
}

function windowsSvg() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12V6.5l8-1.1V12H3zm0 .5h8v6.6l-8-1.1V12.5zm9 0h9V3.8l-9 1.2V12.5zm0 .5v6.5l9 1.2V13H12z"/>
</svg>`;
}

function iosSvg() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zM12 21.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM16.5 18h-10V4h10v14z"/>
</svg>`;
}

function androidSvg() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71s-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 0 0 6 7h12c0-2.11-1.1-3.96-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
</svg>`;
}

// ─── Worker entry ─────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname !== "/" && url.pathname !== "") {
      return new Response("Not found", { status: 404 });
    }

    const latest = await fetchLatest();
    const versions = await fetchVersions(latest);
    const html = renderPage(latest, versions);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  },
};
