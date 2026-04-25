const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument, degrees } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://pdftothermal.com';
const SUPPORT_EMAIL = 'support@pdftothermal.com';
const GA_ID = 'G-XCBKTHSF8B';

app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function cleanupOldFiles(dir, maxAgeMs = 1000 * 60 * 60) {
  try {
    const now = Date.now();
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error('Cleanup sweep error:', err.message);
  }
}

cleanupOldFiles(uploadsDir);
cleanupOldFiles(downloadsDir);

const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG.'));
    }

    cb(null, true);
  }
});

app.use('/downloads', express.static(downloadsDir));
app.use('/uploads', express.static(uploadsDir));

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bytesToReadable(bytes = 0) {
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function pageTemplate({
  title = 'PDF to Thermal',
  description = 'Convert shipping labels to 4x6 thermal format.',
  canonicalPath = '/',
  content = '',
  extraHead = '',
  bottomScript = ''
}) {
  const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '' : canonicalPath}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta name="robots" content="index,follow" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="PDF to Thermal" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}');
    </script>

    ${extraHead}

    <style>
      :root {
        --bg: #0b1020;
        --panel: rgba(255,255,255,0.92);
        --panel-soft: rgba(255,255,255,0.78);
        --text: #0f172a;
        --text-soft: #475569;
        --line: rgba(148,163,184,0.25);
        --line-strong: rgba(99,102,241,0.20);
        --primary: #2563eb;
        --accent: #7c3aed;
        --primary-soft: #dbeafe;
        --accent-soft: #ede9fe;
        --success: #166534;
        --error: #b91c1c;
        --warning: #92400e;
        --warning-bg: #fff7ed;
        --shadow-lg: 0 24px 70px rgba(2, 6, 23, 0.18);
        --shadow-md: 0 12px 34px rgba(15, 23, 42, 0.10);
        --radius-xl: 24px;
        --radius-lg: 18px;
        --radius-md: 14px;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }

      body {
        margin: 0;
        font-family: Inter, Arial, Helvetica, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 10% 10%, rgba(37,99,235,0.28) 0%, transparent 24%),
          radial-gradient(circle at 90% 10%, rgba(124,58,237,0.22) 0%, transparent 22%),
          radial-gradient(circle at 50% 100%, rgba(59,130,246,0.12) 0%, transparent 30%),
          linear-gradient(180deg, #eef4ff 0%, #f8fbff 42%, #f4f7fb 100%);
        min-height: 100vh;
      }

      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }

      .shell { position: relative; overflow: hidden; }
      .shell::before {
        content: "";
        position: fixed;
        inset: 0;
        background:
          radial-gradient(circle at 20% 0%, rgba(37,99,235,0.07), transparent 24%),
          radial-gradient(circle at 80% 0%, rgba(124,58,237,0.07), transparent 24%);
        pointer-events: none;
      }

      .container {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        position: relative;
        z-index: 1;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 22px 0 12px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-weight: 800;
        color: var(--text);
      }

      .brand:hover { text-decoration: none; }

      .brand-badge {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 800;
        box-shadow: var(--shadow-md);
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        line-height: 1.05;
      }

      .brand-text span:first-child { font-size: 16px; }
      .brand-text span:last-child {
        font-size: 11px;
        color: var(--text-soft);
        font-weight: 700;
        margin-top: 2px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .nav-links {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        background: rgba(255,255,255,0.72);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.7);
        padding: 10px 14px;
        border-radius: 999px;
        box-shadow: var(--shadow-md);
      }

      .nav-links a {
        color: var(--text-soft);
        font-weight: 700;
        font-size: 14px;
      }

      .hero {
        padding: 26px 0 20px;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 24px;
        align-items: stretch;
      }

      .hero-card, .card {
        background: var(--panel);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255,255,255,0.85);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
      }

      .hero-copy {
        padding: 36px;
        position: relative;
        overflow: hidden;
      }

      .hero-copy::after {
        content: "";
        position: absolute;
        right: -40px;
        top: -40px;
        width: 180px;
        height: 180px;
        background: radial-gradient(circle, rgba(37,99,235,0.12), transparent 65%);
        pointer-events: none;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft));
        color: var(--primary);
        border: 1px solid rgba(99,102,241,0.16);
        padding: 9px 13px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 800;
        margin-bottom: 18px;
        box-shadow: 0 8px 20px rgba(59,130,246,0.12);
      }

      h1 {
        margin: 0 0 14px;
        font-size: clamp(40px, 5vw, 62px);
        line-height: 0.98;
        letter-spacing: -0.04em;
      }

      h2, h3 {
        letter-spacing: -0.03em;
      }

      .lead {
        margin: 0 0 22px;
        color: var(--text-soft);
        font-size: 18px;
        line-height: 1.65;
        max-width: 720px;
      }

      .hero-points {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 22px 0;
      }

      .hero-point {
        background: rgba(248,250,252,0.95);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 15px;
      }

      .hero-point strong {
        display: block;
        margin-bottom: 4px;
        font-size: 15px;
      }

      .hero-point span {
        color: var(--text-soft);
        font-size: 14px;
        line-height: 1.5;
      }

      .trust-line {
        color: var(--text-soft);
        font-size: 14px;
        line-height: 1.6;
      }

      .upload-card { padding: 24px; }
      .upload-card h2 { margin: 0 0 10px; font-size: 27px; }
      .upload-card p { margin: 0 0 18px; color: var(--text-soft); line-height: 1.6; }

      .upload-box {
        border: 2px dashed rgba(37,99,235,0.28);
        background: linear-gradient(180deg, rgba(248,251,255,0.95) 0%, rgba(255,255,255,0.9) 100%);
        border-radius: 18px;
        padding: 22px;
      }

      .dropzone {
        position: relative;
        border: 1px dashed rgba(99,102,241,0.25);
        border-radius: 16px;
        padding: 18px;
        background: rgba(255,255,255,0.95);
        transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
      }

      .dropzone.dragover {
        border-color: var(--primary);
        background: rgba(219,234,254,0.55);
        transform: translateY(-1px);
      }

      .upload-box label.main-label {
        display: block;
        font-weight: 800;
        margin-bottom: 10px;
      }

      input[type="file"] {
        width: 100%;
        padding: 13px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: white;
        margin-bottom: 14px;
      }

      button, .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 14px;
        border: 0;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        color: white;
        font-weight: 800;
        cursor: pointer;
        text-decoration: none;
        box-shadow: 0 14px 28px rgba(59,130,246,0.20);
      }

      button:hover, .btn:hover {
        text-decoration: none;
        transform: translateY(-1px);
      }

      .btn.secondary {
        background: white;
        color: var(--primary);
        border: 1px solid rgba(99,102,241,0.18);
        box-shadow: var(--shadow-md);
      }

      .btn.ghost {
        background: rgba(255,255,255,0.55);
        color: var(--text);
        border: 1px solid var(--line);
        box-shadow: none;
      }

      .microcopy {
        margin-top: 12px;
        color: var(--text-soft);
        font-size: 13px;
        line-height: 1.5;
      }

      .mode-box {
        margin: 14px 0 16px;
        padding: 14px;
        background: white;
        border: 1px solid var(--line);
        border-radius: 14px;
      }

      .mode-box-title {
        display: block;
        font-weight: 800;
        margin-bottom: 10px;
      }

      .mode-option {
        display: block;
        margin-bottom: 10px;
        color: var(--text);
        font-size: 14px;
      }

      .mode-option:last-child { margin-bottom: 0; }

      .mode-option small {
        display: block;
        color: var(--text-soft);
        margin-left: 24px;
        margin-top: 3px;
        line-height: 1.45;
      }

      .selected-file {
        display: none;
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(219,234,254,0.55);
        border: 1px solid rgba(99,102,241,0.14);
        color: var(--text);
        font-size: 14px;
        font-weight: 700;
      }

      .selected-file small {
        display: block;
        color: var(--text-soft);
        font-weight: 600;
        margin-top: 4px;
      }

      .section { padding: 20px 0; }
      .section-title { margin: 0 0 16px; font-size: 31px; }
      .section-subtitle {
        margin: 0 0 24px;
        color: var(--text-soft);
        line-height: 1.65;
        max-width: 760px;
      }

      .cards-3, .cards-2, .use-grid, .landing-section-grid, .result-grid, .article-grid {
        display: grid;
        gap: 18px;
      }

      .cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .cards-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .use-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .landing-section-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 14px; }
      .result-grid { grid-template-columns: 360px 1fr; margin-top: 24px; }
      .article-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

      .step-card, .info-card, .mini-card, .preview-card, .result-summary, .article-card {
        background: rgba(255,255,255,0.95);
        border: 1px solid rgba(255,255,255,0.85);
        border-radius: 18px;
        padding: 22px;
        box-shadow: var(--shadow-md);
      }

      .article-card h3, .article-card p { margin: 0; }
      .article-card h3 { font-size: 20px; margin-bottom: 8px; }
      .article-card p { color: var(--text-soft); line-height: 1.65; }
      .article-card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .article-layout {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 20px;
      }

      .article-sidebar {
        position: sticky;
        top: 20px;
        align-self: start;
      }

      .article-content {
        display: grid;
        gap: 18px;
      }

      .article-section {
        background: rgba(255,255,255,0.95);
        border: 1px solid rgba(255,255,255,0.85);
        border-radius: 18px;
        padding: 22px;
        box-shadow: var(--shadow-md);
      }

      .article-section h2 {
        margin: 0 0 10px;
        font-size: 26px;
      }

      .article-section p {
        margin: 0 0 12px;
        color: var(--text-soft);
        line-height: 1.72;
      }

      .article-section p:last-child {
        margin-bottom: 0;
      }

      .step-number {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft));
        color: var(--primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .step-card h3, .info-card h3, .mini-card h3, .preview-card h3, .result-summary h3, .faq-item h3 {
        margin: 0 0 8px;
        font-size: 19px;
      }

      .step-card p, .info-card p, .mini-card p, .faq-item p, .legal p, .contact-list p, .landing-copy p, .preview-card p, .result-summary p, .result-card p {
        margin: 0;
        color: var(--text-soft);
        line-height: 1.65;
      }

      .use-item, .faq-item {
        background: rgba(255,255,255,0.94);
        border: 1px solid rgba(255,255,255,0.82);
        border-radius: 16px;
        padding: 16px;
        box-shadow: var(--shadow-md);
      }

      .use-item { font-weight: 800; }

      .warning-box {
        margin-top: 18px;
        padding: 14px;
        border: 1px solid #fed7aa;
        background: var(--warning-bg);
        border-radius: 14px;
        color: var(--warning);
        line-height: 1.6;
        font-size: 14px;
      }

      .cta {
        margin: 20px 0 34px;
        background: radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #4f46e5 100%);
        color: white;
        border-radius: 24px;
        padding: 32px;
        box-shadow: var(--shadow-lg);
      }

      .cta h2 { margin: 0 0 10px; font-size: 31px; }
      .cta p {
        margin: 0 0 18px;
        color: rgba(255,255,255,0.84);
        line-height: 1.7;
        max-width: 760px;
      }

      .cta .btn {
        background: white;
        color: var(--primary);
        box-shadow: none;
      }

      .faq-grid, .legal, .contact-list, .landing-copy, .meta-list, .result-meta, .preview-shell, .tips-list {
        display: grid;
        gap: 16px;
      }

      .footer {
        padding: 26px 0 48px;
        color: var(--text-soft);
        font-size: 14px;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 12px;
      }

      .result-card {
        max-width: 1180px;
        margin: 44px auto;
        padding: 30px;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 800;
        margin-bottom: 16px;
      }

      .status.success {
        background: #ecfdf3;
        color: var(--success);
        border: 1px solid #bbf7d0;
      }

      .status.error {
        background: #fef2f2;
        color: var(--error);
        border: 1px solid #fecaca;
      }

      .result-card h1, .landing-copy h1 {
        font-size: 38px;
        margin-bottom: 12px;
      }

      .button-row, .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .button-row { margin-top: 22px; }
      .badge-row { gap: 10px; }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(248,250,252,0.95);
        border: 1px solid var(--line);
        font-size: 13px;
        font-weight: 800;
        color: var(--text);
      }

      .meta-row {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
        padding: 10px 0;
        border-bottom: 1px dashed rgba(148,163,184,0.24);
      }

      .meta-row:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }

      .meta-key {
        font-size: 13px;
        color: var(--text-soft);
        font-weight: 700;
      }

      .meta-value {
        font-size: 14px;
        font-weight: 800;
        color: var(--text);
        text-align: right;
        word-break: break-word;
      }

      .preview-frame {
        width: 100%;
        height: 760px;
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 16px;
        background: #f8fafc;
      }

      .preview-tip {
        margin-top: 12px;
        font-size: 13px;
        color: var(--text-soft);
      }

      .not-found {
        max-width: 760px;
        margin: 50px auto;
        padding: 30px;
      }

      @media (max-width: 980px) {
        .hero-grid, .cards-3, .cards-2, .use-grid, .landing-section-grid, .result-grid, .article-grid, .article-layout {
          grid-template-columns: 1fr;
        }

        .hero-copy, .upload-card {
          padding: 24px;
        }

        .hero-points { grid-template-columns: 1fr; }

        .nav {
          flex-direction: column;
          align-items: flex-start;
        }

        .nav-links { border-radius: 18px; }
        .preview-frame { height: 560px; }
        .article-sidebar { position: static; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="container">
        <header class="nav">
          <a class="brand" href="/">
            <span class="brand-badge">PT</span>
            <span class="brand-text">
              <span>PDF to Thermal</span>
              <span>4x6 label converter</span>
            </span>
          </a>
          <nav class="nav-links">
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/articles">Articles</a>
            <a href="/faq">FAQ</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </nav>
        </header>

        ${content}

        <footer class="footer">
          <div>PDF to Thermal helps turn shipping labels into 4x6 thermal-printer-ready files.</div>
          <div class="footer-links">
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/articles">Articles</a>
            <a href="/faq">FAQ</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
            <a href="/usps-label-to-4x6">USPS</a>
            <a href="/ups-label-to-4x6">UPS</a>
            <a href="/fedex-label-to-4x6">FedEx</a>
            <a href="/amazon-return-label-to-4x6">Amazon Returns</a>
            <a href="/ebay-label-to-4x6">eBay</a>
            <a href="/etsy-label-to-4x6">Etsy</a>
            <a href="/pdf-to-4x6-label">PDF to 4x6</a>
            <a href="/shipping-label-to-4x6">Shipping Label to 4x6</a>
            <a href="/thermal-label-converter">Thermal Label Converter</a>
          </div>
        </footer>
      </div>
    </div>
    ${bottomScript}
  </body>
  </html>
  `;
}

function renderLandingPage({ pathName, title, description, heading, intro, bullets = [], tips = [], note = '' }) {
  return pageTemplate({
    title,
    description,
    canonicalPath: pathName,
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <div class="landing-copy">
            <h1>${escapeHtml(heading)}</h1>
            <p>${escapeHtml(intro)}</p>

            <div class="badge-row">
              <span class="badge">4x6 output</span>
              <span class="badge">PDF + image support</span>
              <span class="badge">Fit / Fill / Rotate</span>
              <span class="badge">Multi-page PDF support</span>
              <span class="badge">Preview before download</span>
            </div>

            <div class="landing-section-grid">
              <div class="mini-card">
                <h3>When this helps</h3>
                ${bullets.map((b) => `<p>• ${escapeHtml(b)}</p>`).join('')}
              </div>
              <div class="mini-card">
                <h3>Quick tips</h3>
                ${tips.map((t) => `<p>• ${escapeHtml(t)}</p>`).join('')}
              </div>
            </div>

            ${note ? `<div class="warning-box">${escapeHtml(note)}</div>` : ''}

            <div class="button-row">
              <a class="btn" href="/">Try the converter</a>
            </div>
          </div>
        </div>
      </section>
    `
  });
}

