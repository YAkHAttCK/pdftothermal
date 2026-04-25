const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument, degrees } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://pdftothermal.com';
const GA_ID = 'G-CV6R7PF4PH';

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

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageTemplate({
  title = 'PDF to Thermal',
  description = 'Convert shipping labels to 4x6 thermal format.',
  canonicalPath = '/',
  content = ''
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

    <style>
      :root {
        --bg: #f4f7fb;
        --card: #ffffff;
        --text: #0f172a;
        --muted: #64748b;
        --line: #dbe4ee;
        --primary: #2563eb;
        --primary-dark: #1d4ed8;
        --accent: #eff6ff;
        --success: #166534;
        --error: #b91c1c;
        --warning: #92400e;
        --warning-bg: #fff7ed;
        --shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
        --radius: 18px;
      }

      * { box-sizing: border-box; }

      html { scroll-behavior: smooth; }

      body {
        margin: 0;
        font-family: Inter, Arial, Helvetica, sans-serif;
        background:
          radial-gradient(circle at top left, #eef4ff 0, transparent 32%),
          radial-gradient(circle at top right, #eef8ff 0, transparent 28%),
          var(--bg);
        color: var(--text);
      }

      a {
        color: var(--primary);
        text-decoration: none;
      }

      a:hover { text-decoration: underline; }

      .container {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 0 10px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-weight: 800;
        color: var(--text);
      }

      .brand-badge {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--primary), #60a5fa);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 800;
        box-shadow: var(--shadow);
      }

      .nav-links {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
      }

      .nav-links a {
        color: var(--muted);
        font-weight: 600;
      }

      .hero {
        padding: 28px 0 18px;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 24px;
        align-items: stretch;
      }

      .hero-card,
      .card {
        background: var(--card);
        border: 1px solid rgba(219, 228, 238, 0.8);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }

      .hero-copy {
        padding: 34px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--accent);
        color: var(--primary);
        border: 1px solid #bfdbfe;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 16px;
      }

      h1 {
        margin: 0 0 14px;
        font-size: clamp(36px, 5vw, 56px);
        line-height: 1.02;
        letter-spacing: -0.03em;
      }

      h2, h3 {
        letter-spacing: -0.02em;
      }

      .lead {
        margin: 0 0 22px;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.6;
        max-width: 700px;
      }

      .hero-points {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 20px 0 22px;
      }

      .hero-point {
        background: #f8fafc;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px;
      }

      .hero-point strong {
        display: block;
        margin-bottom: 4px;
        font-size: 15px;
      }

      .hero-point span {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }

      .trust-line {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.6;
      }

      .upload-card {
        padding: 24px;
      }

      .upload-card h2 {
        margin: 0 0 10px;
        font-size: 26px;
      }

      .upload-card p {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.55;
      }

      .upload-box {
        border: 2px dashed #bfdbfe;
        background: linear-gradient(180deg, #f8fbff 0%, #f7fbff 100%);
        border-radius: 16px;
        padding: 22px;
      }

      .upload-box label.main-label {
        display: block;
        font-weight: 700;
        margin-bottom: 10px;
      }

      input[type="file"] {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: white;
        margin-bottom: 14px;
      }

      button, .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 46px;
        padding: 0 18px;
        border-radius: 12px;
        border: 0;
        background: var(--primary);
        color: white;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
      }

      button:hover, .btn:hover {
        background: var(--primary-dark);
        text-decoration: none;
      }

      .microcopy {
        margin-top: 12px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .mode-box {
        margin: 14px 0 16px;
        padding: 14px;
        background: white;
        border: 1px solid var(--line);
        border-radius: 12px;
      }

      .mode-box-title {
        display: block;
        font-weight: 700;
        margin-bottom: 10px;
      }

      .mode-option {
        display: block;
        margin-bottom: 10px;
        color: var(--text);
        font-size: 14px;
      }

      .mode-option:last-child {
        margin-bottom: 0;
      }

      .mode-option small {
        display: block;
        color: var(--muted);
        margin-left: 24px;
        margin-top: 2px;
        line-height: 1.4;
      }

      .section {
        padding: 18px 0;
      }

      .section-title {
        margin: 0 0 16px;
        font-size: 30px;
      }

      .section-subtitle {
        margin: 0 0 24px;
        color: var(--muted);
        line-height: 1.6;
        max-width: 760px;
      }

      .cards-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .step-card,
      .info-card,
      .mini-card {
        background: white;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 22px;
        box-shadow: var(--shadow);
      }

      .step-number {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: var(--accent);
        color: var(--primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .step-card h3,
      .info-card h3,
      .mini-card h3 {
        margin: 0 0 8px;
        font-size: 19px;
      }

      .step-card p,
      .info-card p,
      .mini-card p,
      .faq-item p,
      .legal p,
      .contact-list p,
      .landing-copy p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .cards-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .use-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .use-item {
        background: white;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 16px;
        font-weight: 700;
      }

      .warning-box {
        margin-top: 18px;
        padding: 14px;
        border: 1px solid #fed7aa;
        background: var(--warning-bg);
        border-radius: 14px;
        color: var(--warning);
        line-height: 1.55;
        font-size: 14px;
      }

      .cta {
        margin: 18px 0 32px;
        background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
        color: white;
        border-radius: 20px;
        padding: 30px;
        box-shadow: var(--shadow);
      }

      .cta h2 {
        margin: 0 0 10px;
        font-size: 30px;
      }

      .cta p {
        margin: 0 0 18px;
        color: rgba(255,255,255,0.82);
        line-height: 1.6;
        max-width: 760px;
      }

      .cta .btn {
        background: white;
        color: var(--primary);
        box-shadow: none;
      }

      .faq-grid {
        display: grid;
        gap: 14px;
      }

      .faq-item {
        background: white;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 18px;
      }

      .faq-item h3 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      .footer {
        padding: 26px 0 48px;
        color: var(--muted);
        font-size: 14px;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 12px;
      }

      .result-card {
        max-width: 760px;
        margin: 44px auto;
        padding: 32px;
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

      .result-card h1,
      .landing-copy h1 {
        font-size: 36px;
        margin-bottom: 12px;
      }

      .result-card p {
        color: var(--muted);
        line-height: 1.6;
      }

      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
      }

      .btn.secondary {
        background: #eef2ff;
        color: var(--primary);
        box-shadow: none;
      }

      .legal, .contact-list, .landing-copy {
        display: grid;
        gap: 16px;
      }

      .landing-section-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
        margin-top: 14px;
      }

      .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        background: #f8fafc;
        border: 1px solid var(--line);
        font-size: 13px;
        font-weight: 700;
        color: var(--text);
      }

      @media (max-width: 920px) {
        .hero-grid,
        .cards-3,
        .cards-2,
        .use-grid,
        .landing-section-grid {
          grid-template-columns: 1fr;
        }

        .hero-copy,
        .upload-card {
          padding: 24px;
        }

        .hero-points {
          grid-template-columns: 1fr;
        }

        .nav {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header class="nav">
        <a class="brand" href="/">
          <span class="brand-badge">PT</span>
          <span>PDF to Thermal</span>
        </a>
        <nav class="nav-links">
          <a href="/">Home</a>
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
        </div>
      </footer>
    </div>
  </body>
  </html>
  `;
}

function renderLandingPage({
  pathName,
  title,
  description,
  heading,
  intro,
  bullets = [],
  tips = [],
  note = ''
}) {
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

app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`);
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc></url>
  <url><loc>${SITE_URL}/faq</loc></url>
  <url><loc>${SITE_URL}/privacy</loc></url>
  <url><loc>${SITE_URL}/terms</loc></url>
  <url><loc>${SITE_URL}/contact</loc></url>
  <url><loc>${SITE_URL}/usps-label-to-4x6</loc></url>
  <url><loc>${SITE_URL}/ups-label-to-4x6</loc></url>
  <url><loc>${SITE_URL}/fedex-label-to-4x6</loc></url>
  <url><loc>${SITE_URL}/amazon-return-label-to-4x6</loc></url>
  <url><loc>${SITE_URL}/ebay-label-to-4x6</loc></url>
  <url><loc>${SITE_URL}/etsy-label-to-4x6</loc></url>
</urlset>`);
});

app.get('/favicon.svg', (req, res) => {
  res.type('image/svg+xml');
  res.send(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#2563eb"/>
        <stop offset="100%" stop-color="#60a5fa"/>
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#g)"/>
    <text x="32" y="38" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ffffff">PT</text>
  </svg>`);
});

app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | Convert Shipping Labels to 4x6 Thermal Format',
    description: 'Upload a PDF, JPG, or PNG shipping label and convert it into a 4x6 thermal-printer-ready PDF.',
    canonicalPath: '/',
    content: `
      <section class="hero">
        <div class="hero-grid">
          <div class="hero-card hero-copy">
            <div class="eyebrow">4x6 label conversion made simple</div>
            <h1>Convert shipping labels to 4x6 thermal format</h1>
            <p class="lead">
              Upload a PDF, JPG, or PNG label and turn it into a clean thermal-printer-ready PDF in seconds.
            </p>

            <div class="hero-points">
              <div class="hero-point">
                <strong>Built for shipping labels</strong>
                <span>Made for 4x6 thermal printing instead of generic file conversion.</span>
              </div>
              <div class="hero-point">
                <strong>Fast upload and download</strong>
                <span>Simple browser-based flow with no account required in this version.</span>
              </div>
              <div class="hero-point">
                <strong>Supports common formats</strong>
                <span>Upload PDF, PNG, JPG, or JPEG and get a print-ready PDF back.</span>
              </div>
              <div class="hero-point">
                <strong>Useful for marketplaces</strong>
                <span>Good for USPS, UPS, FedEx, Amazon returns, eBay, Etsy, and more.</span>
              </div>
            </div>

            <div class="trust-line">
              Works best for common shipping workflows where you need a simple 4x6 output for a thermal label printer.
            </div>
          </div>

          <div class="hero-card upload-card">
            <h2>Upload your label</h2>
            <p>
              Choose a conversion mode based on whether you want to preserve the full label, fill the page more tightly, or auto-rotate a wide label.
            </p>

            <form action="/convert" method="POST" enctype="multipart/form-data" class="upload-box">
              <label class="main-label" for="labelFile">Select a file</label>
              <input id="labelFile" type="file" name="labelFile" accept=".pdf,.png,.jpg,.jpeg" required />

              <div class="mode-box">
                <span class="mode-box-title">Conversion mode</span>

                <label class="mode-option">
                  <input type="radio" name="mode" value="fit" checked />
                  Fit entire label
                  <small>Keeps the full label visible and scales it to fit inside 4x6.</small>
                </label>

                <label class="mode-option">
                  <input type="radio" name="mode" value="fill" />
                  Crop tighter to fill 4x6
                  <small>Fills more of the page and may crop some outer edges.</small>
                </label>

                <label class="mode-option">
                  <input type="radio" name="mode" value="autorotate" />
                  Rotate for best fit
                  <small>Automatically rotates wide labels when that should fit better on 4x6.</small>
                </label>
              </div>

              <button type="submit">Upload and Convert</button>
              <div class="microcopy">
                Supported file types: PDF, PNG, JPG, JPEG.<br />
                Max upload size: 15 MB.<br />
                Current version converts the first page of a PDF.
              </div>
            </form>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">How it works</h2>
        <p class="section-subtitle">
          PDF to Thermal is designed to keep the process simple: upload your label, choose a conversion mode, convert it to 4x6, then download the finished PDF.
        </p>
        <div class="cards-3">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3>Upload your file</h3>
            <p>Use a PDF, JPG, PNG, or JPEG shipping label from your computer or phone.</p>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <h3>Choose your mode</h3>
            <p>Select fit, fill, or auto-rotate depending on how you want the label placed on the page.</p>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>Download and print</h3>
            <p>Open the converted file and print it on your 4x6 thermal label printer.</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Built for common label problems</h2>
        <p class="section-subtitle">
          Many labels arrive in awkward PDFs or image formats that do not line up well with a thermal printer. This tool helps bridge that gap.
        </p>
        <div class="use-grid">
          <div class="use-item">USPS labels</div>
          <div class="use-item">UPS labels</div>
          <div class="use-item">FedEx labels</div>
          <div class="use-item">Amazon return labels</div>
          <div class="use-item">eBay shipping labels</div>
          <div class="use-item">Etsy shipping labels</div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Why people use PDF to Thermal</h2>
        <div class="cards-2">
          <div class="info-card">
            <h3>Focused instead of generic</h3>
            <p>
              This is not another broad file converter. It is built around one job: getting shipping labels into a usable 4x6 thermal format.
            </p>
          </div>
          <div class="info-card">
            <h3>Simple enough for repeat use</h3>
            <p>
              The goal is a practical tool you can use quickly without needing design software, printer workarounds, or extra cleanup steps.
            </p>
          </div>
        </div>
      </section>

      <section class="cta">
        <h2>Fix your shipping label in seconds</h2>
        <p>
          Upload your file, choose the best fit mode, and download a cleaner PDF for your thermal printer.
        </p>
        <a class="btn" href="/">Start with a label upload</a>
      </section>
    `
  }));
});

