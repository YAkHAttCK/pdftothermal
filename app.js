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
const PDF_RENDER_DENSITY = 220;

// File cleanup age
const MAX_FILE_AGE_MS = 60 * 60 * 1000;

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
app.use('/downloads', express.static(downloadsDir));

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      path.extname(file.originalname).toLowerCase() === '.pdf';

    if (!isPdf) {
      return cb(new Error('Only PDF files are supported right now.'));
    }

    cb(null, true);
  }
});

function handleUpload(req, res, next) {
  upload.single('labelFile')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large. Please upload a PDF under 15MB.'
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
    'Free tool to resize shipping labels into clean 4x6 thermal printer PDFs for Etsy, eBay, Amazon, TikTok Shop, Shopify, USPS, UPS, FedEx, and other marketplaces.';

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
      max-width: 1040px;
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
      max-width: 720px;
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
      max-width: 420px;
    }

    .preview-frame {
      width: 100%;
      height: 540px;
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
      max-width: 480px;
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

    @media (max-width: 800px) {
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
        <a href="/best-thermal-printers">Best Printers</a>
        <a href="/faq">FAQ</a>
        <a href="/privacy">Privacy</a>
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

// Detect the actual non-white area of a rendered PDF page
async function detectContentBounds(imageBuffer) {
  const image = sharp(imageBuffer).ensureAlpha();
  const metadata = await image.metadata();

  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error('Could not read rendered page dimensions.');
  }

  const raw = await image.raw().toBuffer();

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // White detection threshold.
  // Anything darker than this is treated as label/content.
  const whiteThreshold = 246;

  // Ignore tiny single-pixel dust by scanning every pixel but requiring contrast.
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
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If no meaningful content is detected, return the whole page.
  if (maxX === -1 || maxY === -1) {
    return {
      left: 0,
      top: 0,
      width,
      height
    };
  }

  // Add padding back so barcodes/text are not cut too tight.
  const padding = Math.max(12, Math.round(Math.min(width, height) * 0.012));

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width - 1, maxX + padding);
  const bottom = Math.min(height - 1, maxY + padding);

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1
  };
}

// Prepare one rendered page image into a 4x6 PNG
async function preparePageImage(renderedPageBuffer, mode) {
  let working = sharp(renderedPageBuffer).flatten({ background: '#ffffff' });

  const metadata = await working.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not process page image.');
  }

  if (mode === 'smart') {
    const bounds = await detectContentBounds(renderedPageBuffer);

    // Only crop if detected area is meaningfully smaller than the full page.
    const fullArea = metadata.width * metadata.height;
    const cropArea = bounds.width * bounds.height;
    const shouldCrop = cropArea < fullArea * 0.96;

    if (shouldCrop) {
      working = working.extract(bounds);
    }
  }

  const afterCropMeta = await working.metadata();
  let cropWidth = afterCropMeta.width;
  let cropHeight = afterCropMeta.height;

  if (!cropWidth || !cropHeight) {
    throw new Error('Could not read cropped page size.');
  }

  const isLandscape = cropWidth > cropHeight;
  const shouldRotate =
    mode === 'autorotate'
      ? isLandscape
      : mode === 'smart'
        ? isLandscape
        : mode === 'fill'
          ? isLandscape
          : false;

  if (shouldRotate) {
    working = working.rotate(90);
    const rotatedMeta = await working.metadata();
    cropWidth = rotatedMeta.width;
    cropHeight = rotatedMeta.height;
  }

  const resizeFit = mode === 'fill' ? 'cover' : 'contain';

  const finalPng = await working
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

  return finalPng;
}

