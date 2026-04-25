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
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
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
  fileFilter: function (_req, file, cb) {
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
        --panel: rgba(255,255,255,0.92);
        --text: #0f172a;
        --text-soft: #475569;
        --line: rgba(148,163,184,0.25);
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
        border-radius: 24px;
        box-shadow: var(--shadow-lg);
      }

      .hero-copy { padding: 36px; }
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
      }

      h1 {
        margin: 0 0 14px;
        font-size: clamp(40px, 5vw, 62px);
        line-height: 0.98;
        letter-spacing: -0.04em;
      }

      h2, h3 { letter-spacing: -0.03em; }

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
        transition: border-color 0.15s ease, background 0.15s ease;
      }

      .dropzone.dragover {
        border-color: var(--primary);
        background: rgba(219,234,254,0.55);
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

      .article-section p:last-child { margin-bottom: 0; }

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

        .hero-copy, .upload-card { padding: 24px; }
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

const articles = [
  {
    slug: 'best-thermal-printer-for-ebay-sellers',
    title: 'Best Thermal Printer for eBay Sellers',
    description: 'What eBay sellers should look for in a thermal printer and how to avoid common label-printing headaches.',
    readTime: '6 min read',
    category: 'Buyer Guide',
    intro: 'eBay sellers usually care about reliable barcode printing, fast repeat workflows, and low operating cost.',
    sections: [
      { heading: 'What matters most', paragraphs: ['For most eBay sellers, print consistency matters more than fancy features.', 'Look for support for standard 4x6 labels, a solid reputation for driver stability, and easy loading.'] },
      { heading: 'What to avoid', paragraphs: ['Avoid buying only on price.', 'The cheapest printer can become the most expensive if it wastes labels or jams often.'] },
      { heading: 'How PDF to Thermal helps', paragraphs: ['Some marketplace labels arrive in awkward formats.', 'PDF to Thermal helps bridge that gap by converting PDF and image labels into a cleaner 4x6 output.'] }
    ]
  },
  {
    slug: 'best-thermal-printer-for-etsy-sellers',
    title: 'Best Thermal Printer for Etsy Sellers',
    description: 'A practical guide to choosing a thermal printer for Etsy shipping and home-business workflows.',
    readTime: '6 min read',
    category: 'Buyer Guide',
    intro: 'Etsy sellers often need a setup that feels simple, tidy, and dependable.',
    sections: [
      { heading: 'Home-business priorities', paragraphs: ['For many Etsy shops, noise, size, and simplicity matter a lot.', 'If you print in bursts rather than all day long, ease of use may matter more than speed.'] },
      { heading: 'Why 4x6 matters', paragraphs: ['A 4x6 format is the most common thermal label size for shipping.', 'That is why a 4x6 conversion tool can be useful even before you buy a printer.'] },
      { heading: 'A cleaner workflow', paragraphs: ['The less time you spend resizing labels manually, the more time you have for products and packing.', 'If you sell from home, simplicity usually wins over complexity.'] }
    ]
  },
  {
    slug: 'how-to-print-amazon-return-labels-on-4x6',
    title: 'How to Print Amazon Return Labels on 4x6',
    description: 'How to handle Amazon return labels that do not arrive in a clean 4x6 format.',
    readTime: '5 min read',
    category: 'How-To',
    intro: 'Amazon return labels are not always ready to print directly on a thermal label printer.',
    sections: [
      { heading: 'Why Amazon labels can be awkward', paragraphs: ['Return labels may arrive as full-page documents instead of tight 4x6 files.', 'The problem is usually not the printer. It is the layout of the source file.'] },
      { heading: 'The practical fix', paragraphs: ['Convert the return label into a 4x6 PDF before printing.', 'Start with Fit mode if you want to preserve the full label.'] },
      { heading: 'What to check before using it', paragraphs: ['Always preview the barcode area, text clarity, and orientation.', 'If the source return file has multiple pages, confirm you are printing the correct page.'] }
    ]
  },
  {
    slug: 'rollo-vs-munbyn',
    title: 'Rollo vs Munbyn for Shipping Labels',
    description: 'A simple comparison of two popular thermal-printer brands for 4x6 label printing.',
    readTime: '7 min read',
    category: 'Comparison',
    intro: 'Rollo and Munbyn are two names that come up often when people shop for thermal printers.',
    sections: [
      { heading: 'What to compare first', paragraphs: ['Compare setup experience, software simplicity, label compatibility, and alignment issues.', 'Those quality-of-life details matter more than marketing language.'] },
      { heading: 'What matters after purchase', paragraphs: ['Reliability, reloading speed, and recovery from a bad print matter long after unboxing.', 'If your label files are inconsistent, a conversion tool may affect your experience as much as the printer itself.'] },
      { heading: 'Where software still matters', paragraphs: ['Even a solid printer can feel frustrating when label source files are badly sized.', 'Cleaner input files usually lead to cleaner results.'] }
    ]
  },
  {
    slug: 'pdf-shipping-label-wont-print-on-thermal-printer',
    title: 'PDF Shipping Label Won’t Print on a Thermal Printer',
    description: 'The most common reasons a PDF label prints badly on a thermal printer and how to fix it.',
    readTime: '5 min read',
    category: 'Troubleshooting',
    intro: 'If a PDF shipping label will not print correctly on a thermal printer, the issue is usually file layout, page size mismatch, orientation, or scaling.',
    sections: [
      { heading: 'The most common causes', paragraphs: ['Many shipping labels are designed for letter-size paper or have unnecessary margins.', 'Another issue is printing software that scales or rotates the page incorrectly.'] },
      { heading: 'How to isolate the problem', paragraphs: ['Check whether the source PDF looks clean.', 'A converted 4x6 PDF is often the quickest way to determine whether the problem is the file or the printer settings.'] },
      { heading: 'A better workflow', paragraphs: ['Normalize labels before printing them.', 'That creates consistency and reduces trial and error.'] }
    ]
  }
];

// Add 20 more lightweight articles to accelerate launch
const extraArticles = [
  ['best-4x6-thermal-labels-for-shipping','Best 4x6 Thermal Labels for Shipping','What to look for when buying 4x6 thermal labels for shipping workflows.','Buyer Guide'],
  ['best-shipping-scale-for-small-business','Best Shipping Scale for a Small Business','Why a simple shipping scale matters in a small e-commerce workflow.','Buyer Guide'],
  ['how-to-print-usps-labels-on-4x6','How to Print USPS Labels on 4x6','A practical workflow for getting USPS labels onto a 4x6 thermal label.','How-To'],
  ['how-to-print-ups-labels-on-4x6','How to Print UPS Labels on 4x6','How to handle UPS labels that need a better 4x6 printing workflow.','How-To'],
  ['how-to-print-fedex-labels-on-4x6','How to Print FedEx Labels on 4x6','How to get FedEx shipping labels printing cleanly on 4x6 stock.','How-To'],
  ['how-to-convert-pdf-label-to-4x6','How to Convert a PDF Label to 4x6','Why converting a PDF label to 4x6 often solves thermal-printing problems.','How-To'],
  ['thermal-printer-vs-inkjet-for-shipping-labels','Thermal Printer vs Inkjet for Shipping Labels','A simple comparison of thermal and inkjet printing for shipping labels.','Comparison'],
  ['common-thermal-label-printing-mistakes','Common Thermal Label Printing Mistakes','The most common mistakes people make when printing thermal shipping labels.','Troubleshooting'],
  ['why-your-label-prints-too-small','Why Your Label Prints Too Small','Why a shipping label can look tiny on a 4x6 label and what to do about it.','Troubleshooting'],
  ['why-your-label-is-sideways','Why Your Label Is Printing Sideways','What causes sideways labels and when auto-rotate can help.','Troubleshooting'],
  ['how-to-fix-cropped-shipping-labels','How to Fix Cropped Shipping Labels','What causes cropped shipping labels and when to switch away from fill-style scaling.','Troubleshooting'],
  ['how-to-print-multi-page-label-pdfs','How to Print Multi-Page Label PDFs','How to handle label PDFs that contain more than one page.','How-To'],
  ['best-label-printers-for-amazon-sellers','Best Label Printers for Amazon Sellers','What Amazon sellers should prioritize when picking a shipping-label printer.','Buyer Guide'],
  ['best-label-printers-for-home-business','Best Label Printers for a Home Business','How home businesses should think about label-printer selection.','Buyer Guide'],
  ['free-tools-to-convert-labels-to-4x6','Free Tools to Convert Labels to 4x6','What to look for in a free 4x6 label converter.','Tools'],
  ['how-to-choose-thermal-printer-label-size','How to Choose a Thermal Printer Label Size','Why label size matters and why 4x6 is so common for shipping.','How-To'],
  ['direct-thermal-vs-thermal-transfer-labels','Direct Thermal vs Thermal Transfer Labels','A simple explanation of direct thermal and thermal transfer label types.','Explainer'],
  ['thermal-printer-setup-checklist','Thermal Printer Setup Checklist','A simple setup checklist for getting a thermal label printer ready for shipping work.','Checklist'],
  ['how-to-test-barcode-readability-before-shipping','How to Test Barcode Readability Before Shipping','A simple way to reduce the chance of sending out a bad shipping label.','How-To'],
  ['best-thermal-printer-for-shopify-sellers','Best Thermal Printer for Shopify Sellers','What Shopify sellers should prioritize in a 4x6 thermal printer setup.','Buyer Guide'],
  ['how-to-print-mercari-labels-on-4x6','How to Print Mercari Labels on 4x6','A simple workflow for getting Mercari shipping labels ready for thermal printers.','How-To'],
  ['how-to-print-poshmark-labels-on-4x6','How to Print Poshmark Labels on 4x6','How Poshmark sellers can make 4x6 thermal printing easier.','How-To'],
  ['small-shipping-station-setup-for-home-sellers','Small Shipping Station Setup for Home Sellers','How to keep a home shipping station simple, compact, and efficient.','Workflow'],
  ['how-to-save-time-printing-shipping-labels','How to Save Time Printing Shipping Labels','Simple ways to reduce friction when printing a lot of shipping labels.','Workflow']
].map(([slug,title,description,category]) => ({
  slug,
  title,
  description,
  readTime: '4 min read',
  category,
  intro: description,
  sections: [
    { heading: 'Why it matters', paragraphs: ['A clean shipping workflow saves time and reduces waste.', 'When files, printers, and labels agree with each other, everything becomes easier.'] },
    { heading: 'What to focus on', paragraphs: ['Focus on repeatability instead of one lucky successful print.', 'The goal is a workflow you can trust every day.'] },
    { heading: 'Where PDF to Thermal fits', paragraphs: ['Many problems start with awkward source files.', 'A 4x6 conversion step often removes that friction before printing.'] }
  ]
}));

const allArticles = [...articles, ...extraArticles];

function renderArticlePage(article) {
  const articlePath = `/articles/${article.slug}`;
  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: { '@type': 'Organization', name: 'PDF to Thermal' },
    publisher: { '@type': 'Organization', name: 'PDF to Thermal' },
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

app.get('/about', (_req, res) => {
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

app.get('/articles', (_req, res) => {
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
              <span class="badge">${allArticles.length} articles</span>
              <span class="badge">Buyer guides</span>
              <span class="badge">Troubleshooting</span>
              <span class="badge">How-to workflows</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="article-grid">
          ${allArticles.map((article) => `
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

for (const article of allArticles) {
  app.get(`/articles/${article.slug}`, (_req, res) => {
    res.send(renderArticlePage(article));
  });
}

app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`);
});

app.get('/sitemap.xml', (_req, res) => {
  const urls = [
    '/',
    '/about',
    '/articles',
    '/faq',
    '/privacy',
    '/terms',
    '/contact',
    '/usps-label-to-4x6',
    '/ups-label-to-4x6',
    '/fedex-label-to-4x6',
    '/amazon-return-label-to-4x6',
    '/ebay-label-to-4x6',
    '/etsy-label-to-4x6',
    '/pdf-to-4x6-label',
    '/shipping-label-to-4x6',
    '/thermal-label-converter',
    '/pdf-to-thermal-printer',
    '/amazon-return-label-to-thermal-printer',
    ...allArticles.map((article) => `/articles/${article.slug}`)
  ];

  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${SITE_URL}${url === '/' ? '' : url}</loc></url>`).join('\n')}
</urlset>`);
});

app.get('/favicon.svg', (_req, res) => {
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

app.get('/', (_req, res) => {
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

            <form action="/convert" method="POST" enctype="multipart/form-data" class="upload-box" id="uploadForm">
              <div class="dropzone" id="dropzone">
                <label class="main-label" for="labelFile">Select a file or drag it here</label>
                <input id="labelFile" type="file" name="labelFile" accept=".pdf,.png,.jpg,.jpeg" required />
                <div id="selectedFile" class="selected-file"></div>
              </div>

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
                PDF uploads convert all pages into a multi-page 4x6 PDF.
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
        <h2 class="section-title">What changed in this update</h2>
        <div class="cards-3">
          <div class="info-card">
            <h3>Article hub</h3>
            <p>${allArticles.length} article pages now support broader SEO and discovery traffic.</p>
          </div>
          <div class="info-card">
            <h3>Drag-and-drop upload</h3>
            <p>The homepage now has a clearer upload workflow with visible selected-file feedback.</p>
          </div>
          <div class="info-card">
            <h3>Results tools</h3>
            <p>Open original file, open result in a new tab, preview before download, and report-bad-conversion links are included.</p>
          </div>
        </div>
      </section>

      <section class="cta">
        <h2>Fix your shipping label in seconds</h2>
        <p>
          Upload your file, choose the best fit mode, preview the result, and download a cleaner PDF for your thermal printer.
        </p>
        <a class="btn" href="#uploadForm">Start with a label upload</a>
      </section>
    `,
    bottomScript: `
      <script>
        (function () {
          const fileInput = document.getElementById('labelFile');
          const selectedFile = document.getElementById('selectedFile');
          const dropzone = document.getElementById('dropzone');

          if (!fileInput || !selectedFile || !dropzone) return;

          function updateSelectedFile(file) {
            if (!file) {
              selectedFile.style.display = 'none';
              selectedFile.innerHTML = '';
              return;
            }

            selectedFile.style.display = 'block';
            selectedFile.innerHTML = '<strong>Selected file:</strong> ' +
              file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
              '<small>' + ${JSON.stringify(bytesToReadable.toString())}(file.size) + '</small>';
          }

          // Override helper because function string call above is not ideal
          function bytesToReadableClient(bytes) {
            if (!bytes) return 'Unknown size';
            const units = ['B', 'KB', 'MB', 'GB'];
            let value = bytes;
            let unitIndex = 0;
            while (value >= 1024 && unitIndex < units.length - 1) {
              value /= 1024;
              unitIndex += 1;
            }
            return (value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)) + ' ' + units[unitIndex];
          }

          function setFileDisplay(file) {
            if (!file) {
              selectedFile.style.display = 'none';
              selectedFile.innerHTML = '';
              return;
            }
            selectedFile.style.display = 'block';
            selectedFile.innerHTML = '<strong>Selected file:</strong> ' +
              file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
              '<small>' + bytesToReadableClient(file.size) + '</small>';
          }

          fileInput.addEventListener('change', function () {
            const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
            setFileDisplay(file);
          });

          ['dragenter', 'dragover'].forEach((eventName) => {
            dropzone.addEventListener(eventName, function (e) {
              e.preventDefault();
              e.stopPropagation();
              dropzone.classList.add('dragover');
            });
          });

          ['dragleave', 'drop'].forEach((eventName) => {
            dropzone.addEventListener(eventName, function (e) {
              e.preventDefault();
              e.stopPropagation();
              dropzone.classList.remove('dragover');
            });
          });

          dropzone.addEventListener('drop', function (e) {
            const files = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : null;
            if (!files || !files.length) return;

            fileInput.files = files;
            setFileDisplay(files[0]);
          });
        })();
      </script>
    `
  }));
});

app.get('/faq', (_req, res) => {
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
              <p>PDF, PNG, JPG, and JPEG are supported.</p>
            </div>
            <div class="faq-item">
              <h3>What size is the output?</h3>
              <p>The tool creates a 4x6 PDF intended for common thermal label printers.</p>
            </div>
            <div class="faq-item">
              <h3>Does it convert every page in a PDF?</h3>
              <p>Yes. PDF uploads are converted page by page into a multi-page 4x6 PDF output.</p>
            </div>
            <div class="faq-item">
              <h3>Can I preview the result before downloading?</h3>
              <p>Yes. The completion page includes an on-screen PDF preview.</p>
            </div>
            <div class="faq-item">
              <h3>Does Fill mode crop?</h3>
              <p>It can. Fill mode increases page coverage and may crop outer edges slightly.</p>
            </div>
            <div class="faq-item">
              <h3>What does Auto Rotate do?</h3>
              <p>It helps wide labels fit better on a portrait 4x6 page.</p>
            </div>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/privacy', (_req, res) => {
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
            <p>Do not upload highly sensitive or regulated documents.</p>
            <p>We use analytics to understand site traffic and improve the product experience.</p>
            <p>If you have privacy questions, contact <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.</p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/terms', (_req, res) => {
  res.send(pageTemplate({
    title: 'Terms | PDF to Thermal',
    description: 'Terms of use for PDF to Thermal.',
    canonicalPath: '/terms',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title">Terms of Use</h1>
          <div class="legal">
            <p>PDF to Thermal is provided on an as-is, as-available basis.</p>
            <p>You agree not to upload unlawful content, malicious files, or material you do not have the right to process.</p>
            <p>You are responsible for reviewing converted output before using it for shipment or business operations.</p>
            <p>Questions about these terms can be directed to <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.</p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/contact', (_req, res) => {
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
            <p>Best things to include: your file type, selected mode, and what happened after upload.</p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/usps-label-to-4x6', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/usps-label-to-4x6',
    title: 'USPS Label to 4x6 | PDF to Thermal',
    description: 'Convert a USPS shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert USPS labels to 4x6',
    bodyHtml: `<p>Use PDF to Thermal to turn USPS labels into a cleaner 4x6 PDF for thermal printing.</p>`
  }));
});

app.get('/ups-label-to-4x6', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/ups-label-to-4x6',
    title: 'UPS Label to 4x6 | PDF to Thermal',
    description: 'Convert a UPS shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert UPS labels to 4x6',
    bodyHtml: `<p>UPS labels often print more cleanly when the source file is normalized to 4x6 first.</p>`
  }));
});

app.get('/fedex-label-to-4x6', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/fedex-label-to-4x6',
    title: 'FedEx Label to 4x6 | PDF to Thermal',
    description: 'Convert a FedEx shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert FedEx labels to 4x6',
    bodyHtml: `<p>FedEx labels can be easier to print when the final PDF already matches the physical label stock.</p>`
  }));
});

app.get('/amazon-return-label-to-4x6', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/amazon-return-label-to-4x6',
    title: 'Amazon Return Label to 4x6 | PDF to Thermal',
    description: 'Convert an Amazon return label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert Amazon return labels to 4x6',
    bodyHtml: `<p>Amazon return labels often arrive in awkward formats. PDF to Thermal helps convert them into cleaner 4x6 output.</p>`
  }));
});

app.get('/ebay-label-to-4x6', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/ebay-label-to-4x6',
    title: 'eBay Label to 4x6 | PDF to Thermal',
    description: 'Convert an eBay shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert eBay labels to 4x6',
    bodyHtml: `<p>eBay sellers can use PDF to Thermal to create a simpler 4x6 workflow for thermal printers.</p>`
  }));
});

app.get('/etsy-label-to-4x6', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/etsy-label-to-4x6',
    title: 'Etsy Label to 4x6 | PDF to Thermal',
    description: 'Convert an Etsy shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert Etsy labels to 4x6',
    bodyHtml: `<p>Etsy labels can be converted into cleaner 4x6 PDFs for easier home-business printing.</p>`
  }));
});

app.get('/pdf-to-4x6-label', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/pdf-to-4x6-label',
    title: 'PDF to 4x6 Label Converter | PDF to Thermal',
    description: 'Convert a PDF shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert PDF labels to 4x6',
    bodyHtml: `<p>If your shipping label is trapped inside a larger PDF page, converting it to a 4x6 output often makes thermal printing easier.</p>`
  }));
});

app.get('/shipping-label-to-4x6', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/shipping-label-to-4x6',
    title: 'Shipping Label to 4x6 | PDF to Thermal',
    description: 'Convert a shipping label into a 4x6 thermal-printer-ready PDF.',
    heading: 'Convert shipping labels to 4x6',
    bodyHtml: `<p>PDF to Thermal is built to help awkward shipping labels fit a standard 4x6 thermal workflow.</p>`
  }));
});

app.get('/thermal-label-converter', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/thermal-label-converter',
    title: 'Thermal Label Converter | PDF to Thermal',
    description: 'Use PDF to Thermal as a thermal label converter for 4x6 printing.',
    heading: 'Thermal label converter for 4x6 printing',
    bodyHtml: `<p>This is a focused thermal label converter for 4x6 shipping label workflows.</p>`
  }));
});

app.get('/pdf-to-thermal-printer', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/pdf-to-thermal-printer',
    title: 'PDF to Thermal Printer | PDF to Thermal',
    description: 'Convert a PDF shipping label for easier use on a thermal printer.',
    heading: 'Convert a PDF for thermal printer use',
    bodyHtml: `<p>When a PDF was not designed for 4x6 stock, converting it before printing is usually the cleaner path.</p>`
  }));
});

app.get('/amazon-return-label-to-thermal-printer', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/amazon-return-label-to-thermal-printer',
    title: 'Amazon Return Label to Thermal Printer | PDF to Thermal',
    description: 'Convert an Amazon return label for easier printing on a thermal printer.',
    heading: 'Convert Amazon return labels for thermal printers',
    bodyHtml: `<p>Amazon return labels can become easier to print when normalized to 4x6 first.</p>`
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

// 404 handler must be last
app.use((req, res) => {
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
  console.log(\`PDF to Thermal running on port \${PORT}\`);
});
