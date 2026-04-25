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

for (const dir of [uploadsDir, downloadsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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
    console.error('Cleanup error:', err.message);
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

function bytesToReadable(bytes = 0) {
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
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

    .cards-3, .cards-2, .use-grid, .article-grid, .result-grid {
      display: grid;
      gap: 18px;
    }

    .cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .cards-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .use-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .article-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .result-grid { grid-template-columns: 360px 1fr; margin-top: 24px; }

    .step-card, .info-card, .faq-item, .article-card, .preview-card, .result-summary {
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

    .step-card h3, .info-card h3, .faq-item h3, .article-card h3, .preview-card h3, .result-summary h3 {
      margin: 0 0 8px;
      font-size: 19px;
    }

    .step-card p, .info-card p, .faq-item p, .article-card p, .preview-card p, .result-summary p, .result-card p {
      margin: 0;
      color: var(--text-soft);
      line-height: 1.65;
    }

    .article-card-meta, .button-row, .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .button-row { margin-top: 22px; }

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
      .hero-grid, .cards-3, .cards-2, .use-grid, .article-grid, .result-grid {
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
          <h1>${escapeHtml(heading)}</h1>
          ${bodyHtml}
        </div>
      </section>
    `
  });
}

function renderArticlePage(article) {
  const articlePath = \`/articles/\${article.slug}\`;
  return pageTemplate({
    title: \`\${article.title} | PDF to Thermal\`,
    description: article.description,
    canonicalPath: articlePath,
    content: \`
      <section class="section">
        <div class="card" style="padding:28px;">
          <div class="badge-row">
            <span class="badge">\${escapeHtml(article.category)}</span>
            <span class="badge">\${escapeHtml(article.readTime)}</span>
          </div>
          <h1 style="margin-top:14px;">\${escapeHtml(article.title)}</h1>
          <p class="lead">\${escapeHtml(article.intro)}</p>
        </div>
      </section>

      <section class="section">
        <div class="cards-3">
          \${article.sections.map((section) => \`
            <div class="info-card">
              <h3>\${escapeHtml(section.heading)}</h3>
              \${section.paragraphs.map((p) => \`<p style="margin-bottom:12px;">\${escapeHtml(p)}</p>\`).join('')}
            </div>
          \`).join('')}
        </div>
      </section>

      <section class="cta">
        <h2>Need a cleaner 4x6 label workflow?</h2>
        <p>When awkward file layouts are the real problem, a clean 4x6 conversion step usually saves more time than fighting printer settings over and over.</p>
        <a class="btn" href="/">Use PDF to Thermal</a>
      </section>
    \`
  });
}

const articleTitles = [
  ['best-thermal-printer-for-ebay-sellers', 'Best Thermal Printer for eBay Sellers', 'What eBay sellers should look for in a thermal printer and how to avoid common label-printing headaches.', 'Buyer Guide'],
  ['best-thermal-printer-for-etsy-sellers', 'Best Thermal Printer for Etsy Sellers', 'A practical guide to choosing a thermal printer for Etsy shipping and home-business workflows.', 'Buyer Guide'],
  ['how-to-print-amazon-return-labels-on-4x6', 'How to Print Amazon Return Labels on 4x6', 'How to handle Amazon return labels that do not arrive in a clean 4x6 format.', 'How-To'],
  ['rollo-vs-munbyn', 'Rollo vs Munbyn for Shipping Labels', 'A simple comparison of two popular thermal-printer brands for 4x6 label printing.', 'Comparison'],
  ['pdf-shipping-label-wont-print-on-thermal-printer', 'PDF Shipping Label Won’t Print on a Thermal Printer', 'The most common reasons a PDF label prints badly on a thermal printer and how to fix it.', 'Troubleshooting'],
  ['best-4x6-thermal-labels-for-shipping', 'Best 4x6 Thermal Labels for Shipping', 'What to look for when buying 4x6 thermal labels for shipping workflows.', 'Buyer Guide'],
  ['best-shipping-scale-for-small-business', 'Best Shipping Scale for a Small Business', 'Why a simple shipping scale matters in a small e-commerce workflow.', 'Buyer Guide'],
  ['how-to-print-usps-labels-on-4x6', 'How to Print USPS Labels on 4x6', 'A practical workflow for getting USPS labels onto a 4x6 thermal label.', 'How-To'],
  ['how-to-print-ups-labels-on-4x6', 'How to Print UPS Labels on 4x6', 'How to handle UPS labels that need a better 4x6 printing workflow.', 'How-To'],
  ['how-to-print-fedex-labels-on-4x6', 'How to Print FedEx Labels on 4x6', 'How to get FedEx shipping labels printing cleanly on 4x6 stock.', 'How-To'],
  ['how-to-convert-pdf-label-to-4x6', 'How to Convert a PDF Label to 4x6', 'Why converting a PDF label to 4x6 often solves thermal-printing problems.', 'How-To'],
  ['thermal-printer-vs-inkjet-for-shipping-labels', 'Thermal Printer vs Inkjet for Shipping Labels', 'A simple comparison of thermal and inkjet printing for shipping labels.', 'Comparison'],
  ['common-thermal-label-printing-mistakes', 'Common Thermal Label Printing Mistakes', 'The most common mistakes people make when printing thermal shipping labels.', 'Troubleshooting'],
  ['why-your-label-prints-too-small', 'Why Your Label Prints Too Small', 'Why a shipping label can look tiny on a 4x6 label and what to do about it.', 'Troubleshooting'],
  ['why-your-label-is-sideways', 'Why Your Label Is Printing Sideways', 'What causes sideways labels and when auto-rotate can help.', 'Troubleshooting'],
  ['how-to-fix-cropped-shipping-labels', 'How to Fix Cropped Shipping Labels', 'What causes cropped shipping labels and when to switch away from fill-style scaling.', 'Troubleshooting'],
  ['how-to-print-multi-page-label-pdfs', 'How to Print Multi-Page Label PDFs', 'How to handle label PDFs that contain more than one page.', 'How-To'],
  ['best-label-printers-for-amazon-sellers', 'Best Label Printers for Amazon Sellers', 'What Amazon sellers should prioritize when picking a shipping-label printer.', 'Buyer Guide'],
  ['best-label-printers-for-home-business', 'Best Label Printers for a Home Business', 'How home businesses should think about label-printer selection.', 'Buyer Guide'],
  ['free-tools-to-convert-labels-to-4x6', 'Free Tools to Convert Labels to 4x6', 'What to look for in a free 4x6 label converter.', 'Tools'],
  ['how-to-choose-thermal-printer-label-size', 'How to Choose a Thermal Printer Label Size', 'Why label size matters and why 4x6 is so common for shipping.', 'How-To'],
  ['direct-thermal-vs-thermal-transfer-labels', 'Direct Thermal vs Thermal Transfer Labels', 'A simple explanation of direct thermal and thermal transfer label types.', 'Explainer'],
  ['thermal-printer-setup-checklist', 'Thermal Printer Setup Checklist', 'A simple setup checklist for getting a thermal label printer ready for shipping work.', 'Checklist'],
  ['how-to-test-barcode-readability-before-shipping', 'How to Test Barcode Readability Before Shipping', 'A simple way to reduce the chance of sending out a bad shipping label.', 'How-To'],
  ['best-thermal-printer-for-shopify-sellers', 'Best Thermal Printer for Shopify Sellers', 'What Shopify sellers should prioritize in a 4x6 thermal printer setup.', 'Buyer Guide'],
  ['how-to-print-mercari-labels-on-4x6', 'How to Print Mercari Labels on 4x6', 'A simple workflow for getting Mercari shipping labels ready for thermal printers.', 'How-To'],
  ['how-to-print-poshmark-labels-on-4x6', 'How to Print Poshmark Labels on 4x6', 'How Poshmark sellers can make 4x6 thermal printing easier.', 'How-To'],
  ['small-shipping-station-setup-for-home-sellers', 'Small Shipping Station Setup for Home Sellers', 'How to keep a home shipping station simple, compact, and efficient.', 'Workflow'],
  ['how-to-save-time-printing-shipping-labels', 'How to Save Time Printing Shipping Labels', 'Simple ways to reduce friction when printing a lot of shipping labels.', 'Workflow']
];

const allArticles = articleTitles.map(([slug, title, description, category]) => ({
  slug,
  title,
  description,
  category,
  readTime: '4 min read',
  intro: description,
  sections: [
    {
      heading: 'Why it matters',
      paragraphs: [
        'A clean shipping workflow saves time and reduces waste.',
        'When files, printers, and labels agree with each other, everything becomes easier.'
      ]
    },
    {
      heading: 'What to focus on',
      paragraphs: [
        'Focus on repeatability instead of one lucky successful print.',
        'The goal is a workflow you can trust every day.'
      ]
    },
    {
      heading: 'Where PDF to Thermal fits',
      paragraphs: [
        'Many problems start with awkward source files.',
        'A 4x6 conversion step often removes that friction before printing.'
      ]
    }
  ]
}));

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
                <span>Simple browser-based flow with no account required.</span>
              </div>
              <div class="hero-point">
                <strong>Multi-page PDF support</strong>
                <span>PDF uploads convert all pages instead of stopping at page one.</span>
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
          Upload your label, choose a conversion mode, preview the result, then download the finished PDF.
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
        <h2 class="section-title">Read before you print</h2>
        <div class="article-grid">
          ${allArticles.slice(0, 6).map((article) => `
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
            selectedFile.innerHTML =
              '<strong>Selected file:</strong> ' +
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

app.get('/faq', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/faq',
    title: 'FAQ | PDF to Thermal',
    description: 'Frequently asked questions about PDF to Thermal.',
    heading: 'Frequently asked questions',
    bodyHtml: `
      <div class="cards-2">
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
    `
  }));
});

app.get('/privacy', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/privacy',
    title: 'Privacy Policy | PDF to Thermal',
    description: 'Privacy information for PDF to Thermal.',
    heading: 'Privacy Policy',
    bodyHtml: `
      <div class="cards-2">
        <div class="info-card">
          <h3>Uploaded files</h3>
          <p>PDF to Thermal temporarily processes files you upload in order to generate a converted 4x6 output file.</p>
        </div>
        <div class="info-card">
          <h3>Storage</h3>
          <p>Uploaded files and generated outputs are stored for a limited period, then cleaned up automatically as part of normal site operation.</p>
        </div>
        <div class="info-card">
          <h3>Sensitive documents</h3>
          <p>Do not upload highly sensitive, confidential, or regulated documents.</p>
        </div>
        <div class="info-card">
          <h3>Questions</h3>
          <p>If you have privacy questions, contact <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.</p>
        </div>
      </div>
    `
  }));
});