function renderSimplePage({ pathName, title, description, heading, bodyHtml }) {
  return pageTemplate({
    title,
    description,
    canonicalPath: pathName,
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <div class="landing-copy">
            <h1>${escapeHtml(heading)}</h1>
            ${bodyHtml}
          </div>
        </div>
      </section>
    `
  });
}

const articles = [
  {
    slug: 'best-thermal-printer-for-ebay-sellers',
    title: 'Best Thermal Printer for eBay Sellers',
    description: 'What eBay sellers should look for in a thermal printer and how to avoid common label-printing headaches.',
    readTime: '6 min read',
    category: 'Buyer Guide',
    intro: 'eBay sellers usually care about three things: reliable barcode printing, fast repeat workflows, and low operating cost. A thermal printer is often the easiest way to get all three, but the best fit depends on volume, desk space, and how often you print returns and shipping labels.',
    sections: [
      {
        heading: 'What matters most',
        paragraphs: [
          'For most eBay sellers, print consistency matters more than fancy features. If a label prints the same way every time and works with 4x6 labels without constant adjustment, that is a better fit than a printer with extra bells and whistles.',
          'Look for support for standard 4x6 labels, a solid reputation for driver stability, and easy loading. If you ship every day, small annoyances become expensive fast.'
        ]
      },
      {
        heading: 'What to avoid',
        paragraphs: [
          'Avoid buying only on price. The cheapest printer can become the most expensive if it wastes labels, jams often, or needs constant reconfiguration.',
          'You should also avoid workflows that force you to print to letter paper and trim by hand. That usually disappears once you move to a true thermal setup and a 4x6-first process.'
        ]
      },
      {
        heading: 'How PDF to Thermal helps',
        paragraphs: [
          'Even with a good printer, some marketplace labels arrive in awkward formats. PDF to Thermal helps bridge that gap by converting PDF and image labels into a cleaner 4x6 output.',
          'That matters most when a label looks too small, too large, sideways, or buried inside a full-page PDF.'
        ]
      }
    ]
  },
  {
    slug: 'best-thermal-printer-for-etsy-sellers',
    title: 'Best Thermal Printer for Etsy Sellers',
    description: 'A practical guide to choosing a thermal printer for Etsy shipping and home-business workflows.',
    readTime: '6 min read',
    category: 'Buyer Guide',
    intro: 'Etsy sellers often need a setup that feels simple, tidy, and dependable. The best thermal printer is usually the one that removes friction from packing and shipping instead of adding technical work.',
    sections: [
      {
        heading: 'Home-business priorities',
        paragraphs: [
          'For many Etsy shops, noise, size, and simplicity matter a lot. A compact printer that handles 4x6 labels well can save time and keep the shipping area clean.',
          'If you print in bursts rather than all day long, ease of use may matter more than enterprise-level speed.'
        ]
      },
      {
        heading: 'Why 4x6 matters',
        paragraphs: [
          'A 4x6 format is the most common thermal label size for shipping. Building your workflow around it reduces guesswork and minimizes wasted labels.',
          'That is why a 4x6 conversion tool can be useful even before you buy a printer. It lets you see whether your source labels are already friendly to thermal printing.'
        ]
      },
      {
        heading: 'A cleaner workflow',
        paragraphs: [
          'The less time you spend resizing labels manually, the more time you have for products, packing, and customer service. Good printer choice and clean label conversion work together.',
          'If you sell from home, simplicity usually wins over complexity every time.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-print-amazon-return-labels-on-4x6',
    title: 'How to Print Amazon Return Labels on 4x6',
    description: 'How to handle Amazon return labels that do not arrive in a clean 4x6 format.',
    readTime: '5 min read',
    category: 'How-To',
    intro: 'Amazon return labels are not always ready to print directly on a thermal label printer. Sometimes they come as full-page PDFs, odd layouts, or labels with extra white space that do not line up well on 4x6 stock.',
    sections: [
      {
        heading: 'Why Amazon labels can be awkward',
        paragraphs: [
          'Return labels may arrive as full-page documents instead of tight 4x6 files. That can create scaling issues, big margins, or sideways output on a thermal printer.',
          'The problem is usually not the printer. It is the layout of the source file.'
        ]
      },
      {
        heading: 'The practical fix',
        paragraphs: [
          'The simplest fix is to convert the return label into a 4x6 PDF before printing. That gives you a file that matches the physical label stock better.',
          'Start with Fit mode if you want to preserve the full label. If the result feels too small, try Fill mode and preview it carefully before printing.'
        ]
      },
      {
        heading: 'What to check before using it',
        paragraphs: [
          'Always preview the barcode area, text clarity, and orientation. One test label is cheaper than redoing a shipment later.',
          'If the source return file has multiple pages, confirm you are printing the correct page in the final output.'
        ]
      }
    ]
  },
  {
    slug: 'rollo-vs-munbyn',
    title: 'Rollo vs Munbyn for Shipping Labels',
    description: 'A simple comparison of two popular thermal-printer brands for 4x6 label printing.',
    readTime: '7 min read',
    category: 'Comparison',
    intro: 'Rollo and Munbyn are two names that come up often when people shop for thermal printers. The right choice usually depends less on hype and more on how cleanly the printer fits your real shipping workflow.',
    sections: [
      {
        heading: 'What to compare first',
        paragraphs: [
          'Compare setup experience, software simplicity, label compatibility, and how often users report frustrating alignment issues. Those quality-of-life details matter more than marketing language.',
          'If your workflow is simple, either printer can be perfectly adequate if it handles 4x6 labels consistently.'
        ]
      },
      {
        heading: 'What matters after purchase',
        paragraphs: [
          'The purchase is only the beginning. Reliability, reloading speed, and how easy it is to recover from a bad print matter long after unboxing.',
          'If your label files are inconsistent, a conversion tool may affect your experience as much as the printer itself.'
        ]
      },
      {
        heading: 'Where software still matters',
        paragraphs: [
          'Even a solid printer can feel frustrating when label source files are badly sized. That is why a good workflow often combines a capable printer with a fast 4x6 conversion process.',
          'Cleaner input files usually lead to cleaner results and fewer troubleshooting cycles.'
        ]
      }
    ]
  },
  {
    slug: 'pdf-shipping-label-wont-print-on-thermal-printer',
    title: 'PDF Shipping Label Won’t Print on a Thermal Printer',
    description: 'The most common reasons a PDF label prints badly on a thermal printer and how to fix it.',
    readTime: '5 min read',
    category: 'Troubleshooting',
    intro: 'If a PDF shipping label will not print correctly on a thermal printer, the issue is usually file layout, page size mismatch, orientation, or scaling. Most of the time, the label itself needs cleanup before the printer becomes easy to use.',
    sections: [
      {
        heading: 'The most common causes',
        paragraphs: [
          'Many shipping labels are designed for letter-size paper or have unnecessary margins. That leads to tiny output, clipped barcodes, or sideways printing.',
          'Another common issue is printing software that tries to “help” by scaling or rotating the page in a way that does not match the label stock.'
        ]
      },
      {
        heading: 'How to isolate the problem',
        paragraphs: [
          'First, check whether the source PDF looks clean. Then check whether the printer is truly configured for 4x6 stock. If both are inconsistent, fix the file first.',
          'A converted 4x6 PDF is often the quickest way to determine whether the problem is the file or the printer settings.'
        ]
      },
      {
        heading: 'A better workflow',
        paragraphs: [
          'The easiest long-term fix is to normalize labels before printing them. That creates consistency, which reduces trial and error.',
          'In practice, that usually means using a dedicated 4x6 conversion step before hitting print.'
        ]
      }
    ]
  },
  {
    slug: 'best-4x6-thermal-labels-for-shipping',
    title: 'Best 4x6 Thermal Labels for Shipping',
    description: 'What to look for when buying 4x6 thermal labels for shipping workflows.',
    readTime: '5 min read',
    category: 'Buyer Guide',
    intro: 'The best 4x6 thermal labels are the ones that feed cleanly, stick reliably, and do not cause wasted time or reprints.',
    sections: [
      {
        heading: 'Consistency matters',
        paragraphs: [
          'Cheap labels can work, but inconsistent adhesive, poor winding, or uneven material can make a good printer feel broken.',
          'If you ship regularly, quality labels save time more than they save money.'
        ]
      },
      {
        heading: 'Think about your workflow',
        paragraphs: [
          'Some setups work better with fanfold labels, while others are easier with rolls. Match the label style to your desk space and printer compatibility.',
          'If your label files still arrive in awkward dimensions, a 4x6 conversion tool keeps the physical labels from being blamed for digital layout problems.'
        ]
      }
    ]
  },
  {
    slug: 'best-shipping-scale-for-small-business',
    title: 'Best Shipping Scale for a Small Business',
    description: 'Why a simple shipping scale matters in a small e-commerce workflow.',
    readTime: '4 min read',
    category: 'Buyer Guide',
    intro: 'A shipping scale does not need to be fancy to be valuable. It just needs to be accurate, easy to read, and reliable enough to keep your label purchasing and postage decisions clean.',
    sections: [
      {
        heading: 'Why the scale matters',
        paragraphs: [
          'Bad weight data can create postage problems, customer service issues, and awkward overcharges or undercharges.',
          'For most small sellers, a clean scale-plus-thermal-printer workflow is one of the simplest upgrades you can make.'
        ]
      },
      {
        heading: 'Pairing tools together',
        paragraphs: [
          'The real efficiency comes when your scale, shipping software, and label printing process all work without manual correction.',
          'That is why fixing label format issues matters just as much as choosing good hardware.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-print-usps-labels-on-4x6',
    title: 'How to Print USPS Labels on 4x6',
    description: 'A practical workflow for getting USPS labels onto a 4x6 thermal label.',
    readTime: '5 min read',
    category: 'How-To',
    intro: 'USPS labels often work well on 4x6, but not every source file is equally clean. The key is making sure the digital file matches the physical label format.',
    sections: [
      {
        heading: 'Start with the file',
        paragraphs: [
          'If the label is already 4x6, your job is easy. If it arrives inside a larger PDF, resize it first.',
          'Trying to brute-force the print dialog usually wastes more time than converting the label once properly.'
        ]
      },
      {
        heading: 'Why preview helps',
        paragraphs: [
          'A quick preview step can save labels and avoid unreadable barcodes. That is especially useful when the source file looks unusually padded or rotated.',
          'Test one label when something feels off instead of assuming the whole batch will work.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-print-ups-labels-on-4x6',
    title: 'How to Print UPS Labels on 4x6',
    description: 'How to handle UPS labels that need a better 4x6 printing workflow.',
    readTime: '5 min read',
    category: 'How-To',
    intro: 'UPS labels can be easy or annoying depending on the source format. The best workflow is the one that removes guesswork before you hit print.',
    sections: [
      {
        heading: 'Match the page to the stock',
        paragraphs: [
          'Thermal printers work best when the output file already matches the label size. That is why a 4x6-first file is easier than relying on print scaling.',
          'UPS labels that start in a broader PDF layout often benefit from conversion before printing.'
        ]
      },
      {
        heading: 'Keep it repeatable',
        paragraphs: [
          'A repeatable process matters more than one lucky successful print. Once you find the right mode, use the same approach consistently.',
          'That is what keeps day-to-day shipping from turning into constant troubleshooting.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-print-fedex-labels-on-4x6',
    title: 'How to Print FedEx Labels on 4x6',
    description: 'How to get FedEx shipping labels printing cleanly on 4x6 stock.',
    readTime: '5 min read',
    category: 'How-To',
    intro: 'FedEx labels are usually straightforward once the page size and file layout are under control. The most common issues are scale, margins, and orientation.',
    sections: [
      {
        heading: 'Use the preview step',
        paragraphs: [
          'Previewing the final file is one of the easiest ways to spot a label that is too small or rotated oddly.',
          'It is especially helpful for labels that arrive from outside platforms or third-party systems.'
        ]
      },
      {
        heading: 'Do not blame the printer first',
        paragraphs: [
          'The printer is often fine. A label file that does not match 4x6 is usually the real source of the problem.',
          'Fix the file first, then evaluate the print result.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-convert-pdf-label-to-4x6',
    title: 'How to Convert a PDF Label to 4x6',
    description: 'Why converting a PDF label to 4x6 often solves thermal-printing problems.',
    readTime: '4 min read',
    category: 'How-To',
    intro: 'Converting a PDF label to 4x6 is usually about reducing friction. The closer your file matches your physical label stock, the easier everything else becomes.',
    sections: [
      {
        heading: 'Why conversion helps',
        paragraphs: [
          'When a shipping label is wrapped in a larger document size, printing it directly can cause scaling errors and wasted labels.',
          'Converting it first gives you more control and a more repeatable result.'
        ]
      },
      {
        heading: 'Which mode to use',
        paragraphs: [
          'Fit mode is best when you want the full label preserved. Fill mode is better when the label feels too small. Auto Rotate is useful for wide inputs.',
          'The right answer depends on whether visibility or page coverage matters more for that specific file.'
        ]
      }
    ]
  },
  {
    slug: 'thermal-printer-vs-inkjet-for-shipping-labels',
    title: 'Thermal Printer vs Inkjet for Shipping Labels',
    description: 'A simple comparison of thermal and inkjet printing for shipping labels.',
    readTime: '5 min read',
    category: 'Comparison',
    intro: 'Inkjet printers can work for shipping labels, but thermal printers are usually faster and simpler once your workflow is set up correctly.',
    sections: [
      {
        heading: 'Why thermal often wins',
        paragraphs: [
          'Thermal printing removes paper cutting, toner or ink concerns, and a lot of sizing confusion once you are working directly in 4x6.',
          'That makes it particularly attractive for repeat shipping workflows.'
        ]
      },
      {
        heading: 'Where inkjet still fits',
        paragraphs: [
          'If you rarely ship, already own an inkjet printer, and do not mind printing on paper, inkjet can be adequate.',
          'The more often you ship, the more likely thermal becomes worth it.'
        ]
      }
    ]
  },
  {
    slug: 'common-thermal-label-printing-mistakes',
    title: 'Common Thermal Label Printing Mistakes',
    description: 'The most common mistakes people make when printing thermal shipping labels.',
    readTime: '5 min read',
    category: 'Troubleshooting',
    intro: 'Most thermal label problems come from a few recurring mistakes: wrong page size, bad scaling, skipped preview checks, and confusing the source file with the printer itself.',
    sections: [
      {
        heading: 'Mistake one: forcing the print dialog',
        paragraphs: [
          'Many people try to solve a layout problem only from the printer settings. That can work sometimes, but it is usually the least stable fix.',
          'A better strategy is to normalize the label first.'
        ]
      },
      {
        heading: 'Mistake two: never testing one label',
        paragraphs: [
          'One test label is much cheaper than reprinting a stack. Previewing and testing once usually saves time overall.',
          'This matters even more when you switch carriers or marketplaces.'
        ]
      }
    ]
  },
  {
    slug: 'why-your-label-prints-too-small',
    title: 'Why Your Label Prints Too Small',
    description: 'Why a shipping label can look tiny on a 4x6 label and what to do about it.',
    readTime: '4 min read',
    category: 'Troubleshooting',
    intro: 'A label usually prints too small because the source page includes large margins or is scaled to fit inside 4x6 instead of being designed for it.',
    sections: [
      {
        heading: 'What causes it',
        paragraphs: [
          'The biggest cause is a file that treats the actual label as only part of a larger document page.',
          'Another cause is printer software that shrinks the label again during printing.'
        ]
      },
      {
        heading: 'How to fix it',
        paragraphs: [
          'Try Fill mode if the label is safe to enlarge a bit. If you need the whole page preserved, use Fit mode and review the preview.',
          'The right fix is usually in the file, not the hardware.'
        ]
      }
    ]
  },
  {
    slug: 'why-your-label-is-sideways',
    title: 'Why Your Label Is Printing Sideways',
    description: 'What causes sideways labels and when auto-rotate can help.',
    readTime: '4 min read',
    category: 'Troubleshooting',
    intro: 'Sideways label output is usually an orientation mismatch between the source file and the 4x6 label format.',
    sections: [
      {
        heading: 'How the mismatch happens',
        paragraphs: [
          'A wide PDF page or landscape image can be interpreted in a way that does not match the printer orientation.',
          'That leads to labels that look rotated or cramped.'
        ]
      },
      {
        heading: 'What to try',
        paragraphs: [
          'Auto Rotate is often the fastest fix. It helps when the source is wide and the final output needs to sit naturally on a portrait 4x6 label.',
          'Previewing the converted file before download makes this much easier to catch.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-fix-cropped-shipping-labels',
    title: 'How to Fix Cropped Shipping Labels',
    description: 'What causes cropped shipping labels and when to switch away from fill-style scaling.',
    readTime: '4 min read',
    category: 'Troubleshooting',
    intro: 'Cropped labels usually happen when the page is being enlarged too aggressively. Sometimes that is useful, but sometimes it cuts off barcode space or text.',
    sections: [
      {
        heading: 'Why it happens',
        paragraphs: [
          'Fill-style scaling prioritizes page coverage, which can sacrifice edge visibility.',
          'If your label already fits tightly, that extra enlargement may be too much.'
        ]
      },
      {
        heading: 'A safer approach',
        paragraphs: [
          'Switch back to Fit mode when readability matters more than maximizing coverage.',
          'The preview step should always be your final check before printing.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-print-multi-page-label-pdfs',
    title: 'How to Print Multi-Page Label PDFs',
    description: 'How to handle label PDFs that contain more than one page.',
    readTime: '4 min read',
    category: 'How-To',
    intro: 'Multi-page label PDFs can be helpful or confusing depending on what is inside them. The important part is preserving the right pages and reviewing the final output.',
    sections: [
      {
        heading: 'Why multi-page support matters',
        paragraphs: [
          'Some return workflows and bundled export files include multiple pages. If your tool only converts page one, that can create real workflow problems.',
          'Multi-page conversion keeps those pages together in one 4x6-ready output.'
        ]
      },
      {
        heading: 'What to review',
        paragraphs: [
          'Always confirm the correct page count and preview the document before printing.',
          'This is especially important when one PDF includes a label plus other instructions.'
        ]
      }
    ]
  },
  {
    slug: 'best-label-printers-for-amazon-sellers',
    title: 'Best Label Printers for Amazon Sellers',
    description: 'What Amazon sellers should prioritize when picking a shipping-label printer.',
    readTime: '5 min read',
    category: 'Buyer Guide',
    intro: 'Amazon sellers often need reliability more than novelty. A printer that handles 4x6 labels consistently and stays out of the way is usually the better choice.',
    sections: [
      {
        heading: 'Focus on workflow stability',
        paragraphs: [
          'If you print often, the best printer is the one that becomes boring. Boring, in this case, is good.',
          'Stable drivers, easy label loading, and consistent print density matter more than fancy extras.'
        ]
      },
      {
        heading: 'Do not ignore file quality',
        paragraphs: [
          'Even a good printer can produce frustrating results from a bad source file. That is why printer choice and label conversion should be treated as one workflow.',
          'Cleaner input means better output and fewer wasted labels.'
        ]
      }
    ]
  },
  {
    slug: 'best-label-printers-for-home-business',
    title: 'Best Label Printers for a Home Business',
    description: 'How home businesses should think about label-printer selection.',
    readTime: '5 min read',
    category: 'Buyer Guide',
    intro: 'For a home business, convenience is often more important than raw print speed. The right label printer should save space and reduce frustration.',
    sections: [
      {
        heading: 'What home businesses need',
        paragraphs: [
          'Most home businesses need easy setup, quiet enough operation, and predictable 4x6 output.',
          'A printer that demands constant tweaking usually does not stay helpful for long.'
        ]
      },
      {
        heading: 'Pair it with a clean conversion process',
        paragraphs: [
          'The printer is only part of the system. A clean way to normalize labels before printing often matters just as much.',
          'That is why a simple 4x6 conversion step can make a home workflow feel much more professional.'
        ]
      }
    ]
  },
  {
    slug: 'free-tools-to-convert-labels-to-4x6',
    title: 'Free Tools to Convert Labels to 4x6',
    description: 'What to look for in a free 4x6 label converter.',
    readTime: '4 min read',
    category: 'Tools',
    intro: 'A free tool is only useful if it removes friction without creating a new mess. For label conversion, that means supporting common file types and giving predictable output.',
    sections: [
      {
        heading: 'What a good free tool should do',
        paragraphs: [
          'It should accept common formats, create a 4x6 PDF, and avoid forcing users through an overly complicated workflow.',
          'Previewing the result before download is also valuable because it reduces wasted labels.'
        ]
      },
      {
        heading: 'What to avoid',
        paragraphs: [
          'Avoid tools that hide the actual output behind too many steps or feel built for generic file conversion instead of labels specifically.',
          'The more focused the tool, the more useful it tends to be for shipping workflows.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-choose-thermal-printer-label-size',
    title: 'How to Choose a Thermal Printer Label Size',
    description: 'Why label size matters and why 4x6 is so common for shipping.',
    readTime: '4 min read',
    category: 'How-To',
    intro: 'Choosing the right label size is mostly about matching your printer, your carriers, and your shipping workflow.',
    sections: [
      {
        heading: 'Why 4x6 is the standard',
        paragraphs: [
          '4x6 works well for many shipping labels because it gives enough space for barcodes, addresses, and routing details.',
          'That is why so many thermal workflows revolve around 4x6 first.'
        ]
      },
      {
        heading: 'When other sizes make sense',
        paragraphs: [
          'Other sizes can be useful for product labels, shelf tags, or specialized internal workflows. But for shipping, 4x6 is often the simplest default.',
          'A conversion tool matters most when your source file does not match that default.'
        ]
      }
    ]
  },
  {
    slug: 'direct-thermal-vs-thermal-transfer-labels',
    title: 'Direct Thermal vs Thermal Transfer Labels',
    description: 'A simple explanation of direct thermal and thermal transfer label types.',
    readTime: '4 min read',
    category: 'Explainer',
    intro: 'Direct thermal and thermal transfer labels are related but not identical. For many shipping workflows, the simpler option is direct thermal.',
    sections: [
      {
        heading: 'Direct thermal',
        paragraphs: [
          'Direct thermal printing uses heat-sensitive label material and does not require ribbon. That simplicity is part of why it is common for shipping labels.',
          'It is usually a strong fit for short-lived shipping applications.'
        ]
      },
      {
        heading: 'Thermal transfer',
        paragraphs: [
          'Thermal transfer uses ribbon and can be better for long-term durability in some environments. It is often more than a basic shipper needs.',
          'For everyday shipping labels, direct thermal is usually the more practical workflow.'
        ]
      }
    ]
  },
  {
    slug: 'thermal-printer-setup-checklist',
    title: 'Thermal Printer Setup Checklist',
    description: 'A simple setup checklist for getting a thermal label printer ready for shipping work.',
    readTime: '4 min read',
    category: 'Checklist',
    intro: 'A good setup checklist keeps small problems from becoming ongoing habits. That matters a lot with shipping labels because one wrong default can waste time every day.',
    sections: [
      {
        heading: 'The checklist',
        paragraphs: [
          'Confirm the printer is set for the correct stock size, load the labels properly, test a sample file, and make sure the output is actually readable before using it on real shipments.',
          'Then verify that your label source files are not fighting the printer with bad page sizes.'
        ]
      },
      {
        heading: 'Why file workflow belongs on the checklist',
        paragraphs: [
          'Printer setup is only half the process. Source labels that are badly sized can make a good setup look broken.',
          'That is why conversion and preview should be part of the checklist too.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-test-barcode-readability-before-shipping',
    title: 'How to Test Barcode Readability Before Shipping',
    description: 'A simple way to reduce the chance of sending out a bad shipping label.',
    readTime: '4 min read',
    category: 'How-To',
    intro: 'You do not need a complicated lab setup to avoid obviously bad barcodes. A careful visual review and one clean test print solve many preventable problems.',
    sections: [
      {
        heading: 'What to look for',
        paragraphs: [
          'Look for clipped edges, stretched output, low contrast, or obvious blurring around the barcode area.',
          'If the barcode looks compressed or sits too close to a cropped edge, print another test.'
        ]
      },
      {
        heading: 'Why preview matters here too',
        paragraphs: [
          'Previewing before download can help catch problems before you waste a label. It is not a guarantee, but it is a good first layer of quality control.',
          'The less guesswork in your workflow, the fewer preventable shipping mistakes you make.'
        ]
      }
    ]
  },
  {
    slug: 'best-thermal-printer-for-shopify-sellers',
    title: 'Best Thermal Printer for Shopify Sellers',
    description: 'What Shopify sellers should prioritize in a 4x6 thermal printer setup.',
    readTime: '5 min read',
    category: 'Buyer Guide',
    intro: 'Shopify sellers need consistency more than novelty. A printer that fits a repeat shipping workflow cleanly is usually better than one with a longer feature list.',
    sections: [
      {
        heading: 'Workflow first',
        paragraphs: [
          'When your store grows, small printer annoyances grow with it. That is why setup stability, clean 4x6 printing, and easy reloading matter early.',
          'The less time you spend fixing label issues, the more time you keep for fulfillment and customer service.'
        ]
      },
      {
        heading: 'Why file cleanup still matters',
        paragraphs: [
          'Even with strong platform integrations, some labels and exports can still arrive in awkward layouts.',
          'A dedicated conversion step gives you a cleaner output when the source file is the weak point.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-print-mercari-labels-on-4x6',
    title: 'How to Print Mercari Labels on 4x6',
    description: 'A simple workflow for getting Mercari shipping labels ready for thermal printers.',
    readTime: '4 min read',
    category: 'How-To',
    intro: 'Mercari sellers run into the same basic problem as other marketplace sellers: the label does not always arrive in the ideal format for 4x6 thermal stock.',
    sections: [
      {
        heading: 'Use the file, not the print dialog, as the first fix',
        paragraphs: [
          'The most reliable approach is to make the file match the label stock before printing.',
          'Once the file is normalized, printing usually becomes much more predictable.'
        ]
      },
      {
        heading: 'Check orientation and scale',
        paragraphs: [
          'Sideways or tiny labels are usually signals that the source file needs adjustment.',
          'Fit, Fill, and Auto Rotate each solve different kinds of layout problems.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-print-poshmark-labels-on-4x6',
    title: 'How to Print Poshmark Labels on 4x6',
    description: 'How Poshmark sellers can make 4x6 thermal printing easier.',
    readTime: '4 min read',
    category: 'How-To',
    intro: 'Poshmark labels can be easy once the format is under control. The challenge is usually not the printer itself but how the file is packaged.',
    sections: [
      {
        heading: 'Why format matters',
        paragraphs: [
          'A full-page PDF can create more trouble than a clean 4x6 file, even when the label content itself is perfectly fine.',
          'That is why resizing and previewing can be more useful than repeated print-dialog changes.'
        ]
      },
      {
        heading: 'Build a repeatable method',
        paragraphs: [
          'Once you find a mode that works for your typical labels, keep using it consistently.',
          'Repeatability reduces wasted time and label stock.'
        ]
      }
    ]
  },
  {
    slug: 'small-shipping-station-setup-for-home-sellers',
    title: 'Small Shipping Station Setup for Home Sellers',
    description: 'How to keep a home shipping station simple, compact, and efficient.',
    readTime: '5 min read',
    category: 'Workflow',
    intro: 'A small shipping station works best when every tool has a job and every step feels repeatable.',
    sections: [
      {
        heading: 'The core tools',
        paragraphs: [
          'For many home sellers, the core setup is simple: scale, thermal printer, labels, tape, and a small staging area for outgoing packages.',
          'Adding too much equipment too soon can create clutter instead of efficiency.'
        ]
      },
      {
        heading: 'Where digital workflow helps',
        paragraphs: [
          'Physical organization matters, but file organization matters too. Cleanly converting labels before printing prevents the digital part of the workflow from slowing down the physical part.',
          'That is often the missing piece in a home setup.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-save-time-printing-shipping-labels',
    title: 'How to Save Time Printing Shipping Labels',
    description: 'Simple ways to reduce friction when printing a lot of shipping labels.',
    readTime: '4 min read',
    category: 'Workflow',
    intro: 'Saving time with shipping labels is usually about reducing repeat decisions. The fewer times you have to recheck orientation, scale, and output, the better.',
    sections: [
      {
        heading: 'Standardize your workflow',
        paragraphs: [
          'Use one label size, one reliable printer setup, and one conversion method for awkward files.',
          'Standardization is one of the fastest ways to reduce waste.'
        ]
      },
      {
        heading: 'Preview once, print confidently',
        paragraphs: [
          'A quick preview step can eliminate a lot of second-guessing and reprints.',
          'It is faster to review once than to fix a stack of bad labels later.'
        ]
      }
    ]
  }
];

function renderArticlePage(article) {
  const articlePath = `/articles/${article.slug}`;
  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Organization',
      name: 'PDF to Thermal'
    },
    publisher: {
      '@type': 'Organization',
      name: 'PDF to Thermal'
    },
    mainEntityOfPage: `${SITE_URL}${articlePath}`
  });

  return pageTemplate({
    title: `${article.title} | PDF to Thermal`,
    description: article.description,
    canonicalPath: articlePath,
    extraHead: `<script type="application/ld+json">${articleJsonLd}</script>`,
    content: `
      <section class="section">
        <div class="article-layout">
          <aside class="article-sidebar">
            <div class="result-summary">
              <div class="badge-row" style="margin-bottom:12px;">
                <span class="badge">${escapeHtml(article.category)}</span>
                <span class="badge">${escapeHtml(article.readTime)}</span>
              </div>
              <h3>In this article</h3>
              <div class="meta-list">
                ${article.sections.map((section, index) => `
                  <div class="meta-row">
                    <div class="meta-key">Section ${index + 1}</div>
                    <div class="meta-value">${escapeHtml(section.heading)}</div>
                  </div>
                `).join('')}
              </div>
              <div class="button-row">
                <a class="btn secondary" href="/articles">All Articles</a>
                <a class="btn ghost" href="/">Try the Converter</a>
              </div>
            </div>
          </aside>

          <div class="article-content">
            <div class="card" style="padding:28px;">
              <div class="landing-copy">
                <div class="badge-row">
                  <span class="badge">${escapeHtml(article.category)}</span>
                  <span class="badge">${escapeHtml(article.readTime)}</span>
                </div>
                <h1>${escapeHtml(article.title)}</h1>
                <p>${escapeHtml(article.intro)}</p>
              </div>
            </div>

            ${article.sections.map((section) => `
              <section class="article-section">
                <h2>${escapeHtml(section.heading)}</h2>
                ${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
              </section>
            `).join('')}

            <section class="cta">
              <h2>Need a cleaner 4x6 label workflow?</h2>
              <p>When awkward file layouts are the real problem, a clean 4x6 conversion step usually saves more time than fighting printer settings over and over.</p>
              <a class="btn" href="/">Use PDF to Thermal</a>
            </section>
          </div>
        </div>
      </section>
    `
  });
}

app.get('/about', (req, res) => {
  res.send(renderSimplePage({
    pathName: '/about',
    title: 'About | PDF to Thermal',
    description: 'Learn what PDF to Thermal is built for and who it helps.',
    heading: 'About PDF to Thermal',
    bodyHtml: `
      <p>PDF to Thermal is a focused 4x6 label conversion tool. It exists to solve one recurring problem: shipping labels often arrive in formats that are annoying to print on thermal label stock.</p>
      <p>Instead of acting like a giant all-purpose file converter, PDF to Thermal is designed around shipping, returns, and seller workflows where clean 4x6 output matters.</p>
      <div class="cards-2" style="margin-top:18px;">
        <div class="info-card">
          <h3>Who it helps</h3>
          <p>Marketplace sellers, home businesses, return-heavy workflows, and anyone who wants a cleaner 4x6 print path for PDF or image labels.</p>
        </div>
        <div class="info-card">
          <h3>What it focuses on</h3>
          <p>Fast upload, simple conversion modes, multi-page PDF support, preview before download, and fewer layout headaches before printing.</p>
        </div>
      </div>
    `
  }));
});

app.get('/articles', (req, res) => {
  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'PDF to Thermal Articles',
    description: 'Guides, troubleshooting posts, and buyer resources for shipping labels and thermal printing.'
  });

  res.send(pageTemplate({
    title: 'Articles | PDF to Thermal',
    description: 'Guides, comparisons, and troubleshooting articles for 4x6 shipping labels and thermal printing.',
    canonicalPath: '/articles',
    extraHead: `<script type="application/ld+json">${articleJsonLd}</script>`,
    content: `
      <section class="section">
        <div class="card" style="padding:28px;">
          <div class="landing-copy">
            <h1>Shipping label and thermal printing articles</h1>
            <p>Browse practical guides, comparisons, and troubleshooting articles built around 4x6 shipping label workflows.</p>
            <div class="badge-row">
              <span class="badge">${articles.length} articles</span>
              <span class="badge">Buyer guides</span>
              <span class="badge">Troubleshooting</span>
              <span class="badge">How-to workflows</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="article-grid">
          ${articles.map((article) => `
            <article class="article-card">
              <div class="article-card-meta">
                <span class="badge">${escapeHtml(article.category)}</span>
                <span class="badge">${escapeHtml(article.readTime)}</span>
              </div>
              <h3>${escapeHtml(article.title)}</h3>
              <p>${escapeHtml(article.description)}</p>
              <div class="button-row">
                <a class="btn secondary" href="/articles/${escapeHtml(article.slug)}">Read Article</a>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `
  }));
});