app.get('/faq', (req, res) => {
  res.send(pageTemplate({
    title: 'FAQ | PDF to Thermal',
    description: 'Frequently asked questions about PDF to Thermal.',
    canonicalPath: '/faq',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title" style="margin-bottom: 10px;">Frequently asked questions</h1>
          <p class="section-subtitle" style="margin-bottom: 22px;">
            Quick answers about supported files, output format, and how this version works.
          </p>

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
              <h3>What does “Fit entire label” do?</h3>
              <p>It scales the whole label down so everything stays visible within the 4x6 page.</p>
            </div>
            <div class="faq-item">
              <h3>What does “Crop tighter to fill 4x6” do?</h3>
              <p>It scales more aggressively so the label fills more of the page, which can crop edges slightly.</p>
            </div>
            <div class="faq-item">
              <h3>What does “Rotate for best fit” do?</h3>
              <p>It rotates wide image labels, and attempts a better fit for wide PDFs as well.</p>
            </div>
            <div class="faq-item">
              <h3>Does it convert every page in a PDF?</h3>
              <p>Not yet. This version converts the first page of a PDF.</p>
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
          <h1 class="section-title" style="margin-bottom: 10px;">Privacy Policy</h1>
          <div class="legal">
            <p>PDF to Thermal is a file-processing tool. When you upload a file, it is temporarily processed to create a converted output.</p>
            <p>This early version is intended for testing and development. Before broader public launch, this page should be updated with your final retention, deletion, and usage policies.</p>
            <p>Do not upload highly sensitive files until your final privacy language and storage practices are fully in place.</p>
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
          <h1 class="section-title" style="margin-bottom: 10px;">Terms of Use</h1>
          <div class="legal">
            <p>PDF to Thermal is provided as-is in this early version. Features, performance, and file-handling behavior may change as the tool improves.</p>
            <p>By using the site, you agree not to upload unlawful content, malicious files, or material you do not have the right to process.</p>
            <p>Before public launch, this page should be updated with complete legal terms that match your final business and hosting setup.</p>
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
          <h1 class="section-title" style="margin-bottom: 10px;">Contact</h1>
          <div class="contact-list">
            <p>This page is a placeholder for your public contact details.</p>
            <p>Before launch, add your preferred contact method such as a support email, business contact form, or help desk link.</p>
            <p>Suggested support email format: <strong>support@pdftothermal.com</strong></p>
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
    bullets: [
      'Useful when a USPS label does not line up well on a thermal printer.',
      'Supports PDF, JPG, PNG, and JPEG.',
      'Lets you choose fit, fill, or auto-rotate modes.'
    ],
    tips: [
      'Use “Fit entire label” if you want to preserve everything on the page.',
      'Use “Fill 4x6” when the label looks too small after conversion.',
      'Use “Rotate for best fit” when the source label is wide.'
    ],
    note: 'This version converts the first page of a PDF. Multi-page label handling can come later.'
  }));
});