// Convert PDF to smart-cropped 4x6 PDF
async function processPdf(inputPath, outputPath, mode = 'smart') {
  const allowedModes = ['smart', 'fit', 'fill', 'autorotate'];
  const selectedMode = allowedModes.includes(mode) ? mode : 'smart';

  const existingPdfBytes = fs.readFileSync(inputPath);
  const existingPdf = await PDFDocument.load(existingPdfBytes);
  const pageCount = existingPdf.getPageCount();

  if (!pageCount) {
    throw new Error('This PDF does not appear to contain any pages.');
  }

  if (pageCount > 50) {
    throw new Error('This PDF has too many pages. Please upload a PDF with 50 pages or fewer.');
  }

  const newPdf = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    let renderedPageBuffer;

    try {
      renderedPageBuffer = await sharp(inputPath, {
        density: PDF_RENDER_DENSITY,
        page: pageIndex
      })
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer();
    } catch (err) {
      throw new Error(
        'PDF rendering failed. Make sure this is a valid PDF label file. Details: ' + err.message
      );
    }

    const preparedPng = await preparePageImage(renderedPageBuffer, selectedMode);
    const embeddedImage = await newPdf.embedPng(preparedPng);

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

// Home route
app.get('/', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Convert Shipping Labels to 4x6',
      canonicalPath: '/',
      description:
        'Free smart crop tool to convert shipping label PDFs into clean 4x6 thermal printer labels for Etsy, eBay, Amazon, TikTok Shop, Shopify, USPS, UPS, FedEx, and more.',
      content: `
        <section class="hero">
          <h1>Smart Crop Shipping Labels to 4x6</h1>
          <p class="muted">Upload a label PDF and turn it into a clean 4x6 thermal-printer-ready file. Built for Etsy, eBay, Amazon, TikTok Shop, Shopify, USPS, UPS, FedEx, and marketplace sellers.</p>
        </section>

        <div class="card" style="text-align:center;">
          <h2>Upload Your Label PDF</h2>
          <p>Default mode uses Smart Crop to find the actual label, remove blank space, rotate when needed, and rebuild a clean 4x6 PDF.</p>

          <form class="upload-box" action="/convert" method="POST" enctype="multipart/form-data" onsubmit="trackEvent('upload_started', { tool: 'pdf_to_thermal' });">
            <input type="file" name="labelFile" accept="application/pdf,.pdf" required />

            <div class="mode-grid">
              <label class="mode-card">
                <input type="radio" name="mode" value="smart" checked />
                <span class="mode-title">Smart Crop</span>
                <span class="mode-help">Best default. Finds label content, removes blank space, and auto-rotates.</span>
              </label>

              <label class="mode-card">
                <input type="radio" name="mode" value="fit" />
                <span class="mode-title">Fit</span>
                <span class="mode-help">Safest. Keeps the whole page visible inside 4x6.</span>
              </label>

              <label class="mode-card">
                <input type="radio" name="mode" value="fill" />
                <span class="mode-title">Fill</span>
                <span class="mode-help">Fills the entire 4x6 label. May crop edges.</span>
              </label>

              <label class="mode-card">
                <input type="radio" name="mode" value="autorotate" />
                <span class="mode-title">Auto-Rotate</span>
                <span class="mode-help">Keeps page visible but rotates landscape labels.</span>
              </label>
            </div>

            <button type="submit" class="btn full">Convert Now</button>
          </form>

          <div class="success-box">
            <strong>Privacy:</strong> Uploaded and converted files are temporary and automatically deleted.
          </div>
        </div>

        <div class="feature-grid">
          <div class="feature">
            <strong>Smart Crop</strong>
            <span class="muted">Removes the blank 8.5x11 page area around your label.</span>
          </div>
          <div class="feature">
            <strong>Auto-Rotate</strong>
            <span class="muted">Fixes sideways and landscape label layouts.</span>
          </div>
          <div class="feature">
            <strong>Multi-Page PDF</strong>
            <span class="muted">Converts every label page into 4x6 format.</span>
          </div>
        </div>

        <div class="seo-grid">
          <a href="/etsy-label-fix">Fix Etsy labels printing small</a>
          <a href="/ebay-standard-envelope">eBay Standard Envelope to 4x6</a>
          <a href="/tiktok-shop-fix">TikTok Shop label resizing</a>
          <a href="/amazon-fnsku-resize">Amazon FNSKU to thermal label</a>
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
            <p>Please upload a PDF shipping label and try again.</p>
            <a href="/" class="btn">Try Again</a>
          </div>
        `
      })
    );
  }

  cleanup();

  const mode = req.body.mode || 'smart';
  const outName = `converted-${Date.now()}.pdf`;
  const outPath = path.join(downloadsDir, outName);

  try {
    await processPdf(req.file.path, outPath, mode);

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
              <a href="/downloads/${outName}" class="btn" download onclick="trackEvent('download_clicked', { mode: '${escapeHtml(mode)}' });">Download PDF</a>
              <a href="/" class="btn secondary">Convert Another</a>
              <button onclick="navigator.clipboard.writeText('${SITE_URL}'); trackEvent('share_link_copied'); alert('Link copied!')" class="btn secondary">
                Copy Link to Share
              </button>
            </div>

            <div class="success-box">
              <strong>Converted with ${escapeHtml(mode)} mode.</strong>
              <p style="margin-bottom:0;">If the output looks too zoomed in, try Fit mode. If it has too much white space, try Fill or Smart Crop.</p>
            </div>

            <div class="money-box">
              <h3>Printer Troubles?</h3>
              <p>Upgrade to a wireless setup. See our <a href="/best-thermal-printers" onclick="trackEvent('printer_guide_clicked');">2026 Thermal Printer Guide</a>.</p>
            </div>

            <script>
              trackEvent('convert_success', { mode: '${escapeHtml(mode)}' });
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
            <p>Try Fit mode first. If that does not work, confirm your file is a standard PDF shipping label.</p>
            <a href="/" class="btn">Try Again</a>

            <script>
              trackEvent('convert_failed', { reason: ${JSON.stringify(err.message)} });
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
          <p>We currently support PDF label files. PNG and JPG upload support is planned for the next upgrade.</p>

          <h2>What does Smart Crop do?</h2>
          <p>Smart Crop renders the PDF page, detects the non-white label area, removes extra blank space, rotates landscape labels when needed, and rebuilds the result as a clean 4x6 PDF.</p>

          <h2>Does this work for Etsy?</h2>
          <p>Yes. This tool is built to help resize Etsy shipping labels into a 4x6 thermal printer format.</p>

          <h2>Does this work for eBay?</h2>
          <p>Yes. It can help with eBay shipping labels and eBay Standard Envelope label formatting.</p>

          <h2>Does this work with multi-page PDFs?</h2>
          <p>Yes. The converter processes each page and creates a new 4x6 page for every original PDF page.</p>

          <h2>What if Smart Crop zooms in too much?</h2>
          <p>Try Fit mode. Fit mode keeps the entire page visible inside the 4x6 output.</p>

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
