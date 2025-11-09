<!doctype html>

<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Baklava — Jellyfin Media Request & Search Enhancement Plugin</title>
  <meta name="description" content="Baklava: a Jellyfin plugin that adds intelligent media request management and enhanced search capabilities." />
  <style>
    :root{
      --bg:#0f1724; --card:#0b1220; --muted:#9aa4b2; --accent:#f59e0b; --glass:rgba(255,255,255,0.03);
      --max:1000px; --radius:14px; --glass-2:rgba(255,255,255,0.02);
      color-scheme: dark;
    }
    *{box-sizing:border-box}
    html,body{height:100%;margin:0;font-family:Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; background:linear-gradient(180deg,#071026 0%, #081426 50%); color:#e6eef6}
    .container{max-width:var(--max);margin:32px auto;padding:28px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:20px;box-shadow:0 10px 30px rgba(2,6,23,0.7);} 
    header{display:flex;gap:16px;align-items:center}
    header img.logo{width:72px;height:72px;object-fit:contain;border-radius:12px;background:var(--glass)}
    header h1{font-size:20px;margin:0}
    header p.lead{margin:0;color:var(--muted);font-size:13px}.grid{display:grid;grid-template-columns:1fr 320px;gap:20px;margin-top:22px}
.card{background:var(--card);border-radius:var(--radius);padding:18px;box-shadow:0 6px 18px rgba(2,6,23,0.6)}

nav.card{padding:12px}
nav ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px}
nav a{display:inline-block;padding:8px 12px;border-radius:10px;background:var(--glass-2);color:var(--muted);text-decoration:none;font-size:13px}
nav a.active{background:linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04));color:var(--accent);border:1px solid rgba(245,158,11,0.12)}

.features{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.feature{background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent);padding:12px;border-radius:12px}
.feature h3{margin:0 0 6px 0;font-size:14px}
.feature p{margin:0;color:var(--muted);font-size:13px}

h2.section{margin-top:20px}
pre{background:#071427;padding:14px;border-radius:10px;overflow:auto;color:#cbd5e1}
code.inline{background:rgba(255,255,255,0.03);padding:2px 6px;border-radius:6px}

.install ol{margin:0;padding-left:18px;color:var(--muted)}
.settings dl{display:grid;grid-template-columns:220px 1fr;gap:8px;align-items:start}
.badge{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,0.03);font-size:12px;color:var(--muted)}

.toc{font-size:13px;color:var(--muted);line-height:1.6}
.support a{color:var(--accent);text-decoration:none}

footer{margin-top:20px;font-size:12px;color:var(--muted);text-align:center}

/* metadata & responsive */
@media (max-width:920px){.grid{grid-template-columns:1fr} .features{grid-template-columns:1fr}}

  </style>
</head>
<body>
  <main class="container">
    <header>
      <img class="logo" src="Baklava.png" alt="Baklava logo"/>
      <div>
        <h1>Baklava<span class="badge">Jellyfin Plugin</span></h1>
        <p class="lead">Media request management, intelligent search toggle (local / global), and Gelato integration for Jellyfin.</p>
      </div>
    </header><nav class="card" aria-label="Table of contents">
  <ul class="toc">
    <li><a class="active" href="#features">Features</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#configuration">Configuration</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#troubleshooting">Troubleshooting</a></li>
    <li><a href="#support">Support</a></li>
  </ul>
</nav>