app.get('/ups-label-to-4x6', (req, res) => {
  res.send(renderLandingPage({
    pathName: '/ups-label-to-4x6',
    title: 'UPS Label to 4x6 | PDF to Thermal',
    description: 'Convert a UPS shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert UPS labels to 4x6',
    intro: 'Use PDF to Thermal to reformat UPS labels into a standard 4x6 PDF for thermal label printers.',
    bullets: [
      'Helps with awkward page sizes and image-based labels.',
      'Designed for common shipping workflows.',
      'Quick browser-based conversion.'
    ],
    tips: [
      'Start with Fit mode if you are not sure which one to use.',
      'Try Fill mode if the label area looks too small.',
      'Use Auto Rotate for wide source files.'
    ],
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
    bullets: [
      'Good for PDF and image-based labels.',
      'Includes fit, fill, and auto-rotate modes.',
      'Made for thermal label printing, not generic conversion.'
    ],
    tips: [
      'Use Fit mode for safest full-label output.',
      'Use Fill mode for larger label coverage.',
      'If the label is horizontal, try Auto Rotate first.'
    ],
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
    bullets: [
      'Useful for return labels that arrive in awkward page layouts.',
      'Simple browser workflow.',
      'Designed for quick print-ready output.'
    ],
    tips: [
      'Fit mode is usually the best starting point.',
      'Use Fill if the label looks too small on the final PDF.',
      'Try Auto Rotate if the source is landscape.'
    ],
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
    bullets: [
      'Made for seller workflows.',
      'Works with PDF and image files.',
      'Fast upload, convert, and download flow.'
    ],
    tips: [
      'Use Fit when you want everything preserved.',
      'Try Fill for larger printed label area.',
      'Use Auto Rotate on wide source labels.'
    ],
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
    bullets: [
      'Useful for home-based seller workflows.',
      'Helps avoid printer workarounds.',
      'Simple conversion options for better fit.'
    ],
    tips: [
      'Fit mode is the safest option first.',
      'Fill mode helps if the output looks too small.',
      'Try Auto Rotate for wide or sideways source labels.'
    ],
    note: 'This tool is built for speed and simplicity rather than advanced label editing.'
  }));
});