articles.forEach((article) => {
  app.get(`/articles/${article.slug}`, (req, res) => {
    res.send(renderArticlePage(article));
  });
});

app.get('/faq', (req, res) => {
  res.send(pageTemplate({
    title: 'FAQ | PDF to Thermal',
    description: 'Frequently asked questions about PDF to Thermal.',
    canonicalPath: '/faq',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title">Frequently asked questions</h1>
          <p class="section-subtitle">Quick answers about supported files, output format, and how this version works.</p>

          <div class="faq-grid">
            <div class="faq-item">
              <h3>What file types can I upload?</h3>
              <p>PDF, PNG, JPG, and JPEG are supported in the current version.</p>
            </div>
            <div class="faq-item">
              <h3>What size is the output?</h3>
              <p>The tool creates a 4x6 PDF intended for common thermal label printers.</p>
            </div>
            <div class="faq-item">
              <h3>Does it convert every page in a PDF now?</h3>
              <p>Yes. PDF uploads are converted page by page into a multi-page 4x6 PDF output.</p>
            </div>
            <div class="faq-item">
              <h3>Can I preview the result before downloading?</h3>
              <p>Yes. The completion page includes an on-screen PDF preview.</p>
            </div>
            <div class="faq-item">
              <h3>What does “Crop tighter to fill 4x6” do?</h3>
              <p>It scales more aggressively so the label fills more of the page, which can crop edges slightly.</p>
            </div>
            <div class="faq-item">
              <h3>What does “Rotate for best fit” do?</h3>
              <p>It rotates wide image labels, and attempts a better fit for wide PDF pages as well.</p>
            </div>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/privacy', (req, res) => {
  res.send(pageTemplate({
    title: 'Privacy Policy | PDF to Thermal',
    description: 'Privacy information for PDF to Thermal.',
    canonicalPath: '/privacy',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title">Privacy Policy</h1>
          <div class="legal">
            <p>PDF to Thermal temporarily processes files you upload in order to generate a converted 4x6 output file.</p>
            <p>Uploaded files and generated outputs are stored for a limited period to allow processing and download, then are cleaned up automatically as part of normal site operation.</p>
            <p>PDF to Thermal is not intended for highly sensitive, confidential, or regulated documents. Do not upload files containing information you would not want temporarily handled by an online conversion tool.</p>
            <p>We use analytics to understand site traffic and improve the product experience. This may include aggregate website usage information such as page views, visits, and basic interaction data.</p>
            <p>If you have privacy questions about the service, contact <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.</p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/terms', (req, res) => {
  res.send(pageTemplate({
    title: 'Terms | PDF to Thermal',
    description: 'Terms of use for PDF to Thermal.',
    canonicalPath: '/terms',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title">Terms of Use</h1>
          <div class="legal">
            <p>PDF to Thermal is provided on an as-is, as-available basis. Features, formatting behavior, and performance may change as the tool improves.</p>
            <p>You agree not to upload unlawful content, malicious files, copyrighted material you do not have the right to process, or files intended to disrupt the service.</p>
            <p>You are responsible for reviewing converted output before using it for shipment, returns, or business operations. Always verify readability, fit, and placement before printing in volume.</p>
            <p>PDF to Thermal does not guarantee carrier acceptance, barcode scannability, or compatibility for every possible label source format.</p>
            <p>Questions about these terms can be directed to <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.</p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/contact', (req, res) => {
  res.send(pageTemplate({
    title: 'Contact | PDF to Thermal',
    description: 'Contact PDF to Thermal.',
    canonicalPath: '/contact',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title">Contact</h1>
          <div class="contact-list">
            <p>Need help with the site, have feedback, or want to report a problem with a conversion?</p>
            <p>Email: <strong>${escapeHtml(SUPPORT_EMAIL)}</strong></p>
            <p>Best things to include in your message: what file type you used, which conversion mode you selected, and what happened after upload.</p>
            <p>Support requests are best sent with enough detail to reproduce the issue, especially if the problem appears tied to a specific label layout.</p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/usps-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/usps-label-to-4x6',
    title: 'USPS Label to 4x6 | PDF to Thermal',
    description: 'Convert a USPS shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert USPS labels to 4x6',
    intro: 'PDF to Thermal helps you take a USPS label in PDF or image form and turn it into a 4x6 PDF for thermal printing.',
    bullets: ['Useful when a USPS label does not line up well on a thermal printer.', 'Supports PDF, JPG, PNG, and JPEG.', 'Lets you choose fit, fill, or auto-rotate modes.'],
    tips: ['Use “Fit entire label” if you want to preserve everything on the page.', 'Use “Fill 4x6” when the label looks too small after conversion.', 'Use “Rotate for best fit” when the source label is wide.'],
    note: 'PDF uploads can now preserve multiple pages in the converted output.'
  }));
});

app.get('/ups-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/ups-label-to-4x6',
    title: 'UPS Label to 4x6 | PDF to Thermal',
    description: 'Convert a UPS shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert UPS labels to 4x6',
    intro: 'Use PDF to Thermal to reformat UPS labels into a standard 4x6 PDF for thermal label printers.',
    bullets: ['Helps with awkward page sizes and image-based labels.', 'Designed for common shipping workflows.', 'Quick browser-based conversion.'],
    tips: ['Start with Fit mode if you are not sure which one to use.', 'Try Fill mode if the label area looks too small.', 'Use Auto Rotate for wide source files.'],
    note: 'Different label layouts may behave differently depending on the source PDF or image proportions.'
  }));
});

app.get('/fedex-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/fedex-label-to-4x6',
    title: 'FedEx Label to 4x6 | PDF to Thermal',
    description: 'Convert a FedEx shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert FedEx labels to 4x6',
    intro: 'Convert FedEx labels into a 4x6 PDF that is easier to print on thermal label printers.',
    bullets: ['Good for PDF and image-based labels.', 'Includes fit, fill, and auto-rotate modes.', 'Made for thermal label printing, not generic conversion.'],
    tips: ['Use Fit mode for safest full-label output.', 'Use Fill mode for larger label coverage.', 'If the label is horizontal, try Auto Rotate first.'],
    note: 'This tool is focused on simple 4x6 formatting rather than advanced carrier-specific editing.'
  }));
});

app.get('/amazon-return-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/amazon-return-label-to-4x6',
    title: 'Amazon Return Label to 4x6 | PDF to Thermal',
    description: 'Convert an Amazon return label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert Amazon return labels to 4x6',
    intro: 'If an Amazon return label is not ready for a thermal printer, PDF to Thermal can help reformat it into a 4x6 PDF.',
    bullets: ['Useful for return labels that arrive in awkward page layouts.', 'Simple browser workflow.', 'Designed for quick print-ready output.'],
    tips: ['Fit mode is usually the best starting point.', 'Use Fill if the label looks too small on the final PDF.', 'Try Auto Rotate if the source is landscape.'],
    note: 'Return labels can vary a lot, so test the output before using it for an actual shipment.'
  }));
});

