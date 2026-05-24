const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const app = express();

const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://pdftothermal.com';
const SUPPORT_EMAIL = 'support@pdftothermal.com';
const GA_ID = 'G-CV6R7PF4PH';
const AMZ_ID = 'pdftothermal-20';

// Thermal label output settings
const TARGET_WIDTH_POINTS = 288; // 4 inches x 72 PDF points
const TARGET_HEIGHT_POINTS = 432; // 6 inches x 72 PDF points
const TARGET_WIDTH_PIXELS = 1200; // 4 inches x 300 DPI
const TARGET_HEIGHT_PIXELS = 1800; // 6 inches x 300 DPI

// PDF render quality for smart crop
const PDF_RENDER_DENSITY = 240;

// File limits
const MAX_FILE_AGE_MS = 60 * 60 * 1000;
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

// Setup directories
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Express middleware
app.use(express.urlencoded({ extended: true }));
app.use('/downloads', express.static(downloadsDir, {
  maxAge: '1h',
  setHeaders: (res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
}));

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

function getInputKind(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (mime === 'image/png' || ext === '.png') return 'image';
  if (mime === 'image/jpeg' || ext === '.jpg' || ext === '.jpeg') return 'image';
  if (mime === 'image/webp' || ext === '.webp') return 'image';

  return 'unsupported';
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE
  },
  fileFilter: (req, file, cb) => {
    const kind = getInputKind(file);

    if (kind === 'unsupported') {
      return cb(new Error('Only PDF, PNG, JPG, JPEG, and WEBP files are supported right now.'));
    }

    cb(null, true);
  }
});

function handleUpload(req, res, next) {
  upload.single('labelFile')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large. Please upload a PDF or image under 20MB.'
          : err.message || 'Upload failed. Please try again.';

      return res.status(400).send(
        pageTemplate({
          title: 'Upload Error',
          canonicalPath: '/',
          description: 'Upload error while converting a shipping label.',
          content: `
            <div class="card">
              <h1>Upload Error</h1>
              <p>${escapeHtml(message)}</p>
              <a href="/" class="btn">Try Again</a>
            </div>
          `
        })
      );
    }

    next();
  });
}

// Escape helpers
function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safePath(value) {
  const clean = String(value || '/');
  if (!clean.startsWith('/')) return '/';
  return clean.replace(/[^a-zA-Z0-9/_\-?.=&]/g, '');
}

function safeMode(value) {
  const allowedModes = ['smart', 'fit', 'fill', 'autorotate', 'rotate90', 'split2', 'split4'];
  return allowedModes.includes(value) ? value : 'smart';
}

function modeLabel(mode) {
  const labels = {
    smart: 'Smart Crop',
    fit: 'Fit',
    fill: 'Fill',
    autorotate: 'Auto-Rotate',
    rotate90: 'Rotate 90°',
    split2: 'Split Sheet: 2 Labels',
    split4: 'Split Sheet: 4 Labels'
  };

  return labels[mode] || 'Smart Crop';
}

// Clean up old files
function cleanup() {
  const now = Date.now();

  [uploadsDir, downloadsDir].forEach((dir) => {
    try {
      fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);

        try {
          const stat = fs.statSync(filePath);

          if (stat.isFile() && now - stat.mtimeMs > MAX_FILE_AGE_MS) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error(`Cleanup failed for ${filePath}:`, err.message);
        }
      });
    } catch (err) {
      console.error(`Cleanup scan failed for ${dir}:`, err.message);
    }
  });
}

// Google tag: placed immediately after <head>
function googleTag() {
  return `
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', '${GA_ID}');
    </script>
  `;
}

// Analytics event helper for frontend
function analyticsScript() {
  return `
    <script>
      function trackEvent(name, params) {
        if (typeof gtag === 'function') {
          gtag('event', name, params || {});
        }
      }
    </script>
  `;
}