async function imageToPdf(inputPath, outputPath, mode = 'fit') {
  const metadata = await sharp(inputPath).metadata();
  const pagePortrait = { width: 1200, height: 1800 };

  let pipeline = sharp(inputPath);

  if (mode === 'autorotate' && metadata.width && metadata.height && metadata.width > metadata.height) {
    pipeline = pipeline.rotate(90);
  }

  const fitMode = mode === 'fill' ? 'cover' : 'contain';

  const imageBuffer = await pipeline
    .resize(pagePortrait.width, pagePortrait.height, {
      fit: fitMode,
      position: 'center',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toBuffer();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([288, 432]);

  const embedded = await pdfDoc.embedPng(imageBuffer);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: 288,
    height: 432
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

async function pdfTo4x6(inputPath, outputPath, mode = 'fit') {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const existingPdf = await PDFDocument.load(existingPdfBytes);
  const newPdf = await PDFDocument.create();

  const [copiedPage] = await newPdf.copyPages(existingPdf, [0]);
  const sourceWidth = copiedPage.getWidth();
  const sourceHeight = copiedPage.getHeight();

  const targetWidth = 288;
  const targetHeight = 432;
  const page = newPdf.addPage([targetWidth, targetHeight]);

  const shouldRotate = mode === 'autorotate' && sourceWidth > sourceHeight;

  const effectiveWidth = shouldRotate ? sourceHeight : sourceWidth;
  const effectiveHeight = shouldRotate ? sourceWidth : sourceHeight;

  const scale =
    mode === 'fill'
      ? Math.max(targetWidth / effectiveWidth, targetHeight / effectiveHeight)
      : Math.min(targetWidth / effectiveWidth, targetHeight / effectiveHeight);

  const drawnWidth = effectiveWidth * scale;
  const drawnHeight = effectiveHeight * scale;

  const x = (targetWidth - drawnWidth) / 2;
  const y = (targetHeight - drawnHeight) / 2;

  if (shouldRotate) {
    page.drawPage(copiedPage, {
      x: targetWidth - x,
      y,
      xScale: scale,
      yScale: scale,
      rotate: degrees(90)
    });
  } else {
    page.drawPage(copiedPage, {
      x,
      y,
      xScale: scale,
      yScale: scale
    });
  }

  const pdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

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
  const ext = path.extname(req.file.originalname).toLowerCase();
  const outputName = `converted-${Date.now()}.pdf`;
  const outputPath = path.join(downloadsDir, outputName);

  try {
    if (ext === '.pdf') {
      await pdfTo4x6(inputPath, outputPath, mode);
    } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      await imageToPdf(inputPath, outputPath, mode);
    } else {
      throw new Error('Unsupported file type.');
    }

    const modeLabel =
      mode === 'fill'
        ? 'Crop tighter to fill 4x6'
        : mode === 'autorotate'
        ? 'Rotate for best fit'
        : 'Fit entire label';

    res.send(pageTemplate({
      title: 'Conversion Complete | PDF to Thermal',
      description: 'File conversion complete on PDF to Thermal.',
      canonicalPath: '/',
      content: `
        <div class="card result-card">
          <div class="status success">Conversion complete</div>
          <h1>Your 4x6 PDF is ready</h1>
          <p>
            Your file was processed successfully using <strong>${escapeHtml(modeLabel)}</strong>. Download the converted PDF and print it on a 4x6 thermal label printer.
          </p>
          <div class="button-row">
            <a class="btn" href="/downloads/${escapeHtml(outputName)}" download>Download 4x6 PDF</a>
            <a class="btn secondary" href="/">Convert Another File</a>
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
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  }
});

app.listen(PORT, () => {
  console.log(`PDF to Thermal running on port ${PORT}`);
});