app.get('/ebay-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/ebay-label-to-4x6',
    title: 'eBay Label to 4x6 | PDF to Thermal',
    description: 'Convert an eBay shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert eBay labels to 4x6',
    intro: 'PDF to Thermal helps eBay sellers convert shipping labels into a simpler 4x6 PDF format for thermal printing.',
    bullets: ['Made for seller workflows.', 'Works with PDF and image files.', 'Fast upload, convert, and download flow.'],
    tips: ['Use Fit when you want everything preserved.', 'Try Fill for larger printed label area.', 'Use Auto Rotate on wide source labels.'],
    note: 'Always preview the final PDF before printing multiple labels.'
  }));
});

app.get('/etsy-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/etsy-label-to-4x6',
    title: 'Etsy Label to 4x6 | PDF to Thermal',
    description: 'Convert an Etsy shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert Etsy labels to 4x6',
    intro: 'PDF to Thermal gives Etsy sellers a quick way to turn shipping labels into a 4x6 PDF for thermal label printers.',
    bullets: ['Useful for home-based seller workflows.', 'Helps avoid printer workarounds.', 'Simple conversion options for better fit.'],
    tips: ['Fit mode is the safest option first.', 'Fill mode helps if the output looks too small.', 'Try Auto Rotate for wide or sideways source labels.'],
    note: 'This tool is built for speed and simplicity rather than advanced label editing.'
  }));
});