// Master Page Template
function pageTemplate({ title, description, content, canonicalPath = '/' }) {
  const metaDescription =
    description ||
    'Free tool to resize shipping labels into clean 4x6 thermal printer PDFs for Etsy, eBay, Amazon, TikTok Shop, Shopify, USPS, UPS, FedEx, PNG, JPG, and marketplace labels.';

  const cleanCanonical = safePath(canonicalPath);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
${googleTag()}
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escapeHtml(title)} | PDF to Thermal</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <link rel="canonical" href="${SITE_URL}${cleanCanonical}" />

  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --dark: #0f172a;
      --muted: #64748b;
      --light: #f8fafc;
      --border: #e2e8f0;
      --accent: #eff6ff;
      --warning-bg: #fff7ed;
      --warning-border: #ffedd5;
      --success-bg: #ecfdf5;
      --success-border: #bbf7d0;
      --danger-bg: #fef2f2;
      --danger-border: #fecaca;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 30%),
        var(--light);
      color: var(--dark);
      line-height: 1.6;
    }

    .container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 0 20px;
    }

    header {
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      padding: 15px 0;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .logo {
      font-size: 22px;
      font-weight: 900;
      color: var(--primary);
      text-decoration: none;
      white-space: nowrap;
      letter-spacing: -0.04em;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 14px;
    }

    nav a {
      text-decoration: none;
      color: var(--muted);
      font-weight: 800;
      font-size: 14px;
    }

    nav a:hover {
      color: var(--primary);
    }

    main {
      min-height: 70vh;
    }

    .hero {
      padding: 42px 0 8px;
      text-align: center;
    }

    .hero p {
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
    }

    .card {
      background: #ffffff;
      padding: 30px;
      border-radius: 22px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      border: 1px solid var(--border);
      margin-top: 24px;
    }

    .card.compact {
      padding: 22px;
    }

    .btn {
      background: var(--primary);
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 12px;
      text-decoration: none;
      display: inline-block;
      font-weight: 900;
      border: none;
      cursor: pointer;
      font-size: 15px;
      line-height: 1.2;
    }

    .btn:hover {
      background: var(--primary-dark);
    }

    .btn.secondary {
      background: var(--accent);
      color: var(--primary);
    }

    .btn.secondary:hover {
      background: #dbeafe;
    }

    .btn.full {
      width: 100%;
      max-width: 460px;
    }

    .preview-frame {
      width: 100%;
      height: 560px;
      border: 1px solid var(--border);
      border-radius: 14px;
      margin: 20px 0;
      background: #f1f5f9;
    }

    .money-box {
      background: var(--warning-bg);
      border: 1px solid var(--warning-border);
      padding: 20px;
      border-radius: 16px;
      margin-top: 25px;
    }

    .success-box {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      padding: 18px;
      border-radius: 16px;
      margin-top: 18px;
    }

    .danger-box {
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      padding: 18px;
      border-radius: 16px;
      margin-top: 18px;
    }

    .social-row {
      display: flex;
      gap: 10px;
      margin: 20px 0;
      flex-wrap: wrap;
    }

    h1 {
      font-size: 40px;
      line-height: 1.08;
      margin: 0 0 12px;
      letter-spacing: -0.05em;
    }

    h2 {
      font-size: 24px;
      line-height: 1.25;
      margin-top: 28px;
      letter-spacing: -0.03em;
    }

    h3 {
      margin-bottom: 8px;
    }

    p {
      color: #334155;
    }

    .muted {
      color: var(--muted);
    }

    .upload-box {
      margin-top: 20px;
    }

    input[type="file"] {
      width: 100%;
      max-width: 520px;
      padding: 14px;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
      background: var(--light);
      margin-bottom: 18px;
    }

    .mode-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 20px 0;
      text-align: left;
    }

    .mode-card {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      background: #ffffff;
      cursor: pointer;
      min-height: 126px;
    }

    .mode-card:hover {
      border-color: var(--primary);
    }

    .mode-card input {
      margin-right: 6px;
    }

    .mode-title {
      font-weight: 900;
      color: var(--dark);
      display: block;
      margin-bottom: 4px;
    }

    .mode-help {
      color: var(--muted);
      font-size: 13px;
      display: block;
      line-height: 1.35;
    }

    .seo-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 28px;
    }

    .seo-grid a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 800;
      background: #ffffff;
      border: 1px solid var(--border);
      padding: 16px;
      border-radius: 16px;
    }

    .seo-grid a:hover {
      border-color: var(--primary);
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 24px;
    }

    .feature {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
    }

    .feature strong {
      display: block;
      margin-bottom: 6px;
    }

    .steps {
      padding-left: 22px;
    }

    .steps li {
      margin-bottom: 8px;
    }

    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 16px;
    }

    .pill {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 7px 12px;
      color: var(--muted);
      font-weight: 800;
      font-size: 13px;
    }

    footer {
      background: var(--dark);
      color: #ffffff;
      padding: 30px 0;
      text-align: center;
      margin-top: 55px;
      font-size: 13px;
    }

    footer p {
      color: #e2e8f0;
    }

    footer a {
      color: #ffffff;
    }

    @media (max-width: 900px) {
      .mode-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 760px) {
      .header-inner {
        flex-direction: column;
        align-items: flex-start;
      }

      nav {
        justify-content: flex-start;
      }

      h1 {
        font-size: 31px;
      }

      .seo-grid,
      .feature-grid,
      .mode-grid {
        grid-template-columns: 1fr;
      }

      .card {
        padding: 22px;
      }

      .preview-frame {
        height: 430px;
      }
    }
  </style>
