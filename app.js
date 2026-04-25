const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const PDFLib = require('pdf-lib');

const PDFDocument = PDFLib.PDFDocument;
const degrees = PDFLib.degrees;

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://pdftothermal.com';
const SUPPORT_EMAIL = 'support@pdftothermal.com';
const GA_ID = 'G-XCBKTHSF8B';

app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach(function (dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function cleanupOldFiles(dir, maxAgeMs) {
  const maxAge = maxAgeMs || 1000 * 60 * 60;
  try {
    const now = Date.now();
    const files = fs.readdirSync(dir);
    files.forEach(function (file) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile() && now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
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
      .slice(0, 80);

    cb(null, String(Date.now()) + '-' + base + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.indexOf(ext) === -1) {
      return cb(new Error('Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG.'));
    }
    cb(null, true);
  }
});

app.use('/downloads', express.static(downloadsDir));
app.use('/uploads', express.static(uploadsDir));

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function canonicalUrlFor(pathName) {
  return SITE_URL + (pathName === '/' ? '' : pathName);
}

function renderFooterLinks() {
  return [
    '<a href="/">Home</a>',
    '<a href="/about">About</a>',
    '<a href="/articles">Articles</a>',
    '<a href="/faq">FAQ</a>',
    '<a href="/privacy">Privacy</a>',
    '<a href="/terms">Terms</a>',
    '<a href="/contact">Contact</a>',
    '<a href="/usps-label-to-4x6">USPS</a>',
    '<a href="/ups-label-to-4x6">UPS</a>',
    '<a href="/fedex-label-to-4x6">FedEx</a>',
    '<a href="/amazon-return-label-to-4x6">Amazon Returns</a>',
    '<a href="/ebay-label-to-4x6">eBay</a>',
    '<a href="/etsy-label-to-4x6">Etsy</a>',
    '<a href="/pdf-to-4x6-label">PDF to 4x6</a>',
    '<a href="/shipping-label-to-4x6">Shipping Label to 4x6</a>',
    '<a href="/thermal-label-converter">Thermal Label Converter</a>',
    '<a href="/pdf-to-thermal-printer">PDF to Thermal Printer</a>',
    '<a href="/amazon-return-label-to-thermal-printer">Amazon Return Label to Thermal Printer</a>'
  ].join('\n');
}

function pageTemplate(opts) {
  const title = opts.title || 'PDF to Thermal';
  const description = opts.description || 'Convert shipping labels to 4x6 thermal format.';
  const canonicalPath = opts.canonicalPath || '/';
  const content = opts.content || '';
  const extraHead = opts.extraHead || '';
  const bottomScript = opts.bottomScript || '';
  const canonicalUrl = canonicalUrlFor(canonicalPath);

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <title>' + escapeHtml(title) + '</title>',
    '  <meta name="description" content="' + escapeHtml(description) + '" />',
    '  <link rel="canonical" href="' + escapeHtml(canonicalUrl) + '" />',
    '  <meta name="robots" content="index,follow" />',
    '  <meta property="og:title" content="' + escapeHtml(title) + '" />',
    '  <meta property="og:description" content="' + escapeHtml(description) + '" />',
    '  <meta property="og:type" content="website" />',
    '  <meta property="og:url" content="' + escapeHtml(canonicalUrl) + '" />',
    '  <meta property="og:site_name" content="PDF to Thermal" />',
    '  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '  <script async src="https://www.googletagmanager.com/gtag/js?id=' + GA_ID + '"></script>',
    '  <script>',
    '    window.dataLayer = window.dataLayer || [];',
    '    function gtag(){dataLayer.push(arguments);}',
    '    gtag("js", new Date());',
    '    gtag("config", "' + GA_ID + '");',
    '  </script>',
    extraHead,
    '  <style>',
    '    :root {',
    '      --panel: rgba(255,255,255,0.92);',
    '      --text: #0f172a;',
    '      --text-soft: #475569;',
    '      --line: rgba(148,163,184,0.25);',
    '      --primary: #2563eb;',
    '      --accent: #7c3aed;',
    '      --primary-soft: #dbeafe;',
    '      --accent-soft: #ede9fe;',
    '      --success: #166534;',
    '      --error: #b91c1c;',
    '      --warning: #92400e;',
    '      --warning-bg: #fff7ed;',
    '      --shadow-lg: 0 24px 70px rgba(2, 6, 23, 0.18);',
    '      --shadow-md: 0 12px 34px rgba(15, 23, 42, 0.10);',
    '    }',
    '    * { box-sizing: border-box; }',
    '    html { scroll-behavior: smooth; }',
    '    body {',
    '      margin: 0;',
    '      font-family: Inter, Arial, Helvetica, sans-serif;',
    '      color: var(--text);',
    '      background:',
    '        radial-gradient(circle at 10% 10%, rgba(37,99,235,0.28) 0%, transparent 24%),',
    '        radial-gradient(circle at 90% 10%, rgba(124,58,237,0.22) 0%, transparent 22%),',
    '        radial-gradient(circle at 50% 100%, rgba(59,130,246,0.12) 0%, transparent 30%),',
    '        linear-gradient(180deg, #eef4ff 0%, #f8fbff 42%, #f4f7fb 100%);',
    '      min-height: 100vh;',
    '    }',
    '    a { color: var(--primary); text-decoration: none; }',
    '    a:hover { text-decoration: underline; }',
    '    .shell { position: relative; overflow: hidden; }',
    '    .shell::before {',
    '      content: "";',
    '      position: fixed;',
    '      inset: 0;',
    '      background:',
    '        radial-gradient(circle at 20% 0%, rgba(37,99,235,0.07), transparent 24%),',
    '        radial-gradient(circle at 80% 0%, rgba(124,58,237,0.07), transparent 24%);',
    '      pointer-events: none;',
    '    }',
    '    .container { width: min(1180px, calc(100% - 32px)); margin: 0 auto; position: relative; z-index: 1; }',
    '    .nav { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px 0 12px; }',
    '    .brand { display: inline-flex; align-items: center; gap: 12px; font-weight: 800; color: var(--text); }',
    '    .brand:hover { text-decoration: none; }',
    '    .brand-badge { width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 800; box-shadow: var(--shadow-md); }',
    '    .brand-text { display: flex; flex-direction: column; line-height: 1.05; }',
    '    .brand-text span:first-child { font-size: 16px; }',
    '    .brand-text span:last-child { font-size: 11px; color: var(--text-soft); font-weight: 700; margin-top: 2px; letter-spacing: 0.02em; text-transform: uppercase; }',
    '    .nav-links { display: flex; gap: 18px; flex-wrap: wrap; background: rgba(255,255,255,0.72); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.7); padding: 10px 14px; border-radius: 999px; box-shadow: var(--shadow-md); }',
    '    .nav-links a { color: var(--text-soft); font-weight: 700; font-size: 14px; }',
    '    .hero { padding: 26px 0 20px; }',
    '    .hero-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 24px; align-items: stretch; }',
    '    .hero-card, .card { background: var(--panel); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.85); border-radius: 24px; box-shadow: var(--shadow-lg); }',
    '    .hero-copy { padding: 36px; }',
    '    .eyebrow { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft)); color: var(--primary); border: 1px solid rgba(99,102,241,0.16); padding: 9px 13px; border-radius: 999px; font-size: 13px; font-weight: 800; margin-bottom: 18px; }',
    '    h1 { margin: 0 0 14px; font-size: clamp(40px, 5vw, 62px); line-height: 0.98; letter-spacing: -0.04em; }',
    '    h2, h3 { letter-spacing: -0.03em; }',
    '    .lead { margin: 0 0 22px; color: var(--text-soft); font-size: 18px; line-height: 1.65; max-width: 720px; }',
    '    .hero-points { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 22px 0; }',
    '    .hero-point { background: rgba(248,250,252,0.95); border: 1px solid var(--line); border-radius: 16px; padding: 15px; }',
    '    .hero-point strong { display: block; margin-bottom: 4px; font-size: 15px; }',
    '    .hero-point span { color: var(--text-soft); font-size: 14px; line-height: 1.5; }',
    '    .trust-line { color: var(--text-soft); font-size: 14px; line-height: 1.6; }',
    '    .upload-card { padding: 24px; }',
    '    .upload-card h2 { margin: 0 0 10px; font-size: 27px; }',
    '    .upload-card p { margin: 0 0 18px; color: var(--text-soft); line-height: 1.6; }',
    '    .upload-box { border: 2px dashed rgba(37,99,235,0.28); background: linear-gradient(180deg, rgba(248,251,255,0.95) 0%, rgba(255,255,255,0.9) 100%); border-radius: 18px; padding: 22px; }',
    '    .dropzone { position: relative; border: 1px dashed rgba(99,102,241,0.25); border-radius: 16px; padding: 18px; background: rgba(255,255,255,0.95); transition: border-color 0.15s ease, background 0.15s ease; }',
    '    .dropzone.dragover { border-color: var(--primary); background: rgba(219,234,254,0.55); }',
    '    .upload-box label.main-label { display: block; font-weight: 800; margin-bottom: 10px; }',
    '    input[type="file"] { width: 100%; padding: 13px; border: 1px solid var(--line); border-radius: 14px; background: white; margin-bottom: 14px; }',
    '    button, .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 18px; border-radius: 14px; border: 0; background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; font-weight: 800; cursor: pointer; text-decoration: none; box-shadow: 0 14px 28px rgba(59,130,246,0.20); }',
    '    button:hover, .btn:hover { text-decoration: none; transform: translateY(-1px); }',
    '    .btn.secondary { background: white; color: var(--primary); border: 1px solid rgba(99,102,241,0.18); box-shadow: var(--shadow-md); }',
    '    .btn.ghost { background: rgba(255,255,255,0.55); color: var(--text); border: 1px solid var(--line); box-shadow: none; }',
    '    .microcopy { margin-top: 12px; color: var(--text-soft); font-size: 13px; line-height: 1.5; }',
    '    .mode-box { margin: 14px 0 16px; padding: 14px; background: white; border: 1px solid var(--line); border-radius: 14px; }',
    '    .mode-box-title { display: block; font-weight: 800; margin-bottom: 10px; }',
    '    .mode-option { display: block; margin-bottom: 10px; color: var(--text); font-size: 14px; }',
    '    .mode-option:last-child { margin-bottom: 0; }',
    '    .mode-option small { display: block; color: var(--text-soft); margin-left: 24px; margin-top: 3px; line-height: 1.45; }',
    '    .selected-file { display: none; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(219,234,254,0.55); border: 1px solid rgba(99,102,241,0.14); color: var(--text); font-size: 14px; font-weight: 700; }',
    '    .selected-file small { display: block; color: var(--text-soft); font-weight: 600; margin-top: 4px; }',
    '    .section { padding: 20px 0; }',
    '    .section-title { margin: 0 0 16px; font-size: 31px; }',
    '    .section-subtitle { margin: 0 0 24px; color: var(--text-soft); line-height: 1.65; max-width: 760px; }',
    '    .cards-3, .cards-2, .article-grid, .result-grid { display: grid; gap: 18px; }',
    '    .cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }',
    '    .cards-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
    '    .article-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }',
    '    .result-grid { grid-template-columns: 360px 1fr; margin-top: 24px; }',
    '    .step-card, .info-card, .faq-item, .article-card, .preview-card, .result-summary { background: rgba(255,255,255,0.95); border: 1px solid rgba(255,255,255,0.85); border-radius: 18px; padding: 22px; box-shadow: var(--shadow-md); }',
    '    .step-number { width: 36px; height: 36px; border-radius: 999px; background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft)); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; font-weight: 800; margin-bottom: 12px; }',
    '    .step-card h3, .info-card h3, .faq-item h3, .article-card h3, .preview-card h3, .result-summary h3 { margin: 0 0 8px; font-size: 19px; }',
    '    .step-card p, .info-card p, .faq-item p, .article-card p, .preview-card p, .result-summary p, .result-card p { margin: 0; color: var(--text-soft); line-height: 1.65; }',
    '    .article-card-meta, .button-row, .badge-row { display: flex; flex-wrap: wrap; gap: 10px; }',
    '    .button-row { margin-top: 22px; }',
    '    .badge { display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; background: rgba(248,250,252,0.95); border: 1px solid var(--line); font-size: 13px; font-weight: 800; color: var(--text); }',
    '    .warning-box { margin-top: 18px; padding: 14px; border: 1px solid #fed7aa; background: var(--warning-bg); border-radius: 14px; color: var(--warning); line-height: 1.6; font-size: 14px; }',
    '    .cta { margin: 20px 0 34px; background: radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #4f46e5 100%); color: white; border-radius: 24px; padding: 32px; box-shadow: var(--shadow-lg); }',
    '    .cta h2 { margin: 0 0 10px; font-size: 31px; }',
    '    .cta p { margin: 0 0 18px; color: rgba(255,255,255,0.84); line-height: 1.7; max-width: 760px; }',
    '    .cta .btn { background: white; color: var(--primary); box-shadow: none; }',
    '    .footer { padding: 26px 0 48px; color: var(--text-soft); font-size: 14px; }',
    '    .footer-links { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; }',
    '    .result-card { max-width: 1180px; margin: 44px auto; padding: 30px; }',
    '    .status { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 8px 12px; font-weight: 800; margin-bottom: 16px; }',
    '    .status.success { background: #ecfdf3; color: var(--success); border: 1px solid #bbf7d0; }',
    '    .status.error { background: #fef2f2; color: var(--error); border: 1px solid #fecaca; }',
    '    .meta-list { display: grid; gap: 10px; }',
    '    .meta-row { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; padding: 10px 0; border-bottom: 1px dashed rgba(148,163,184,0.24); }',
    '    .meta-row:last-child { border-bottom: 0; padding-bottom: 0; }',
    '    .meta-key { font-size: 13px; color: var(--text-soft); font-weight: 700; }',
    '    .meta-value { font-size: 14px; font-weight: 800; color: var(--text); text-align: right; word-break: break-word; }',
    '    .preview-frame { width: 100%; height: 760px; border: 1px solid rgba(148,163,184,0.25); border-radius: 16px; background: #f8fafc; }',
    '    .preview-tip { margin-top: 12px; font-size: 13px; color: var(--text-soft); }',
    '    .not-found { max-width: 760px; margin: 50px auto; padding: 30px; }',
    '    @media (max-width: 980px) {',
    '      .hero-grid, .cards-3, .cards-2, .article-grid, .result-grid { grid-template-columns: 1fr; }',
    '      .hero-copy, .upload-card { padding: 24px; }',
    '      .hero-points { grid-template-columns: 1fr; }',
    '      .nav { flex-direction: column; align-items: flex-start; }',
    '      .nav-links { border-radius: 18px; }',
    '      .preview-frame { height: 560px; }',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="shell">',
    '    <div class="container">',
    '      <header class="nav">',
    '        <a class="brand" href="/">',
    '          <span class="brand-badge">PT</span>',
    '          <span class="brand-text"><span>PDF to Thermal</span><span>4x6 label converter</span></span>',
    '        </a>',
    '        <nav class="nav-links">',
    '          <a href="/">Home</a>',
    '          <a href="/about">About</a>',
    '          <a href="/articles">Articles</a>',
    '          <a href="/faq">FAQ</a>',
    '          <a href="/privacy">Privacy</a>',
    '          <a href="/terms">Terms</a>',
    '          <a href="/contact">Contact</a>',
    '        </nav>',
    '      </header>',
    content,
    '      <footer class="footer">',
    '        <div>PDF to Thermal helps turn shipping labels into 4x6 thermal-printer-ready files.</div>',
    '        <div class="footer-links">',
    renderFooterLinks(),
    '        </div>',
    '      </footer>',
    '    </div>',
    '  </div>',
    bottomScript,
    '</body>',
    '</html>'
  ].join('\n');
}

function bytesToReadable(bytes) {
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

app.get('/healthz', function (_req, res) {
  res.status(200).send('ok');
});

app.get('/robots.txt', function (_req, res) {
  res.type('text/plain');
  res.send('User-agent: *\nAllow: /\n\nSitemap: ' + SITE_URL + '/sitemap.xml');
});

app.get('/sitemap.xml', function (_req, res) {
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
    '/amazon-return-label-to-thermal-printer'
  ].concat(allArticles.map(function (article) {
    return '/articles/' + article.slug;
  }));

  res.type('application/xml');
  res.send([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.map(function (url) {
      return '  <url><loc>' + SITE_URL + (url === '/' ? '' : url) + '</loc></url>';
    }).join('\n'),
    '</urlset>'
  ].join('\n'));
});

app.get('/favicon.svg', function (_req, res) {
  res.type('image/svg+xml');
  res.send([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    '  <defs>',
    '    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">',
    '      <stop offset="0%" stop-color="#2563eb"/>',
    '      <stop offset="100%" stop-color="#60a5fa"/>',
    '    </linearGradient>',
    '  </defs>',
    '  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#g)"/>',
    '  <text x="32" y="38" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ffffff">PT</text>',
    '</svg>'
  ].join('\n'));
});

app.get('/', function (_req, res) {
  res.send(pageTemplate({
    title: 'PDF to Thermal | Convert Shipping Labels to 4x6 Thermal Format',
    description: 'Upload a PDF, JPG, or PNG shipping label and convert it into a 4x6 thermal-printer-ready PDF.',
    canonicalPath: '/',
    content: [
      '<section class="hero">',
      '  <div class="hero-grid">',
      '    <div class="hero-card hero-copy">',
      '      <div class="eyebrow">4x6 label conversion made simple</div>',
      '      <h1>Convert shipping labels to 4x6 thermal format</h1>',
      '      <p class="lead">Upload a PDF, JPG, or PNG label and turn it into a cleaner thermal-printer-ready PDF with preview before download.</p>',
      '      <div class="hero-points">',
      '        <div class="hero-point"><strong>Built for shipping labels</strong><span>Made for 4x6 thermal printing instead of generic file conversion.</span></div>',
      '        <div class="hero-point"><strong>Fast upload and review</strong><span>Simple browser-based flow with no account required.</span></div>',
      '        <div class="hero-point"><strong>Multi-page PDF support</strong><span>PDF uploads convert all pages instead of stopping at page one.</span></div>',
      '        <div class="hero-point"><strong>Preview before download</strong><span>Review the converted PDF on screen before you save or print it.</span></div>',
      '      </div>',
      '      <div class="trust-line">Works best for common shipping workflows where you need a simple 4x6 output for a thermal label printer.</div>',
      '    </div>',
      '    <div class="hero-card upload-card">',
      '      <h2>Upload your label</h2>',
      '      <p>Choose a conversion mode based on whether you want to preserve the full label, fill the page more tightly, or auto-rotate a wide label.</p>',
      '      <form action="/convert" method="POST" enctype="multipart/form-data" class="upload-box" id="uploadForm">',
      '        <div class="dropzone" id="dropzone">',
      '          <label class="main-label" for="labelFile">Select a file or drag it here</label>',
      '          <input id="labelFile" type="file" name="labelFile" accept=".pdf,.png,.jpg,.jpeg" required />',
      '          <div id="selectedFile" class="selected-file"></div>',
      '        </div>',
      '        <div class="mode-box">',
      '          <span class="mode-box-title">Conversion mode</span>',
      '          <label class="mode-option">',
      '            <input type="radio" name="mode" value="fit" checked />',
      '            Fit entire label',
      '            <small>Keeps the full label visible and scales it to fit inside each 4x6 page.</small>',
      '          </label>',
      '          <label class="mode-option">',
      '            <input type="radio" name="mode" value="fill" />',
      '            Crop tighter to fill 4x6',
      '            <small>Fills more of the page and may crop some outer edges.</small>',
      '          </label>',
      '          <label class="mode-option">',
      '            <input type="radio" name="mode" value="autorotate" />',
      '            Rotate for best fit',
      '            <small>Automatically rotates wide labels when that should fit better on 4x6.</small>',
      '          </label>',
      '        </div>',
      '        <button type="submit">Upload and Convert</button>',
      '        <div class="microcopy">',
      '          Supported file types: PDF, PNG, JPG, JPEG.<br />',
      '          Max upload size: 15 MB.<br />',
      '          PDF uploads convert all pages into a multi-page 4x6 PDF.',
      '        </div>',
      '      </form>',
      '    </div>',
      '  </div>',
      '</section>',
      '<section class="section">',
      '  <h2 class="section-title">How it works</h2>',
      '  <p class="section-subtitle">Upload your label, choose a conversion mode, preview the result, then download the finished PDF.</p>',
      '  <div class="cards-3">',
      '    <div class="step-card"><div class="step-number">1</div><h3>Upload your file</h3><p>Use a PDF, JPG, PNG, or JPEG shipping label from your computer or phone.</p></div>',
      '    <div class="step-card"><div class="step-number">2</div><h3>Choose your mode</h3><p>Select fit, fill, or auto-rotate depending on how you want the label placed on the page.</p></div>',
      '    <div class="step-card"><div class="step-number">3</div><h3>Preview and download</h3><p>Review the converted PDF, then download and print it on your 4x6 thermal label printer.</p></div>',
      '  </div>',
      '</section>',
      '<section class="section">',
      '  <h2 class="section-title">Built for common label problems</h2>',
      '  <p class="section-subtitle">Many labels arrive in awkward PDFs or image formats that do not line up well with a thermal printer.</p>',
      '  <div class="cards-3">',
      '    <div class="info-card"><h3>USPS</h3><p>Convert common USPS labels into cleaner 4x6 output.</p></div>',
      '    <div class="info-card"><h3>UPS</h3><p>Handle page-size mismatches before you print.</p></div>',
      '    <div class="info-card"><h3>FedEx</h3><p>Normalize label layouts for thermal printers.</p></div>',
      '  </div>',
      '</section>',
      '<section class="section">',
      '  <h2 class="section-title">Read before you print</h2>',
      '  <div class="article-grid">',
      allArticles.slice(0, 6).map(function (article) {
        return '<article class="article-card"><div class="article-card-meta"><span class="badge">' + escapeHtml(article.category) + '</span><span class="badge">' + escapeHtml(article.readTime) + '</span></div><h3>' + escapeHtml(article.title) + '</h3><p>' + escapeHtml(article.description) + '</p><div class="button-row"><a class="btn secondary" href="/articles/' + escapeHtml(article.slug) + '">Read Article</a></div></article>';
      }).join(''),
      '  </div>',
      '</section>',
      '<section class="cta">',
      '  <h2>Fix your shipping label in seconds</h2>',
      '  <p>Upload your file, choose the best fit mode, preview the result, and download a cleaner PDF for your thermal printer.</p>',
      '  <a class="btn" href="#uploadForm">Start with a label upload</a>',
      '</section>'
    ].join('\n'),
    bottomScript: [
      '<script>',
      '(function () {',
      '  const fileInput = document.getElementById("labelFile");',
      '  const selectedFile = document.getElementById("selectedFile");',
      '  const dropzone = document.getElementById("dropzone");',
      '  if (!fileInput || !selectedFile || !dropzone) return;',
      '  function bytesToReadableClient(bytes) {',
      '    if (!bytes) return "Unknown size";',
      '    const units = ["B", "KB", "MB", "GB"];',
      '    let value = bytes;',
      '    let unitIndex = 0;',
      '    while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1; }',
      '    return (value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)) + " " + units[unitIndex];',
      '  }',
      '  function setFileDisplay(file) {',
      '    if (!file) { selectedFile.style.display = "none"; selectedFile.innerHTML = ""; return; }',
      '    selectedFile.style.display = "block";',
      '    selectedFile.innerHTML = "<strong>Selected file:</strong> " + file.name.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "<small>" + bytesToReadableClient(file.size) + "</small>";',
      '  }',
      '  fileInput.addEventListener("change", function () {',
      '    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;',
      '    setFileDisplay(file);',
      '  });',
      '  ["dragenter", "dragover"].forEach(function (eventName) {',
      '    dropzone.addEventListener(eventName, function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.add("dragover"); });',
      '  });',
      '  ["dragleave", "drop"].forEach(function (eventName) {',
      '    dropzone.addEventListener(eventName, function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("dragover"); });',
      '  });',
      '  dropzone.addEventListener("drop", function (e) {',
      '    const files = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : null;',
      '    if (!files || !files.length) return;',
      '    fileInput.files = files;',
      '    setFileDisplay(files[0]);',
      '  });',
      '})();',
      '</script>'
    ].join('\n')
  }));
});

app.get('/about', function (_req, res) {
  res.send(renderSimplePage(
    '/about',
    'About | PDF to Thermal',
    'Learn what PDF to Thermal is built for and who it helps.',
    'About PDF to Thermal',
    '<p>PDF to Thermal is a focused 4x6 label conversion tool. It exists to solve one recurring problem: shipping labels often arrive in formats that are annoying to print on thermal label stock.</p><p>Instead of acting like a giant all-purpose file converter, PDF to Thermal is designed around shipping, returns, and seller workflows where clean 4x6 output matters.</p><div class="cards-2" style="margin-top:18px;"><div class="info-card"><h3>Who it helps</h3><p>Marketplace sellers, home businesses, return-heavy workflows, and anyone who wants a cleaner 4x6 print path for PDF or image labels.</p></div><div class="info-card"><h3>What it focuses on</h3><p>Fast upload, simple conversion modes, multi-page PDF support, preview before download, and fewer layout headaches before printing.</p></div></div>'
  ));
});

app.get('/articles', function (_req, res) {
  res.send(pageTemplate({
    title: 'Articles | PDF to Thermal',
    description: 'Guides, comparisons, and troubleshooting articles for 4x6 shipping labels and thermal printing.',
    canonicalPath: '/articles',
    content: '<section class="section"><div class="card" style="padding:28px;"><h1>Shipping label and thermal printing articles</h1><p class="lead">Browse practical guides, comparisons, and troubleshooting articles built around 4x6 shipping label workflows.</p><div class="badge-row"><span class="badge">' + allArticles.length + ' articles</span><span class="badge">Buyer guides</span><span class="badge">Troubleshooting</span><span class="badge">How-to workflows</span></div></div></section><section class="section"><div class="article-grid">' + allArticles.map(function (article) {
      return '<article class="article-card"><div class="article-card-meta"><span class="badge">' + escapeHtml(article.category) + '</span><span class="badge">' + escapeHtml(article.readTime) + '</span></div><h3>' + escapeHtml(article.title) + '</h3><p>' + escapeHtml(article.description) + '</p><div class="button-row"><a class="btn secondary" href="/articles/' + escapeHtml(article.slug) + '">Read Article</a></div></article>';
    }).join('') + '</div></section>'
  }));
});

allArticles.forEach(function (article) {
  app.get('/articles/' + article.slug, function (_req, res) {
    res.send(articlePageHtml(article));
  });
});

function addSimpleContentRoute(routePath, pageTitle, pageDescription, heading, html) {
  app.get(routePath, function (_req, res) {
    res.send(renderSimplePage(routePath, pageTitle, pageDescription, heading, html));
  });
}

addSimpleContentRoute('/faq', 'FAQ | PDF to Thermal', 'Frequently asked questions about PDF to Thermal.', 'Frequently asked questions',
  '<div class="cards-2"><div class="faq-item"><h3>What file types can I upload?</h3><p>PDF, PNG, JPG, and JPEG are supported in the current version.</p></div><div class="faq-item"><h3>What size is the output?</h3><p>The tool creates a 4x6 PDF intended for common thermal label printers.</p></div><div class="faq-item"><h3>Does it convert every page in a PDF now?</h3><p>Yes. PDF uploads are converted page by page into a multi-page 4x6 PDF output.</p></div><div class="faq-item"><h3>Can I preview the result before downloading?</h3><p>Yes. The completion page includes an on-screen PDF preview.</p></div><div class="faq-item"><h3>What does Crop tighter to fill 4x6 do?</h3><p>It scales more aggressively so the label fills more of the page, which can crop edges slightly.</p></div><div class="faq-item"><h3>What does Rotate for best fit do?</h3><p>It rotates wide image labels, and attempts a better fit for wide PDF pages as well.</p></div></div>'
);

addSimpleContentRoute('/privacy', 'Privacy Policy | PDF to Thermal', 'Privacy information for PDF to Thermal.', 'Privacy Policy',
  '<div class="cards-2"><div class="info-card"><h3>Uploaded files</h3><p>PDF to Thermal temporarily processes files you upload in order to generate a converted 4x6 output file.</p></div><div class="info-card"><h3>Storage</h3><p>Uploaded files and generated outputs are stored for a limited period to allow processing and download, then are cleaned up automatically as part of normal site operation.</p></div><div class="info-card"><h3>Sensitive documents</h3><p>Do not upload highly sensitive, confidential, or regulated documents.</p></div><div class="info-card"><h3>Questions</h3><p>If you have privacy questions, contact <strong>' + escapeHtml(SUPPORT_EMAIL) + '</strong>.</p></div></div>'
);

addSimpleContentRoute('/terms', 'Terms | PDF to Thermal', 'Terms of use for PDF to Thermal.', 'Terms of Use',
  '<div class="cards-2"><div class="info-card"><h3>Service basis</h3><p>PDF to Thermal is provided on an as-is, as-available basis.</p></div><div class="info-card"><h3>Uploads</h3><p>You agree not to upload unlawful content, malicious files, or material you do not have the right to process.</p></div><div class="info-card"><h3>Your responsibility</h3><p>You are responsible for reviewing converted output before using it for shipment or business operations.</p></div><div class="info-card"><h3>Support</h3><p>Questions about these terms can be directed to <strong>' + escapeHtml(SUPPORT_EMAIL) + '</strong>.</p></div></div>'
);

addSimpleContentRoute('/contact', 'Contact | PDF to Thermal', 'Contact PDF to Thermal.', 'Contact',
  '<div class="cards-2"><div class="info-card"><h3>Email</h3><p><strong>' + escapeHtml(SUPPORT_EMAIL) + '</strong></p></div><div class="info-card"><h3>Best info to include</h3><p>Your file type, selected mode, and what happened after upload.</p></div></div>'
);

addSimpleContentRoute('/usps-label-to-4x6', 'USPS Label to 4x6 | PDF to Thermal', 'Convert a USPS shipping label into a 4x6 thermal-printer-ready PDF.', 'Convert USPS labels to 4x6',
  '<p>Use PDF to Thermal to turn USPS labels into a cleaner 4x6 PDF for thermal printing.</p>'
);

addSimpleContentRoute('/ups-label-to-4x6', 'UPS Label to 4x6 | PDF to Thermal', 'Convert a UPS shipping label into a 4x6 thermal-printer-ready PDF.', 'Convert UPS labels to 4x6',
  '<p>UPS labels often print more cleanly when the source file is normalized to 4x6 first.</p>'
);

addSimpleContentRoute('/fedex-label-to-4x6', 'FedEx Label to 4x6 | PDF to Thermal', 'Convert a FedEx shipping label into a 4x6 thermal-printer-ready PDF.', 'Convert FedEx labels to 4x6',
  '<p>FedEx labels can be easier to print when the final PDF already matches the physical label stock.</p>'
);

addSimpleContentRoute('/amazon-return-label-to-4x6', 'Amazon Return Label to 4x6 | PDF to Thermal', 'Convert an Amazon return label into a 4x6 thermal-printer-ready PDF.', 'Convert Amazon return labels to 4x6',
  '<p>Amazon return labels often arrive in awkward formats. PDF to Thermal helps convert them into cleaner 4x6 output.</p>'
);

addSimpleContentRoute('/ebay-label-to-4x6', 'eBay Label to 4x6 | PDF to Thermal', 'Convert an eBay shipping label into a 4x6 thermal-printer-ready PDF.', 'Convert eBay labels to 4x6',
  '<p>eBay sellers can use PDF to Thermal to create a simpler 4x6 workflow for thermal printers.</p>'
);

addSimpleContentRoute('/etsy-label-to-4x6', 'Etsy Label to 4x6 | PDF to Thermal', 'Convert an Etsy shipping label into a 4x6 thermal-printer-ready PDF.', 'Convert Etsy labels to 4x6',
  '<p>Etsy labels can be converted into cleaner 4x6 PDFs for easier home-business printing.</p>'
);

addSimpleContentRoute('/pdf-to-4x6-label', 'PDF to 4x6 Label Converter | PDF to Thermal', 'Convert a PDF shipping label into a 4x6 thermal-printer-ready PDF.', 'Convert PDF labels to 4x6',
  '<p>If you have a shipping label in PDF form and need it resized for a 4x6 thermal printer, PDF to Thermal is built for that exact job.</p>'
);

addSimpleContentRoute('/shipping-label-to-4x6', 'Shipping Label to 4x6 | PDF to Thermal', 'Convert a shipping label into a 4x6 thermal-printer-ready PDF.', 'Convert shipping labels to 4x6',
  '<p>PDF to Thermal is designed to take shipping labels in common formats and convert them into a cleaner 4x6 layout for thermal printers.</p>'
);

addSimpleContentRoute('/thermal-label-converter', 'Thermal Label Converter | PDF to Thermal', 'Use PDF to Thermal as a thermal label converter for 4x6 printing.', 'Thermal label converter for 4x6 printing',
  '<p>PDF to Thermal is a focused thermal label converter that reformats labels for common 4x6 thermal printer workflows.</p>'
);

addSimpleContentRoute('/pdf-to-thermal-printer', 'PDF to Thermal Printer | PDF to Thermal', 'Convert a PDF shipping label for easier use on a thermal printer.', 'Convert a PDF for thermal printer use',
  '<p>If your PDF label was not created with a 4x6 thermal printer in mind, PDF to Thermal helps reformat it into a more usable output.</p>'
);

addSimpleContentRoute('/amazon-return-label-to-thermal-printer', 'Amazon Return Label to Thermal Printer | PDF to Thermal', 'Convert an Amazon return label for easier printing on a thermal printer.', 'Convert Amazon return labels for thermal printers',
  '<p>Amazon return labels do not always arrive in the ideal format for thermal printers. PDF to Thermal helps bridge that gap with a simple 4x6 workflow.</p>'
);

app.post('/convert', function (req, res, next) {
  upload.single('labelFile')(req, res, function (err) {
    if (err) {
      return res.status(400).send(pageTemplate({
        title: 'Upload Error | PDF to Thermal',
        description: 'Upload error on PDF to Thermal.',
        canonicalPath: '/',
        content: '<div class="card result-card"><div class="status error">Upload error</div><h1>We could not process that upload</h1><p>' + escapeHtml(err.message) + '</p><div class="button-row"><a class="btn" href="/">Back Home</a></div></div>'
      }));
    }
    next();
  });
}, async function (req, res) {
  if (!req.file) {
    return res.status(400).send(pageTemplate({
      title: 'Upload Error | PDF to Thermal',
      description: 'Upload error on PDF to Thermal.',
      canonicalPath: '/',
      content: '<div class="card result-card"><div class="status error">Upload error</div><h1>No file uploaded</h1><p>Please go back and choose a PDF, PNG, JPG, or JPEG file before submitting.</p><div class="button-row"><a class="btn" href="/">Back Home</a></div></div>'
    }));
  }

  cleanupOldFiles(uploadsDir);
  cleanupOldFiles(downloadsDir);

  const mode = req.body.mode || 'fit';
  const inputPath = req.file.path;
  const originalName = req.file.originalname || 'Uploaded file';
  const ext = path.extname(originalName).toLowerCase();
  const outputName = 'converted-' + String(Date.now()) + '.pdf';
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

    const modeLabel = mode === 'fill'
      ? 'Crop tighter to fill 4x6'
      : (mode === 'autorotate' ? 'Rotate for best fit' : 'Fit entire label');

    const pageCount = result && result.pageCount ? result.pageCount : 1;
    const pageMessage = pageCount > 1
      ? 'Your file was processed successfully using <strong>' + escapeHtml(modeLabel) + '</strong>. ' + escapeHtml(String(pageCount)) + ' pages were converted into one multi-page 4x6 PDF.'
      : 'Your file was processed successfully using <strong>' + escapeHtml(modeLabel) + '</strong>. Download the converted PDF and print it on a 4x6 thermal label printer.';

    const previewUrl = '/downloads/' + encodeURIComponent(outputName) + '#toolbar=0&navpanes=0&scrollbar=1';
    const originalUrl = '/uploads/' + encodeURIComponent(path.basename(inputPath));
    const openUrl = '/downloads/' + encodeURIComponent(outputName);
    const croppingWarning = mode === 'fill'
      ? '<div class="warning-box">Fill mode can crop outer edges slightly. Review the preview carefully before printing.</div>'
      : '';

    res.send(pageTemplate({
      title: 'Conversion Complete | PDF to Thermal',
      description: 'File conversion complete on PDF to Thermal.',
      canonicalPath: '/',
      content: [
        '<div class="card result-card">',
        '  <div class="status success">Conversion complete</div>',
        '  <h1>Your 4x6 PDF is ready</h1>',
        '  <p>' + pageMessage + '</p>',
        '  <div class="button-row">',
        '    <a class="btn" href="/downloads/' + escapeHtml(outputName) + '" download>Download 4x6 PDF</a>',
        '    <a class="btn secondary" href="' + escapeHtml(openUrl) + '" target="_blank" rel="noopener">Open PDF in New Tab</a>',
        '    <a class="btn ghost" href="/">Convert Another File</a>',
        '  </div>',
        '  <div class="result-grid">',
        '    <div>',
        '      <div class="result-summary">',
        '        <h3>Conversion details</h3>',
        '        <div class="meta-list">',
        '          <div class="meta-row"><div class="meta-key">Original file</div><div class="meta-value">' + escapeHtml(originalName) + '</div></div>',
        '          <div class="meta-row"><div class="meta-key">File type</div><div class="meta-value">' + escapeHtml(ext.replace('.', '').toUpperCase()) + '</div></div>',
        '          <div class="meta-row"><div class="meta-key">Mode used</div><div class="meta-value">' + escapeHtml(modeLabel) + '</div></div>',
        '          <div class="meta-row"><div class="meta-key">Pages converted</div><div class="meta-value">' + escapeHtml(String(pageCount)) + '</div></div>',
        '          <div class="meta-row"><div class="meta-key">Output</div><div class="meta-value">4x6 PDF</div></div>',
        '        </div>',
        croppingWarning,
        '        <div class="button-row">',
        '          <a class="btn secondary" href="' + escapeHtml(originalUrl) + '" target="_blank" rel="noopener">Open Original Upload</a>',
        '        </div>',
        '      </div>',
        '    </div>',
        '    <div class="preview-card">',
        '      <h3>Preview your converted label</h3>',
        '      <p>Review the output below before downloading or printing.</p>',
        '      <iframe class="preview-frame" src="' + escapeHtml(previewUrl) + '" title="Converted PDF preview"></iframe>',
        '      <div class="preview-tip">If your browser does not show the preview, use the Open PDF in New Tab or download button above.</div>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('\n')
    }));
  } catch (err) {
    console.error(err);
    res.status(500).send(pageTemplate({
      title: 'Conversion Failed | PDF to Thermal',
      description: 'File conversion failed on PDF to Thermal.',
      canonicalPath: '/',
      content: '<div class="card result-card"><div class="status error">Conversion failed</div><h1>Something went wrong</h1><p>' + escapeHtml(err.message || 'Unknown error') + '</p><div class="button-row"><a class="btn" href="/">Try Again</a></div></div>'
    }));
  }
});

app.use(function (_req, res) {
  res.status(404).send(pageTemplate({
    title: 'Page Not Found | PDF to Thermal',
    description: 'The page you requested could not be found.',
    canonicalPath: '/',
    content: '<div class="card not-found"><div class="status error">404</div><h1>Page not found</h1><p>The page you requested does not exist or may have moved.</p><div class="button-row"><a class="btn" href="/">Go Home</a><a class="btn secondary" href="/articles">Browse Articles</a></div></div>'
  }));
});

app.listen(PORT, function () {
  console.log('PDF to Thermal running on port ' + PORT);
});
