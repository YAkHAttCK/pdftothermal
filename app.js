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

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
        --bg: #0b1020;
        --bg-soft: #10172d;
        --panel: rgba(255,255,255,0.92);
        --panel-2: rgba(255,255,255,0.72);
        --text: #0f172a;
        --text-soft: #475569;
        --line: rgba(148,163,184,0.25);
        --line-strong: rgba(99,102,241,0.22);
        --primary: #2563eb;
        --primary-dark: #1d4ed8;
        --primary-soft: #dbeafe;
        --accent: #7c3aed;
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

      a {
        color: var(--primary);
        text-decoration: none;
      }

      a:hover { text-decoration: underline; }

      .shell {
        position: relative;
        overflow: hidden;
      }

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

      .brand-text span:first-child {
        font-size: 16px;
      }

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

      .hero-card,
      .card {
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

      .upload-card {
        padding: 24px;
      }

      .upload-card h2 {
        margin: 0 0 10px;
        font-size: 27px;
      }

      .upload-card p {
        margin: 0 0 18px;
        color: var(--text-soft);
        line-height: 1.6;
      }

      .upload-box {
        border: 2px dashed rgba(37,99,235,0.28);
        background: linear-gradient(180deg, rgba(248,251,255,0.95) 0%, rgba(255,255,255,0.9) 100%);
        border-radius: 18px;
        padding: 22px;
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
        transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
      }

      button:hover, .btn:hover {
        text-decoration: none;
        transform: translateY(-1px);
        box-shadow: 0 16px 32px rgba(59,130,246,0.24);
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

      .mode-option:last-child {
        margin-bottom: 0;
      }

      .mode-option small {
        display: block;
        color: var(--text-soft);
        margin-left: 24px;
        margin-top: 3px;
        line-height: 1.45;
      }

      .section {
        padding: 20px 0;
      }

      .section-title {
        margin: 0 0 16px;
        font-size: 31px;
      }

      .section-subtitle {
        margin: 0 0 24px;
        color: var(--text-soft);
        line-height: 1.65;
        max-width: 760px;
      }

      .cards-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .step-card,
      .info-card,
      .mini-card,
      .preview-card,
      .result-summary {
        background: rgba(255,255,255,0.95);
        border: 1px solid rgba(255,255,255,0.85);
        border-radius: 18px;
        padding: 22px;
        box-shadow: var(--shadow-md);
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

      .step-card h3,
      .info-card h3,
      .mini-card h3,
      .preview-card h3,
      .result-summary h3 {
        margin: 0 0 8px;
        font-size: 19px;
      }

      .step-card p,
      .info-card p,
      .mini-card p,
      .faq-item p,
      .legal p,
      .contact-list p,
      .landing-copy p,
      .preview-card p,
      .result-summary p {
        margin: 0;
        color: var(--text-soft);
        line-height: 1.65;
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
        background: rgba(255,255,255,0.94);
        border: 1px solid rgba(255,255,255,0.82);
        border-radius: 16px;
        padding: 16px;
        font-weight: 800;
        box-shadow: var(--shadow-md);
      }

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
        background:
          radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 26%),
          linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #4f46e5 100%);
        color: white;
        border-radius: 24px;
        padding: 32px;
        box-shadow: var(--shadow-lg);
      }

      .cta h2 {
        margin: 0 0 10px;
        font-size: 31px;
      }

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

      .faq-grid {
        display: grid;
        gap: 14px;
      }

      .faq-item {
        background: rgba(255,255,255,0.94);
        border: 1px solid rgba(255,255,255,0.82);
        border-radius: 16px;
        padding: 18px;
        box-shadow: var(--shadow-md);
      }

      .faq-item h3 {
        margin: 0 0 8px;
        font-size: 18px;
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

      .result-card h1,
      .landing-copy h1 {
        font-size: 38px;
        margin-bottom: 12px;
      }

      .result-card p {
        color: var(--text-soft);
        line-height: 1.65;
      }

      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
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
        background: rgba(248,250,252,0.95);
        border: 1px solid var(--line);
        font-size: 13px;
        font-weight: 800;
        color: var(--text);
      }

      .result-grid {
        display: grid;
        grid-template-columns: 360px 1fr;
        gap: 20px;
        margin-top: 24px;
      }

      .result-meta {
        display: grid;
        gap: 18px;
        align-content: start;
      }

      .meta-list {
        display: grid;
        gap: 10px;
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

      .preview-shell {
        display: grid;
        gap: 18px;
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

      .tips-list {
        display: grid;
        gap: 10px;
      }

      .tips-list p {
        padding-left: 2px;
      }

      @media (max-width: 980px) {
        .hero-grid,
        .cards-3,
        .cards-2,
        .use-grid,
        .landing-section-grid,
        .result-grid {
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

        .nav-links {
          border-radius: 18px;
        }

        .preview-frame {
          height: 560px;
        }
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
            <a href="/pdf-to-4x6-label">PDF to 4x6</a>
            <a href="/shipping-label-to-4x6">Shipping Label to 4x6</a>
            <a href="/thermal-label-converter">Thermal Label Converter</a>
          </div>
        </footer>
      </div>
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

  return { pageCount: 1 };
}

async function pdfTo4x6(inputPath, outputPath, mode = 'fit') {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const existingPdf = await PDFDocument.load(existingPdfBytes);
  const newPdf = await PDFDocument.create();

  const pageIndices = existingPdf.getPageIndices();
  const copiedPages = await newPdf.copyPages(existingPdf, pageIndices);

  for (const copiedPage of copiedPages) {
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
  }

  const pdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);

  return { pageCount: copiedPages.length };
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
  <url><loc>${SITE_URL}/pdf-to-4x6-label</loc></url>
  <url><loc>${SITE_URL}/shipping-label-to-4x6</loc></url>
  <url><loc>${SITE_URL}/thermal-label-converter</loc></url>
  <url><loc>${SITE_URL}/pdf-to-thermal-printer</loc></url>
  <url><loc>${SITE_URL}/amazon-return-label-to-thermal-printer</loc></url>
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
              Upload a PDF, JPG, or PNG label and turn it into a cleaner thermal-printer-ready PDF with preview before download.
            </p>

            <div class="hero-points">
              <div class="hero-point">
                <strong>Built for shipping labels</strong>
                <span>Made for 4x6 thermal printing instead of generic file conversion.</span>
              </div>
              <div class="hero-point">
                <strong>Fast upload and review</strong>
                <span>Simple browser-based flow with no account required in this version.</span>
              </div>
              <div class="hero-point">
                <strong>Multi-page PDF support</strong>
                <span>PDF uploads now convert all pages instead of stopping at page one.</span>
              </div>
              <div class="hero-point">
                <strong>Preview before download</strong>
                <span>Review the converted PDF on screen before you save or print it.</span>
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
                  <small>Keeps the full label visible and scales it to fit inside each 4x6 page.</small>
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
                PDF uploads now convert all pages into a multi-page 4x6 PDF.
              </div>
            </form>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">How it works</h2>
        <p class="section-subtitle">
          PDF to Thermal is designed to keep the process simple: upload your label, choose a conversion mode, convert it to 4x6, preview the result, then download the finished PDF.
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
            <h3>Preview and download</h3>
            <p>Review the converted PDF, then download and print it on your 4x6 thermal label printer.</p>
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
            <h3>Better workflow confidence</h3>
            <p>
              You can now preview the converted PDF before downloading it, which makes it easier to catch sizing or layout issues before printing.
            </p>
          </div>
        </div>
      </section>

      <section class="cta">
        <h2>Fix your shipping label in seconds</h2>
        <p>
          Upload your file, choose the best fit mode, preview the result, and download a cleaner PDF for your thermal printer.
        </p>
        <a class="btn" href="/">Start with a label upload</a>
      </section>
    `
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
    const originalUrl = `/downloads/${encodeURIComponent(path.basename(inputPath))}`;
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
      // Keep original upload around temporarily so it can be opened from the results page.
  }
});

app.listen(PORT, () => {
  console.log(`PDF to Thermal running on port ${PORT}`);
});