app.get('/pdf-to-4x6-label', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/pdf-to-4x6-label',
    title: 'PDF to 4x6 Label Converter | PDF to Thermal',
    description: 'Convert a PDF shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert PDF labels to 4x6',
    intro: 'If you have a shipping label in PDF form and need it resized for a 4x6 thermal printer, PDF to Thermal is built for that exact job.',
    bullets: ['Useful for standard PDF labels that do not print cleanly on a 4x6 printer.', 'Focused on shipping labels rather than generic document conversion.', 'Good for sellers, returns, and small shipping workflows.'],
    tips: ['Use Fit mode first when preserving the full page matters.', 'Use Fill mode if the label looks too small after conversion.', 'Use Auto Rotate if the original PDF page is wide.'],
    note: 'PDF uploads now convert all pages into a multi-page 4x6 output file.'
  }));
});

app.get('/shipping-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/shipping-label-to-4x6',
    title: 'Shipping Label to 4x6 | PDF to Thermal',
    description: 'Convert a shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert shipping labels to 4x6',
    intro: 'PDF to Thermal is designed to take shipping labels in common formats and convert them into a cleaner 4x6 layout for thermal printers.',
    bullets: ['Works with PDF, PNG, JPG, and JPEG label files.', 'Designed for a simple upload, convert, and download flow.', 'Useful for carrier labels and marketplace return labels.'],
    tips: ['Use Fit if you want the least risky resizing option.', 'Use Fill if you want the output to occupy more of the page.', 'Test a single label before printing many.'],
    note: 'Shipping labels vary by source, so always preview the final PDF before operational use.'
  }));
});