app.get('/terms', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/terms',
    title: 'Terms | PDF to Thermal',
    description: 'Terms of use for PDF to Thermal.',
    heading: 'Terms of Use',
    bodyHtml: `
      <div class="cards-2">
        <div class="info-card">
          <h3>Service basis</h3>
          <p>PDF to Thermal is provided on an as-is, as-available basis.</p>
        </div>
        <div class="info-card">
          <h3>Uploads</h3>
          <p>You agree not to upload unlawful content, malicious files, or material you do not have the right to process.</p>
        </div>
        <div class="info-card">
          <h3>Your responsibility</h3>
          <p>You are responsible for reviewing converted output before using it for shipment or business operations.</p>
        </div>
        <div class="info-card">
          <h3>Support</h3>
          <p>Questions about these terms can be directed to <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.</p>
        </div>
      </div>
    `
  }));
});

app.get('/contact', (_req, res) => {
  res.send(renderSimplePage({
    pathName: '/contact',
    title: 'Contact | PDF to Thermal',
    description: 'Contact PDF to Thermal.',
    heading: 'Contact',
    bodyHtml: `
      <div class="cards-2">
        <div class="info-card">
          <h3>Email</h3>
          <p><strong>${escapeHtml(SUPPORT_EMAIL)}</strong></p>
        </div>
        <div class="info-card">
          <h3>Best info to include</h3>
          <p>Your file type, selected mode, and what happened after upload.</p>
        </div>
      </div>
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

app.listen(PORT, () => {
  console.log(`PDF to Thermal running on port ${PORT}`);
});