<section class="grid">
  <div>
    <article id="features" class="card">
      <h2 class="section">✨ Features</h2>
      <div class="features">
        <div class="feature">
          <h3>🎬 Media Request System</h3>
          <p>Users can request movies and TV series. Admins can approve/deny with an intuitive workflow and track requests (pending / approved) with responsive UI cards.</p>
        </div>
        <div class="feature">
          <h3>🔍 Enhanced Search</h3>
          <p>Toggle between local (Jellyfin) and global (Gelato/external) search. Visual globe icon shows mode; TV clients can be forced to local search for a consistent experience.</p>
        </div>
        <div class="feature">
          <h3>🎯 Server-Side Processing</h3>
          <p>SearchActionFilter intercepts and routes requests, manages prefixes like <code class="inline">local:</code>, and hands off to Gelato when needed. Configurable via plugin settings.</p>
        </div>
        <div class="feature">
          <h3>⚙️ Configurable</h3>
          <p>Enable/disable search filter and enforce client-specific rules. TMDB support for metadata lookups.</p>
        </div>
      </div>
    </article>

    <article id="installation" class="card install">
      <h2 class="section">📦 Installation</h2>
      <h4>Via Jellyfin Plugin Repository (Recommended)</h4>
      <ol>
        <li>Open Jellyfin Dashboard.</li>
        <li>Navigate to <strong>Plugins &rarr; Repositories</strong>.</li>
        <li>Add repository URL: <code class="inline">https://raw.githubusercontent.com/j4ckgrey/Baklava/main/manifest.json</code>.</li>
        <li>Go to Catalog and install <strong>Baklava</strong>.</li>
        <li>Restart Jellyfin.</li>
      </ol>

      <h4 style="margin-top:12px">⚠️ Prerequisites</h4>
      <p class="muted">Make sure the following are installed and configured:</p>
      <ul>
        <li><strong>Gelato</strong> — external search provider used by Baklava for global discovery.</li>
        <li><strong>File Transformation</strong> — required for certain media handling and transformations.</li>
      </ul>
    </article>

    <article id="configuration" class="card settings">
      <h2 class="section">⚙️ Configuration</h2>
      <p>Open <strong>Dashboard &rarr; Plugins &rarr; Baklava</strong> to configure plugin settings.</p>
      <dl>
        <dt>Search Filter Settings</dt>
        <dd>
          <ul>
            <li><code class="inline">Enable Search Filter</code>: Toggle server-side prefix handling.</li>
            <li><code class="inline">Force TV Client Local Search</code>: Enforce local-only search for TV clients (Android TV, Fire TV, etc.).</li>
          </ul>
        </dd>

        <dt>TMDB Integration</dt>
        <dd>
          <ul>
            <li><code class="inline">TMDB API Key</code>: For metadata lookups and poster images.</li>
            <li><code class="inline">Default TMDB ID</code>: Default ID used on the config page for testing.</li>
          </ul>
        </dd>
      </dl>
    </article>

    <article id="usage" class="card">
      <h2 class="section">🚀 Usage</h2>

      <h3>Search Toggle</h3>
      <p>The toggle is a globe icon next to the search bar:</p>
      <ul>
        <li><strong>Globe (no slash)</strong>: Global search mode via Gelato/external sources.</li>
        <li><strong>Globe with slash</strong>: Local search mode — Jellyfin library only.</li>
      </ul>

      <p><strong>How to use:</strong></p>
      <ol>
        <li>Type your search query.</li>
        <li>Click the globe icon to toggle local/global.</li>
        <li>Results refresh automatically.</li>
      </ol>

      <h3>Media Requests</h3>
      <h4>For Users</h4>
      <ol>
        <li>Browse or search for media.</li>
        <li>Click "Request" on items not in your library.</li>
        <li>Track requests in the Requests dropdown and receive notifications when approved.</li>
      </ol>

      <h4>For Admins</h4>
      <ol>
        <li>Open the Requests dropdown (bell icon).</li>
        <li>View pending requests (organized by Movies/Series).</li>
        <li>Approve or Deny with one click; approved items move to the "Approved" section.</li>
      </ol>

      <h3>TV Client Behavior</h3>
      <p>When <code class="inline">Force TV Client Local Search</code> is enabled (default: ON):</p>
      <ul>
        <li>Android TV, Fire TV and other TV clients automatically use local search.</li>
        <li>The <code class="inline">local:</code> prefix is added server-side.</li>
        <li>Enforcement is transparent to end users.</li>
      </ul>
    </article>

    <article id="troubleshooting" class="card">
      <h2 class="section">🛠️ Troubleshooting</h2>
      <h4>Search toggle not appearing</h4>
      <ul>
        <li>Clear browser cache.</li>
        <li>Check browser console for JavaScript errors.</li>
        <li>Verify plugin is loaded: <strong>Dashboard &rarr; Plugins</strong>.</li>
      </ul>

      <h4>TV client not using local search</h4>
      <ul>
        <li>Enable "Force TV Client Local Search" in settings.</li>
        <li>Check server logs for "✓ Detected TV client" messages.</li>
        <li>Verify filter order (Baklava should be order 0).</li>
      </ul>

      <h4>Requests not saving</h4>
      <ul>
        <li>Check file permissions on plugin data directory.</li>
        <li>Verify TMDB API key is valid.</li>
        <li>Check server logs for errors.</li>
      </ul>
    </article>

    <article id="support" class="card support">
      <h2 class="section">📧 Support</h2>
      <p>Issues &amp; Discussions:</p>
      <ul>
        <li><a href="https://github.com/j4ckgrey/Baklava/issues" target="_blank" rel="noopener">Report issues</a></li>
        <li><a href="https://github.com/j4ckgrey/Baklava/discussions" target="_blank" rel="noopener">Join discussions</a></li>
      </ul>
    </article>

  </div>

  <aside>
    <div class="card">
      <h3>Quick Summary</h3>
      <p class="muted">Baklava adds:</p>
      <ul>
        <li>Request system for users & admins</li>
        <li>Local / Global search toggle (server-side filter)</li>
        <li>Gelato + TMDB integration for metadata & discovery</li>
      </ul>
    </div>

    <div class="card">
      <h3>Plugin Settings</h3>
      <p class="muted">Accessible in the Jellyfin Dashboard.</p>
      <dl>
        <dt>Enable Search Filter</dt>
        <dd>On / Off</dd>
        <dt>Force TV Client Local Search</dt>
        <dd>Default: <strong>On</strong></dd>
        <dt>TMDB API Key</dt>
        <dd>Enter your key for posters & metadata</dd>
      </dl>
    </div>

    <div class="card">
      <h3>Visuals</h3>
      <p class="muted">Search toggle icon examples:</p>
      <p style="font-size:36px;margin:6px 0">🌐 &nbsp; 🚫🌐</p>
      <p style="font-size:12px;color:var(--muted)">Globe = global search • Globe with slash = local search</p>
    </div>

  </aside>
</section>

<footer>
  <p>License and acknowledgements in the project repository. Built for Jellyfin — enjoy the extras.</p>
</footer>

  </main>
</body>
</html>