app.get('/thermal-label-converter', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/thermal-label-converter',
    title: 'Thermal Label Converter | PDF to Thermal',
    description: 'Use PDF to Thermal as a thermal label converter for 4x6 printing.',
    heading: 'Thermal label converter for 4x6 printing',
    intro: 'PDF to Thermal is a focused thermal label converter that reformats labels for common 4x6 thermal printer workflows.',
    bullets: ['Not a generic converter site with dozens of unrelated tools.', 'Built specifically around shipping-label conversion.', 'Useful for people who need simple 4x6 output fast.'],
    tips: ['Image labels can benefit from Auto Rotate when they start sideways.', 'Fit mode is best when barcodes and text need to stay fully visible.', 'Fill mode is best when you want more page coverage.'],
    note: 'Some label layouts may still need manual review depending on barcode placement and margins.'
  }));
});

app.get('/pdf-to-thermal-printer', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/pdf-to-thermal-printer',
    title: 'PDF to Thermal Printer | PDF to Thermal',
    description: 'Convert a PDF shipping label for easier use on a thermal printer.',
    heading: 'Convert a PDF for thermal printer use',
    intro: 'If your PDF label was not created with a 4x6 thermal printer in mind, PDF to Thermal helps reformat it into a more usable output.',
    bullets: ['Useful when a normal PDF page does not print well on a thermal printer.', 'Focuses on simple 4x6 conversion rather than full document editing.', 'Good for one-off labels and repeat seller workflows.'],
    tips: ['Start with Fit to preserve the full source page.', 'Use Fill for larger visual output when acceptable.', 'Use Auto Rotate if the source is wider than it is tall.'],
    note: 'Barcodes, margins, and source proportions can affect the final result, so preview before use.'
  }));
});