${analyticsScript()}
</head>

<body>
  <header>
    <div class="container header-inner">
      <a href="/" class="logo">PDF to Thermal</a>
      <nav>
        <a href="/">Converter</a>
        <a href="/split-label-sheet">Split Sheets</a>
        <a href="/image-to-4x6">Image to 4x6</a>
        <a href="/best-thermal-printers">Best Printers</a>
        <a href="/faq">FAQ</a>
      </nav>
    </div>
  </header>

  <main class="container">
    ${content}
  </main>

  <footer>
    <div class="container">
      <p>&copy; 2026 PDF to Thermal</p>
      <p>
        <a href="/privacy">Privacy</a> |
        <a href="/faq">FAQ</a> |
        <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
      </p>
    </div>
  </footer>
</body>
</html>
  `;
}

// Detect actual non-white area of a rendered page or image
async function detectContentBounds(imageBuffer) {
  const image = sharp(imageBuffer).ensureAlpha();
  const metadata = await image.metadata();

  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error('Could not read image dimensions.');
  }

  const raw = await image.raw().toBuffer();

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let contentPixels = 0;

  const whiteThreshold = 246;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = raw[idx];
      const g = raw[idx + 1];
      const b = raw[idx + 2];
      const a = raw[idx + 3];

      if (a < 15) continue;

      const isWhite = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;

      if (!isWhite) {
        contentPixels += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    return {
      found: false,
      left: 0,
      top: 0,
      width,
      height,
      contentPixels: 0,
      contentRatio: 0
    };
  }

  const padding = Math.max(12, Math.round(Math.min(width, height) * 0.012));

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width - 1, maxX + padding);
  const bottom = Math.min(height - 1, maxY + padding);

  return {
    found: true,
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
    contentPixels,
    contentRatio: contentPixels / (width * height)
  };
}

async function isMeaningfulRegion(imageBuffer) {
  const bounds = await detectContentBounds(imageBuffer);
  return bounds.found && bounds.contentPixels > 900 && bounds.contentRatio > 0.0004;
}

// Prepare one page or image into a 4x6 PNG
async function prepareImageForLabel(imageBuffer, mode) {
  const selectedMode = safeMode(mode);
  let working = sharp(imageBuffer).rotate().flatten({ background: '#ffffff' });

  const metadata = await working.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not process image.');
  }

  if (selectedMode === 'smart') {
    const bounds = await detectContentBounds(await working.png().toBuffer());

    const fullArea = metadata.width * metadata.height;
    const cropArea = bounds.width * bounds.height;
    const shouldCrop = bounds.found && cropArea < fullArea * 0.96;

    if (shouldCrop) {
      working = working.extract({
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      });
    }
  }

  if (selectedMode === 'rotate90') {
    working = working.rotate(90);
  } else {
    const afterCropMeta = await working.metadata();
    const cropWidth = afterCropMeta.width;
    const cropHeight = afterCropMeta.height;
    const isLandscape = cropWidth > cropHeight;

    const shouldAutoRotate =
      (selectedMode === 'smart' && isLandscape) ||
      (selectedMode === 'autorotate' && isLandscape) ||
      (selectedMode === 'fill' && isLandscape);

    if (shouldAutoRotate) {
      working = working.rotate(90);
    }
  }

  const resizeFit = selectedMode === 'fill' ? 'cover' : 'contain';

  return working
    .resize({
      width: TARGET_WIDTH_PIXELS,
      height: TARGET_HEIGHT_PIXELS,
      fit: resizeFit,
      position: 'centre',
      background: '#ffffff'
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toBuffer();
}

async function prepareSplitPieces(renderedPageBuffer, splitMode) {
  const base = sharp(renderedPageBuffer).flatten({ background: '#ffffff' });
  const metadata = await base.metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error('Could not split this page.');
  }

  let regions = [];

  if (splitMode === 'split2') {
    const halfHeight = Math.floor(height / 2);
    regions = [
      { left: 0, top: 0, width, height: halfHeight, name: 'top' },
      { left: 0, top: halfHeight, width, height: height - halfHeight, name: 'bottom' }
    ];
  }

  if (splitMode === 'split4') {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    regions = [
      { left: 0, top: 0, width: halfWidth, height: halfHeight, name: 'top-left' },
      { left: halfWidth, top: 0, width: width - halfWidth, height: halfHeight, name: 'top-right' },
      { left: 0, top: halfHeight, width: halfWidth, height: height - halfHeight, name: 'bottom-left' },
      { left: halfWidth, top: halfHeight, width: width - halfWidth, height: height - halfHeight, name: 'bottom-right' }
    ];
  }

  const pieces = [];

  for (const region of regions) {
    const pieceBuffer = await base
      .clone()
      .extract({
        left: region.left,
        top: region.top,
        width: region.width,
        height: region.height
      })
      .png()
      .toBuffer();

    if (await isMeaningfulRegion(pieceBuffer)) {
      pieces.push(await prepareImageForLabel(pieceBuffer, 'smart'));
    }
  }

  return pieces;
}

async function buildPdfFromPngPages(pngPages, outputPath) {
  if (!pngPages.length) {
    throw new Error('No usable label pages were detected.');
  }

  const newPdf = await PDFDocument.create();

  for (const pngBuffer of pngPages) {
    const embeddedImage = await newPdf.embedPng(pngBuffer);
    const page = newPdf.addPage([TARGET_WIDTH_POINTS, TARGET_HEIGHT_POINTS]);

    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: TARGET_WIDTH_POINTS,
      height: TARGET_HEIGHT_POINTS
    });
  }

  const newPdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, newPdfBytes);
}

async function renderPdfPage(inputPath, pageIndex) {
  return sharp(inputPath, {
    density: PDF_RENDER_DENSITY,
    page: pageIndex
  })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

async function processPdfFile(inputPath, outputPath, mode) {
  const selectedMode = safeMode(mode);
  const existingPdfBytes = fs.readFileSync(inputPath);
  const existingPdf = await PDFDocument.load(existingPdfBytes);
  const pageCount = existingPdf.getPageCount();

  if (!pageCount) {
    throw new Error('This PDF does not appear to contain any pages.');
  }

  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`This PDF has too many pages. Please upload a PDF with ${MAX_PDF_PAGES} pages or fewer.`);
  }

  const outputPngPages = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    let renderedPageBuffer;

    try {
      renderedPageBuffer = await renderPdfPage(inputPath, pageIndex);
    } catch (err) {
      throw new Error('PDF rendering failed. Make sure this is a valid PDF label file. Details: ' + err.message);
    }

    if (selectedMode === 'split2' || selectedMode === 'split4') {
      const pieces = await prepareSplitPieces(renderedPageBuffer, selectedMode);

      if (pieces.length) {
        outputPngPages.push(...pieces);
      } else {
        outputPngPages.push(await prepareImageForLabel(renderedPageBuffer, 'smart'));
      }
    } else {
      outputPngPages.push(await prepareImageForLabel(renderedPageBuffer, selectedMode));
    }
  }

  await buildPdfFromPngPages(outputPngPages, outputPath);

  return {
    inputPages: pageCount,
    outputPages: outputPngPages.length
  };
}

async function processImageFile(inputPath, outputPath, mode) {
  const selectedMode = safeMode(mode);
  const imageBuffer = await sharp(inputPath)
    .rotate()
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();

  const outputPngPages = [];

  if (selectedMode === 'split2' || selectedMode === 'split4') {
    const pieces = await prepareSplitPieces(imageBuffer, selectedMode);

    if (pieces.length) {
      outputPngPages.push(...pieces);
    } else {
      outputPngPages.push(await prepareImageForLabel(imageBuffer, 'smart'));
    }
  } else {
    outputPngPages.push(await prepareImageForLabel(imageBuffer, selectedMode));
  }

  await buildPdfFromPngPages(outputPngPages, outputPath);

  return {
    inputPages: 1,
    outputPages: outputPngPages.length
  };
}

async function processUploadedFile(inputPath, outputPath, fileKind, mode) {
  if (fileKind === 'pdf') {
    return processPdfFile(inputPath, outputPath, mode);
  }

  if (fileKind === 'image') {
    return processImageFile(inputPath, outputPath, mode);
  }

  throw new Error('Unsupported file type.');
}

function converterForm() {
  return `
    <form class="upload-box" action="/convert" method="POST" enctype="multipart/form-data" onsubmit="trackEvent('upload_started', { tool: 'pdf_to_thermal' });">
      <input type="file" name="labelFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" required />

      <div class="mode-grid">
        <label class="mode-card">
          <input type="radio" name="mode" value="smart" checked />
          <span class="mode-title">Smart Crop</span>
          <span class="mode-help">Best default. Finds label content, removes blank space, and auto-rotates.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="fit" />
          <span class="mode-title">Fit</span>
          <span class="mode-help">Safest. Keeps the whole page or image visible inside 4x6.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="fill" />
          <span class="mode-title">Fill</span>
          <span class="mode-help">Fills the entire 4x6 label. May crop edges.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="autorotate" />
          <span class="mode-title">Auto-Rotate</span>
          <span class="mode-help">Keeps content visible but rotates landscape labels.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="rotate90" />
          <span class="mode-title">Rotate 90°</span>
          <span class="mode-help">Manual rescue option for labels facing the wrong direction.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="split2" />
          <span class="mode-title">Split 2 Labels</span>
          <span class="mode-help">Splits an 8.5x11 sheet into top and bottom label sections.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="split4" />
          <span class="mode-title">Split 4 Labels</span>
          <span class="mode-help">Splits a sheet into four sections and converts non-blank labels.</span>
        </label>
      </div>

      <button type="submit" class="btn full">Convert Now</button>
    </form>
  `;
}

// Home route
app.get('/', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Convert Shipping Labels to 4x6',
      canonicalPath: '/',
      description:
        'Free smart crop tool to convert PDF, PNG, JPG, and WEBP shipping labels into clean 4x6 thermal printer PDFs.',
      content: `
        <section class="hero">
          <h1>Smart Crop Shipping Labels to 4x6</h1>
          <p class="muted">Upload a PDF, PNG, JPG, JPEG, or WEBP label and turn it into a clean 4x6 thermal-printer-ready PDF. Built for Etsy, eBay, Amazon, TikTok Shop, Shopify, USPS, UPS, FedEx, and marketplace sellers.</p>
          <div class="pill-row">
            <span class="pill">PDF</span>
            <span class="pill">PNG</span>
            <span class="pill">JPG</span>
            <span class="pill">WEBP</span>
            <span class="pill">Smart Crop</span>
            <span class="pill">Split Sheets</span>
          </div>
        </section>

        <div class="card" style="text-align:center;">
          <h2>Upload Your Label</h2>
          <p>Default mode uses Smart Crop to find the actual label, remove blank space, rotate when needed, and rebuild a clean 4x6 PDF.</p>
          ${converterForm()}
          <div class="success-box">
            <strong>Privacy:</strong> Uploaded and converted files are temporary and automatically deleted.
          </div>
        </div>

        <div class="feature-grid">
          <div class="feature">
            <strong>PDF + Image Uploads</strong>
            <span class="muted">Convert PDFs, screenshots, PNGs, JPGs, JPEGs, and WEBP files.</span>
          </div>
          <div class="feature">
            <strong>Smart Crop</strong>
            <span class="muted">Removes blank page space around your label.</span>
          </div>
          <div class="feature">
            <strong>Split Sheets</strong>
            <span class="muted">Pull labels from 2-up and 4-up sheet layouts.</span>
          </div>
        </div>

        <div class="seo-grid">
          <a href="/etsy-label-fix">Fix Etsy labels printing small</a>
          <a href="/ebay-standard-envelope">eBay Standard Envelope to 4x6</a>
          <a href="/tiktok-shop-fix">TikTok Shop label resizing</a>
          <a href="/amazon-fnsku-resize">Amazon FNSKU to thermal label</a>
          <a href="/image-to-4x6">Convert image labels to 4x6 PDF</a>
          <a href="/split-label-sheet">Split 8.5x11 label sheets</a>
        </div>
      `
    })
  );
});

// Convert route
app.post('/convert', handleUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).send(
      pageTemplate({
        title: 'No File Uploaded',
        canonicalPath: '/',
        description: 'No file was uploaded for conversion.',
        content: `
          <div class="card">
            <h1>No File Uploaded</h1>
            <p>Please upload a PDF or image shipping label and try again.</p>
            <a href="/" class="btn">Try Again</a>
          </div>
        `
      })
    );
  }

  cleanup();

  const selectedMode = safeMode(req.body.mode || 'smart');
  const fileKind = getInputKind(req.file);
  const outName = `converted-${Date.now()}.pdf`;
  const outPath = path.join(downloadsDir, outName);

  try {
    const result = await processUploadedFile(req.file.path, outPath, fileKind, selectedMode);

    res.send(
      pageTemplate({
        title: 'Label Ready',
        canonicalPath: '/',
        description: 'Your converted 4x6 thermal shipping label is ready to download.',
        content: `
          <div class="card">
            <h1>Success! Your 4x6 Label Is Ready</h1>
            <p class="muted">Preview it below, then download your converted PDF.</p>

            <iframe class="preview-frame" src="/downloads/${outName}"></iframe>

            <div class="social-row">
              <a href="/downloads/${outName}" class="btn" download onclick="trackEvent('download_clicked', { mode: ${JSON.stringify(selectedMode)}, file_type: ${JSON.stringify(fileKind)} });">Download PDF</a>
              <a href="/" class="btn secondary">Convert Another</a>
              <button onclick="navigator.clipboard.writeText('${SITE_URL}'); trackEvent('share_link_copied'); alert('Link copied!')" class="btn secondary">
                Copy Link to Share
              </button>
            </div>

            <div class="success-box">
              <strong>Converted with ${escapeHtml(modeLabel(selectedMode))} mode.</strong>
              <p style="margin-bottom:0;">Input pages: ${escapeHtml(result.inputPages)}. Output 4x6 pages: ${escapeHtml(result.outputPages)}. If the output looks too zoomed in, try Fit mode. If it has too much white space, try Smart Crop or Fill.</p>
            </div>

            <div class="money-box">
              <h3>Printer Troubles?</h3>
              <p>Upgrade to a wireless setup. See our <a href="/best-thermal-printers" onclick="trackEvent('printer_guide_clicked');">2026 Thermal Printer Guide</a>.</p>
            </div>

            <script>
              trackEvent('convert_success', { mode: ${JSON.stringify(selectedMode)}, file_type: ${JSON.stringify(fileKind)}, output_pages: ${JSON.stringify(result.outputPages)} });
            </script>
          </div>
        `
      })
    );
  } catch (err) {
    console.error(err);

    res.status(500).send(
      pageTemplate({
        title: 'Conversion Failed',
        canonicalPath: '/',
        description: 'The label conversion failed.',
        content: `
          <div class="card">
            <h1>Conversion Failed</h1>
            <div class="danger-box">
              <p>${escapeHtml(err.message)}</p>
            </div>
            <p>Try Fit mode first. If that does not work, confirm your file is a standard PDF, PNG, JPG, JPEG, or WEBP label.</p>
            <a href="/" class="btn">Try Again</a>

            <script>
              trackEvent('convert_failed', { mode: ${JSON.stringify(selectedMode)}, file_type: ${JSON.stringify(fileKind)}, reason: ${JSON.stringify(err.message)} });
            </script>
          </div>
        `
      })
    );
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Failed to remove uploaded file:', err.message);
      }
    }
  }
});

// SEO routes
app.get('/etsy-label-fix', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Fix Etsy Labels Printing Too Small',
      canonicalPath: '/etsy-label-fix',
      description:
        'Fix Etsy shipping labels that print too small, sideways, or stuck in the corner. Convert Etsy labels to clean 4x6 thermal printer PDFs.',
      content: `
        <div class="card">
          <h1>How to Fix Etsy Labels Printing Too Small</h1>
          <p>Are your Etsy labels printing tiny, sideways, or stuck in the corner of your 4x6 thermal paper? This usually happens when Etsy provides a full-page PDF instead of a thermal-printer-ready label.</p>

          <h2>Common Etsy Label Problems</h2>
          <ul>
            <li>Label prints tiny in one corner</li>
            <li>Barcode is too small to scan</li>
            <li>Extra margins waste thermal labels</li>
            <li>Label downloads as an 8.5x11 PDF</li>
          </ul>

          <h2>How to Fix It</h2>
          <ol class="steps">
            <li>Download your Etsy shipping label as a PDF.</li>
            <li>Upload it to PDF to Thermal.</li>
            <li>Use Smart Crop mode.</li>
            <li>Download the converted 4x6 PDF.</li>
          </ol>

          <a href="/" class="btn">Convert Etsy Label</a>
        </div>
      `
    })
  );
});

app.get('/ebay-standard-envelope', (req, res) => {
  res.send(
    pageTemplate({
      title: 'eBay Standard Envelope Label to 4x6',
      canonicalPath: '/ebay-standard-envelope',
      description:
        'Convert eBay Standard Envelope and eBay shipping labels into clean 4x6 thermal printer PDFs.',
      content: `
        <div class="card">
          <h1>Convert eBay Standard Envelope Labels to 4x6</h1>
          <p>eBay Standard Envelope labels can download in a format that does not print cleanly on 4x6 thermal printers. They may print sideways, too small, or with too much blank space.</p>

          <h2>What This Tool Does</h2>
          <ul>
            <li>Resizes eBay labels to 4x6</li>
            <li>Helps rotate wide labels</li>
            <li>Removes blank margins with Smart Crop</li>
            <li>Creates a cleaner PDF for thermal printers</li>
          </ul>

          <a href="/" class="btn">Convert eBay Label</a>
        </div>
      `
    })
  );
});

app.get('/tiktok-shop-fix', (req, res) => {
  res.send(
    pageTemplate({
      title: 'TikTok Shop Label Resize Tool',
      canonicalPath: '/tiktok-shop-fix',
      description:
        'Resize TikTok Shop shipping labels for 4x6 thermal printers. Fix labels that print too small, sideways, or with large margins.',
      content: `
        <div class="card">
          <h1>Fix TikTok Shop Labels for 4x6 Thermal Printers</h1>
          <p>If your TikTok Shop shipping label prints too small, sideways, or with extra margins, upload it here and convert it to a clean 4x6 thermal label.</p>

          <h2>Best For</h2>
          <ul>
            <li>TikTok Shop seller labels</li>
            <li>Marketplace shipping PDFs</li>
            <li>4x6 thermal printer output</li>
            <li>Labels with blank space around the barcode area</li>
          </ul>

          <a href="/" class="btn">Resize TikTok Shop Label</a>
        </div>
      `
    })
  );
});

app.get('/amazon-fnsku-resize', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Amazon FNSKU Label Resize Tool',
      canonicalPath: '/amazon-fnsku-resize',
      description:
        'Prepare Amazon FNSKU, FBA, and product labels for thermal label printing.',
      content: `
        <div class="card">
          <h1>Resize Amazon FNSKU Labels for Thermal Printers</h1>
          <p>Prepare Amazon FNSKU, FBA, and product label PDFs for cleaner thermal label printing.</p>

          <h2>Use This For</h2>
          <ul>
            <li>Amazon FBA labels</li>
            <li>Amazon FNSKU labels</li>
            <li>Product barcode labels</li>
            <li>Shipping label PDFs</li>
          </ul>

          <a href="/" class="btn">Convert Amazon Label</a>
        </div>
      `
    })
  );
});

app.get('/image-to-4x6', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Convert PNG or JPG Label to 4x6 PDF',
      canonicalPath: '/image-to-4x6',
      description:
        'Convert PNG, JPG, JPEG, or WEBP shipping label screenshots into clean 4x6 thermal printer PDF files.',
      content: `
        <div class="card">
          <h1>Convert PNG or JPG Labels to 4x6 PDF</h1>
          <p>Have a screenshot or downloaded image label instead of a PDF? Upload your PNG, JPG, JPEG, or WEBP file and convert it into a 4x6 thermal-printer-ready PDF.</p>

          <h2>Best Uses</h2>
          <ul>
            <li>Screenshot labels</li>
            <li>Mobile app label downloads</li>
            <li>PNG and JPG shipping labels</li>
            <li>Marketplace labels saved as images</li>
          </ul>

          ${converterForm()}
        </div>
      `
    })
  );
});

app.get('/split-label-sheet', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Split 8.5x11 Label Sheets into 4x6 Labels',
      canonicalPath: '/split-label-sheet',
      description:
        'Split 8.5x11 PDF label sheets into separate 4x6 thermal printer label PDFs using 2-label or 4-label split modes.',
      content: `
        <div class="card">
          <h1>Split 8.5x11 Label Sheets into 4x6 Labels</h1>
          <p>Some marketplaces download labels as full-page sheets with multiple labels. Use Split 2 Labels or Split 4 Labels mode to pull the non-blank label sections and convert each one into its own 4x6 page.</p>

          <h2>Which Split Mode Should You Use?</h2>
          <ul>
            <li><strong>Split 2 Labels:</strong> best for top-and-bottom label sheets.</li>
            <li><strong>Split 4 Labels:</strong> best for sheets with four label blocks or smaller barcode labels.</li>
            <li><strong>Smart Crop:</strong> best when there is only one label on the page.</li>
          </ul>

          ${converterForm()}
        </div>
      `
    })
  );
});

// Affiliate guide route
app.get('/best-thermal-printers', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Best Thermal Printers 2026',
      canonicalPath: '/best-thermal-printers',
      description:
        'A simple guide to the best thermal printers for online sellers using Etsy, eBay, Amazon, TikTok Shop, Shopify, USPS, UPS, and FedEx.',
      content: `
        <div class="card">
          <h1>Best Thermal Printers for Sellers in 2026</h1>
          <p>A good thermal printer can save time, reduce wasted labels, and make shipping faster for Etsy, eBay, Amazon, Shopify, and TikTok Shop sellers.</p>

          <h2>What to Look For</h2>
          <ul>
            <li>4x6 label support</li>
            <li>USB and wireless options</li>
            <li>Mac and Windows compatibility</li>
            <li>Reliable barcode clarity</li>
            <li>Easy driver setup</li>
          </ul>

          <h2>Recommended Wireless Thermal Printer</h2>
          <p>For many sellers, a wireless 4x6 thermal printer is the easiest setup because it works with laptop and mobile workflows.</p>

          <a href="https://www.amazon.com/dp/B08MBYJR7C?tag=${AMZ_ID}" class="btn" rel="sponsored nofollow" onclick="trackEvent('affiliate_click', { product: 'thermal_printer' });">
            View Thermal Printer on Amazon
          </a>
        </div>
      `
    })
  );
});

// FAQ route
app.get('/faq', (req, res) => {
  res.send(
    pageTemplate({
      title: 'FAQ',
      canonicalPath: '/faq',
      description:
        'Frequently asked questions about converting shipping labels into 4x6 thermal printer PDFs.',
      content: `
        <div class="card">
          <h1>FAQ</h1>

          <h2>What file types do you support?</h2>
          <p>We support PDF, PNG, JPG, JPEG, and WEBP label files.</p>

          <h2>What does Smart Crop do?</h2>
          <p>Smart Crop detects the non-white label area, removes extra blank space, rotates landscape labels when needed, and rebuilds the result as a clean 4x6 PDF.</p>

          <h2>What does Split 2 Labels do?</h2>
          <p>Split 2 Labels divides each page into a top half and bottom half, detects non-blank sections, and converts each detected label into a separate 4x6 page.</p>

          <h2>What does Split 4 Labels do?</h2>
          <p>Split 4 Labels divides each page into four sections, detects non-blank sections, and converts each detected section into a separate 4x6 page.</p>

          <h2>Does this work for screenshots?</h2>
          <p>Yes. Upload a PNG, JPG, JPEG, or WEBP screenshot and use Smart Crop or Fit mode.</p>

          <h2>Does this work with multi-page PDFs?</h2>
          <p>Yes. The converter processes each page and creates a new 4x6 page for every original PDF page. Split modes may create more output pages than the original file.</p>

          <h2>What if Smart Crop zooms in too much?</h2>
          <p>Try Fit mode. Fit mode keeps the entire page or image visible inside the 4x6 output.</p>

          <h2>What if Fit mode leaves too much white space?</h2>
          <p>Try Smart Crop first, then Fill mode if you want the label to occupy more of the 4x6 page.</p>

          <h2>Are uploaded files stored forever?</h2>
          <p>No. Uploaded and converted files are temporary and are cleaned from the server automatically.</p>
        </div>
      `
    })
  );
});

// Privacy route
app.get('/privacy', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Privacy Policy',
      canonicalPath: '/privacy',
      description:
        'Privacy policy for PDF to Thermal, including how uploaded label files are handled.',
      content: `
        <div class="card">
          <h1>Privacy Policy</h1>

          <p>PDF to Thermal processes uploaded files temporarily for conversion purposes.</p>

          <h2>Uploaded Files</h2>
          <p>Uploaded and converted files are stored temporarily and automatically deleted from the server after a short period of time.</p>

          <h2>Analytics</h2>
          <p>This website uses Google Analytics to understand website traffic and improve the service.</p>

          <h2>Affiliate Links</h2>
          <p>Some links on this website may be affiliate links. If you purchase through those links, we may earn a commission at no additional cost to you.</p>

          <h2>Personal Information</h2>
          <p>We do not sell uploaded documents or personal information.</p>

          <h2>Contact</h2>
          <p>For questions, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
        </div>
      `
    })
  );
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

// Sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const pages = [
    '/',
    '/etsy-label-fix',
    '/ebay-standard-envelope',
    '/tiktok-shop-fix',
    '/amazon-fnsku-resize',
    '/image-to-4x6',
    '/split-label-sheet',
    '/best-thermal-printers',
    '/faq',
    '/privacy'
  ];

  const urls = pages
    .map((page) => {
      return `
  <url>
    <loc>${SITE_URL}${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '/' ? '1.0' : '0.8'}</priority>
  </url>`;
    })
    .join('');

  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});

// 404 route
app.use((req, res) => {
  res.status(404).send(
    pageTemplate({
      title: 'Page Not Found',
      canonicalPath: req.path,
      description: 'The requested page could not be found.',
      content: `
        <div class="card">
          <h1>Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
          <a href="/" class="btn">Go to Converter</a>
        </div>
      `
    })
  );
});

// Run cleanup every 15 minutes
setInterval(cleanup, 15 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`PDF to Thermal live on port ${PORT}`);
});