app.get('/amazon-return-label-to-thermal-printer', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/amazon-return-label-to-thermal-printer',
    title: 'Amazon Return Label to Thermal Printer | PDF to Thermal',
    description: 'Convert an Amazon return label for easier printing on a thermal printer.',
    heading: 'Convert Amazon return labels for thermal printers',
    intro: 'Amazon return labels do not always arrive in the ideal format for thermal printers. PDF to Thermal helps bridge that gap with a simple 4x6 workflow.',
    bullets: ['Useful for return labels that start as full-page PDFs or awkward image layouts.', 'Fast browser-based conversion.', 'Designed for simple home and small-business return workflows.'],
    tips: ['Try Fit mode first for safest output.', 'Use Fill if the result looks too small.', 'Preview before printing your final label.'],
    note: 'Because return labels can vary, always verify the final PDF before attaching it to a package.'
  }));
});

app.post('/convert', (req, res, next) => {
  upload.single('labelFile')(req, res, function (err) {
    if (err) {
      return res.status(400).send(pageTemplate({
        title: 'Upload Error | PDF to Thermal',
        description: 'Upload error on PDF to Thermal.',
        canonicalPath: '/',
        content: `
          <div class="card result-card">
            <div class="status error">Upload error</div>
            <h1>We could not process that upload</h1>
            <p>${escapeHtml(err.message)}</p>
            <div class="button-row">
              <a class="btn" href="/">Back Home</a>
            </div>
          </div>
        `
      }));
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).send(pageTemplate({
      title: 'Upload Error | PDF to Thermal',
      description: 'Upload error on PDF to Thermal.',
      canonicalPath: '/',
      content: `
        <div class="card result-card">
          <div class="status error">Upload error</div>
          <h1>No file uploaded</h1>
          <p>Please go back and choose a PDF, PNG, JPG, or JPEG file before submitting.</p>
          <div class="button-row">
            <a class="btn" href="/">Back Home</a>
          </div>
        </div>
      `
    }));
  }

  cleanupOldFiles(uploadsDir);
  cleanupOldFiles(downloadsDir);

  const mode = req.body.mode || 'fit';
  const inputPath = req.file.path;
  const originalName = req.file.originalname || 'Uploaded file';
  const ext = path.extname(originalName).toLowerCase();
  const outputName = `converted-${Date.now()}.pdf`;
  const outputPath = path.join(downloadsDir, outputName);

  try {
    let result;

    if (ext === '.pdf') {
      result = await pdfTo4x6(inputPath, outputPath, mode);
    } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      result = await imageToPdf(inputPath, outputPath, mode);
    } else {
      throw new Error('Unsupported file type.');
    }

    const modeLabel =
      mode === 'fill'
        ? 'Crop tighter to fill 4x6'
        : mode === 'autorotate'
        ? 'Rotate for best fit'
        : 'Fit entire label';

    const pageCount = result && result.pageCount ? result.pageCount : 1;
    const pageMessage =
      pageCount > 1
        ? `Your file was processed successfully using <strong>${escapeHtml(modeLabel)}</strong>. ${pageCount} pages were converted into one multi-page 4x6 PDF.`
        : `Your file was processed successfully using <strong>${escapeHtml(modeLabel)}</strong>. Download the converted PDF and print it on a 4x6 thermal label printer.`;

    const previewUrl = `/downloads/${encodeURIComponent(outputName)}#toolbar=0&navpanes=0&scrollbar=1`;
    const originalUrl = `/uploads/${encodeURIComponent(path.basename(inputPath))}`;
    const openUrl = `/downloads/${encodeURIComponent(outputName)}`;
    const croppingWarning = mode === 'fill'
      ? `<div class="warning-box">Fill mode can crop outer edges slightly. Review the preview carefully before printing.</div>`
      : '';

    const reportSubject = encodeURIComponent('PDF to Thermal conversion issue');
    const reportBody = encodeURIComponent(
      `Hi,\n\nI want to report a conversion issue.\n\nOriginal file: ${originalName}\nSelected mode: ${modeLabel}\nPage count: ${pageCount}\nWhat happened:\n\n`
    );

    res.send(pageTemplate({
      title: 'Conversion Complete | PDF to Thermal',
      description: 'File conversion complete on PDF to Thermal.',
      canonicalPath: '/',
      content: `
        <div class="card result-card">
          <div class="status success">Conversion complete</div>
          <h1>Your 4x6 PDF is ready</h1>
          <p>${pageMessage}</p>

          <div class="button-row">
            <a class="btn" href="/downloads/${escapeHtml(outputName)}" download>Download 4x6 PDF</a>
            <a class="btn secondary" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener">Open PDF in New Tab</a>
            <a class="btn ghost" href="/">Convert Another File</a>
          </div>

          <div class="result-grid">
            <div class="result-meta">
              <div class="result-summary">
                <h3>Conversion details</h3>
                <div class="meta-list">
                  <div class="meta-row">
                    <div class="meta-key">Original file</div>
                    <div class="meta-value">${escapeHtml(originalName)}</div>
                  </div>
                  <div class="meta-row">
                    <div class="meta-key">File type</div>
                    <div class="meta-value">${escapeHtml(ext.replace('.', '').toUpperCase())}</div>
                  </div>
                  <div class="meta-row">
                    <div class="meta-key">Mode used</div>
                    <div class="meta-value">${escapeHtml(modeLabel)}</div>
                  </div>
                  <div class="meta-row">
                    <div class="meta-key">Pages converted</div>
                    <div class="meta-value">${escapeHtml(String(pageCount))}</div>
                  </div>
                  <div class="meta-row">
                    <div class="meta-key">Output</div>
                    <div class="meta-value">4x6 PDF</div>
                  </div>
                </div>

                ${croppingWarning}

                <div class="button-row">
                  <a class="btn secondary" href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener">Open Original Upload</a>
                  <a class="btn ghost" href="mailto:${escapeHtml(SUPPORT_EMAIL)}?subject=${reportSubject}&body=${reportBody}">Report Bad Conversion</a>
                </div>
              </div>

              <div class="result-summary">
                <h3>Printer tips</h3>
                <div class="tips-list">
                  <p>• Review the preview before printing, especially when using Fill mode.</p>
                  <p>• Print one label first if the barcode or margins are critical.</p>
                  <p>• If the label looks too zoomed in, retry with Fit mode.</p>
                  <p>• If the label looks too small, retry with Fill mode.</p>
                  <p>• If the source label is wide, Auto Rotate is often the better choice.</p>
                </div>
              </div>
            </div>

            <div class="preview-shell">
              <div class="preview-card">
                <h3>Preview your converted label</h3>
                <p>Review the output below before downloading or printing.</p>
                <iframe class="preview-frame" src="${escapeHtml(previewUrl)}" title="Converted PDF preview"></iframe>
                <div class="preview-tip">
                  If your browser does not show the preview, use the “Open PDF in New Tab” or download button above.
                </div>
              </div>
            </div>
          </div>
        </div>
      `
    }));
  } catch (err) {
    console.error(err);
    res.status(500).send(pageTemplate({
      title: 'Conversion Failed | PDF to Thermal',
      description: 'File conversion failed on PDF to Thermal.',
      canonicalPath: '/',
      content: `
        <div class="card result-card">
          <div class="status error">Conversion failed</div>
          <h1>Something went wrong</h1>
          <p>${escapeHtml(err.message || 'Unknown error')}</p>
          <div class="button-row">
            <a class="btn" href="/">Try Again</a>
          </div>
        </div>
      `
    }));
  } finally {
    // Keep original upload temporarily for results page access.
  }
});

app.get('*', (req, res) => {
  res.status(404).send(pageTemplate({
    title: 'Page Not Found | PDF to Thermal',
    description: 'The page you requested could not be found.',
    canonicalPath: '/',
    content: `
      <div class="card not-found">
        <div class="status error">404</div>
        <h1>Page not found</h1>
        <p>The page you requested does not exist or may have moved.</p>
        <div class="button-row">
          <a class="btn" href="/">Go Home</a>
          <a class="btn secondary" href="/articles">Browse Articles</a>
        </div>
      </div>
    `
  }));
});

app.listen(PORT, () => {
  console.log(`PDF to Thermal running on port ${PORT}`);
});
