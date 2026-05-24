const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument, degrees, rgb, StandardFonts } = require('pdf-lib');

const app = express();

const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://pdftothermal.com';
const SUPPORT_EMAIL = 'support@pdftothermal.com';
const GA_ID = 'G-CV6R7PF4PH';
const AMZ_ID = 'pdftothermal-20';

// Thermal label output settings
const TARGET_WIDTH_POINTS = 288;
const TARGET_HEIGHT_POINTS = 432;
const TARGET_WIDTH_PIXELS = 1200;
const TARGET_HEIGHT_PIXELS = 1800;

// Rendering and file limits
const PDF_RENDER_DENSITY = 220;
const MAX_FILE_AGE_MS = 60 * 60 * 1000;
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

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
  limits: { fileSize: MAX_UPLOAD_SIZE },
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
          robots: 'noindex, nofollow',
          pageType: 'upload_error',
          content: `
            <div class="card">
              <h1>Upload Error</h1>
              <p>${escapeHtml(message)}</p>
              <a href="/" class="btn">Try Again</a>
              <script>
                trackEvent('upload_error', { reason: ${jsValue(message)} });
              </script>
            </div>
          `
        })
      );
    }

    next();
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function jsValue(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
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

function logConversionEvent(payload) {
  const safePayload = {
    event: payload.event,
    success: payload.success,
    mode: payload.mode,
    fileKind: payload.fileKind,
    inputPages: payload.inputPages,
    outputPages: payload.outputPages,
    processingMs: payload.processingMs,
    warning: payload.warning ? true : false,
    error: payload.error || '',
    timestamp: new Date().toISOString()
  };

  console.log(JSON.stringify(safePayload));
}

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

function analyticsScript() {
  return `
    <script>
      function trackEvent(name, params) {
        const eventParams = Object.assign({
          event_category: 'PDF to Thermal',
          site_area: 'converter'
        }, params || {});

        if (typeof gtag === 'function') {
          gtag('event', name, eventParams);
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({
          event: name
        }, eventParams));
      }

      function getFileExtension(filename) {
        if (!filename || filename.indexOf('.') === -1) return 'unknown';
        return filename.split('.').pop().toLowerCase();
      }

      function getFileSizeBucket(size) {
        if (!size) return 'unknown';
        if (size < 500000) return 'under_500kb';
        if (size < 1000000) return '500kb_to_1mb';
        if (size < 5000000) return '1mb_to_5mb';
        if (size < 10000000) return '5mb_to_10mb';
        return '10mb_plus';
      }

      function trackFileSelected(input) {
        const file = input && input.files && input.files[0];

        if (!file) return;

        trackEvent('file_selected', {
          file_extension: getFileExtension(file.name),
          file_size_bucket: getFileSizeBucket(file.size)
        });
      }

      function trackModeSelected(mode) {
        trackEvent('mode_selected', {
          mode: mode || 'unknown'
        });
      }

      function trackUploadStarted(form) {
        let mode = 'unknown';
        let fileExtension = 'unknown';
        let fileSizeBucket = 'unknown';

        try {
          const checkedMode = form.querySelector('input[name="mode"]:checked');
          if (checkedMode) mode = checkedMode.value;

          const fileInput = form.querySelector('input[name="labelFile"]');
          const file = fileInput && fileInput.files && fileInput.files[0];

          if (file) {
            fileExtension = getFileExtension(file.name);
            fileSizeBucket = getFileSizeBucket(file.size);
          }
        } catch (err) {}

        trackEvent('upload_started', {
          mode: mode,
          file_extension: fileExtension,
          file_size_bucket: fileSizeBucket
        });

        return true;
      }

      function trackDownload(filename, mode, fileKind, outputPages) {
        trackEvent('download_clicked', {
          filename_type: 'converted_pdf',
          mode: mode || 'unknown',
          file_type: fileKind || 'unknown',
          output_pages: outputPages || 0
        });
      }

      function copySiteLink() {
        navigator.clipboard.writeText('${SITE_URL}');
        trackEvent('share_link_copied');
        alert('Link copied.');
      }

      function bookmarkHelp() {
        trackEvent('bookmark_prompt_clicked');
        alert('Press Ctrl+D on Windows or Command+D on Mac to bookmark this tool.');
      }

      function trackPrinterGuideClick() {
        trackEvent('printer_guide_clicked');
      }

      function trackAffiliateClick(product) {
        trackEvent('affiliate_click', {
          product: product || 'unknown'
        });
      }

      function trackTestLabelClick() {
        trackEvent('test_label_clicked');
      }
    </script>
  `;
}

function pageTemplate({
  title,
  description,
  content,
  canonicalPath = '/',
  robots = 'index, follow',
  pageType = 'page'
}) {
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
  <meta name="robots" content="${escapeHtml(robots)}" />
  <link rel="canonical" href="${SITE_URL}${cleanCanonical}" />

  <meta property="og:title" content="${escapeHtml(title)} | PDF to Thermal" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE_URL}${cleanCanonical}" />
  <meta name="twitter:card" content="summary" />

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

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 30%), var(--light);
      color: var(--dark);
      line-height: 1.6;
    }

    .container { max-width: 1120px; margin: 0 auto; padding: 0 20px; }

    header {
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      padding: 15px 0;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
    .logo { font-size: 22px; font-weight: 900; color: var(--primary); text-decoration: none; white-space: nowrap; letter-spacing: -0.04em; }
    nav { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 14px; }
    nav a { text-decoration: none; color: var(--muted); font-weight: 800; font-size: 14px; }
    nav a:hover { color: var(--primary); }
    main { min-height: 70vh; }

    .hero { padding: 42px 0 8px; text-align: center; }
    .hero p { max-width: 800px; margin-left: auto; margin-right: auto; }

    .card {
      background: #ffffff;
      padding: 30px;
      border-radius: 22px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      border: 1px solid var(--border);
      margin-top: 24px;
    }

    .card.compact { padding: 22px; }

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

    .btn:hover { background: var(--primary-dark); }
    .btn.secondary { background: var(--accent); color: var(--primary); }
    .btn.secondary:hover { background: #dbeafe; }
    .btn.full { width: 100%; max-width: 460px; }

    .preview-frame {
      width: 100%;
      height: 560px;
      border: 1px solid var(--border);
      border-radius: 14px;
      margin: 20px 0;
      background: #f1f5f9;
    }

    .money-box { background: var(--warning-bg); border: 1px solid var(--warning-border); padding: 20px; border-radius: 16px; margin-top: 25px; }
    .success-box { background: var(--success-bg); border: 1px solid var(--success-border); padding: 18px; border-radius: 16px; margin-top: 18px; }
    .danger-box { background: var(--danger-bg); border: 1px solid var(--danger-border); padding: 18px; border-radius: 16px; margin-top: 18px; }

    .social-row { display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap; }

    h1 { font-size: 42px; line-height: 1.08; margin: 0 0 12px; letter-spacing: -0.05em; }
    h2 { font-size: 24px; line-height: 1.25; margin-top: 28px; letter-spacing: -0.03em; }
    h3 { margin-bottom: 8px; }
    p { color: #334155; }
    .muted { color: var(--muted); }

    .upload-box { margin-top: 20px; }
    input[type="file"] { width: 100%; max-width: 520px; padding: 14px; border: 1px dashed #cbd5e1; border-radius: 14px; background: var(--light); margin-bottom: 18px; }

    .mode-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; text-align: left; }
    .mode-card { border: 1px solid var(--border); border-radius: 14px; padding: 14px; background: #ffffff; cursor: pointer; min-height: 126px; }
    .mode-card:hover { border-color: var(--primary); }
    .mode-card input { margin-right: 6px; }
    .mode-title { font-weight: 900; color: var(--dark); display: block; margin-bottom: 4px; }
    .mode-help { color: var(--muted); font-size: 13px; display: block; line-height: 1.35; }

    .seo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 28px; }
    .seo-grid a { color: var(--primary); text-decoration: none; font-weight: 800; background: #ffffff; border: 1px solid var(--border); padding: 16px; border-radius: 16px; }
    .seo-grid a:hover { border-color: var(--primary); }

    .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 24px; }
    .feature { background: #ffffff; border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
    .feature strong { display: block; margin-bottom: 6px; }

    .tool-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 22px; }
    .tool-card { background: #ffffff; border: 1px solid var(--border); border-radius: 16px; padding: 18px; text-decoration: none; color: var(--dark); }
    .tool-card strong { display: block; margin-bottom: 6px; }
    .tool-card span { color: var(--muted); font-size: 14px; }
    .tool-card:hover { border-color: var(--primary); }

    .steps { padding-left: 22px; }
    .steps li { margin-bottom: 8px; }

    .pill-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
    .pill { background: #ffffff; border: 1px solid var(--border); border-radius: 999px; padding: 7px 12px; color: var(--muted); font-weight: 800; font-size: 13px; }

    .instruction-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .instruction { border: 1px solid var(--border); border-radius: 16px; padding: 18px; background: #ffffff; }

    footer { background: var(--dark); color: #ffffff; padding: 30px 0; text-align: center; margin-top: 55px; font-size: 13px; }
    footer p { color: #e2e8f0; }
    footer a { color: #ffffff; }

    @media (max-width: 960px) {
      .mode-grid, .tool-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 760px) {
      .header-inner { flex-direction: column; align-items: flex-start; }
      nav { justify-content: flex-start; }
      h1 { font-size: 31px; }
      .seo-grid, .feature-grid, .mode-grid, .tool-grid, .instruction-grid { grid-template-columns: 1fr; }
      .card { padding: 22px; }
      .preview-frame { height: 430px; }
    }
  </style>
${analyticsScript()}
</head>

<body data-page-type="${escapeHtml(pageType)}">
  <header>
    <div class="container header-inner">
      <a href="/" class="logo">PDF to Thermal</a>
      <nav>
        <a href="/">Converter</a>
        <a href="/split-label-sheet">Split Sheets</a>
        <a href="/image-to-4x6">Image to 4x6</a>
        <a href="/print-settings">Print Settings</a>
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
        <a href="/terms">Terms</a> |
        <a href="/contact">Contact</a> |
        <a href="/faq">FAQ</a> |
        <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
      </p>
    </div>
  </footer>

  <script>
    trackEvent('page_loaded', {
      page_type: ${jsValue(pageType)},
      path: window.location.pathname
    });
  </script>
</body>
</html>
  `;
}

function resolveConvertedFile(filename) {
  const cleanName = path.basename(filename || '');
  if (!/^converted-\d+\.pdf$/.test(cleanName)) return null;
  return path.join(downloadsDir, cleanName);
}

function sendConvertedPdf(req, res, disposition) {
  const filePath = resolveConvertedFile(req.params.filename);

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send(
      pageTemplate({
        title: 'File Expired',
        canonicalPath: '/',
        description: 'The converted file is no longer available.',
        robots: 'noindex, nofollow',
        pageType: 'file_expired',
        content: `
          <div class="card">
            <h1>File Expired</h1>
            <p>Converted files are temporary and are automatically deleted. Please convert the label again.</p>
            <a href="/" class="btn">Convert Another Label</a>
            <script>
              trackEvent('converted_file_expired');
            </script>
          </div>
        `
      })
    );
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="4x6-thermal-label.pdf"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.sendFile(filePath);
}

async function detectContentBounds(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  if (!width || !height || channels < 4) {
    throw new Error('Could not read image dimensions.');
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let contentPixels = 0;

  const whiteThreshold = 246;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

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

async function prepareImageForLabel(imageBuffer, mode) {
  const selectedMode = safeMode(mode);
  let working = sharp(imageBuffer).rotate().flatten({ background: '#ffffff' });

  const metadata = await working.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not process image.');
  }

  if (selectedMode === 'smart') {
    const normalizedBuffer = await working.png().toBuffer();
    const bounds = await detectContentBounds(normalizedBuffer);
    const fullArea = metadata.width * metadata.height;
    const cropArea = bounds.width * bounds.height;
    const shouldCrop = bounds.found && cropArea < fullArea * 0.96;

    if (shouldCrop) {
      working = sharp(normalizedBuffer).extract({
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
    .png({ compressionLevel: 9, adaptiveFiltering: true })
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
      { left: 0, top: 0, width, height: halfHeight },
      { left: 0, top: halfHeight, width, height: height - halfHeight }
    ];
  }

  if (splitMode === 'split4') {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    regions = [
      { left: 0, top: 0, width: halfWidth, height: halfHeight },
      { left: halfWidth, top: 0, width: width - halfWidth, height: halfHeight },
      { left: 0, top: halfHeight, width: halfWidth, height: height - halfHeight },
      { left: halfWidth, top: halfHeight, width: width - halfWidth, height: height - halfHeight }
    ];
  }

  const pieces = [];

  for (const region of regions) {
    const pieceBuffer = await base
      .clone()
      .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
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
  return sharp(inputPath, { density: PDF_RENDER_DENSITY, page: pageIndex })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

async function processPdfVectorFallback(inputPath, outputPath, mode, renderErrorMessage) {
  const selectedMode = safeMode(mode);
  const existingPdf = await PDFDocument.load(fs.readFileSync(inputPath));
  const pageCount = existingPdf.getPageCount();
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(existingPdf, existingPdf.getPageIndices());

  for (const copiedPage of copiedPages) {
    const { width, height } = copiedPage.getSize();
    const isLandscape = width > height;
    const shouldRotate =
      selectedMode === 'rotate90' ||
      ((selectedMode === 'autorotate' || selectedMode === 'fill') && isLandscape);

    const effectiveWidth = shouldRotate ? height : width;
    const effectiveHeight = shouldRotate ? width : height;

    const scale =
      selectedMode === 'fill'
        ? Math.max(TARGET_WIDTH_POINTS / effectiveWidth, TARGET_HEIGHT_POINTS / effectiveHeight)
        : Math.min(TARGET_WIDTH_POINTS / effectiveWidth, TARGET_HEIGHT_POINTS / effectiveHeight);

    const scaledWidth = effectiveWidth * scale;
    const scaledHeight = effectiveHeight * scale;
    const page = newPdf.addPage([TARGET_WIDTH_POINTS, TARGET_HEIGHT_POINTS]);

    if (shouldRotate) {
      page.drawPage(copiedPage, {
        x: (TARGET_WIDTH_POINTS - scaledWidth) / 2 + scaledWidth,
        y: (TARGET_HEIGHT_POINTS - scaledHeight) / 2,
        xScale: scale,
        yScale: scale,
        rotate: degrees(90)
      });
    } else {
      page.drawPage(copiedPage, {
        x: (TARGET_WIDTH_POINTS - scaledWidth) / 2,
        y: (TARGET_HEIGHT_POINTS - scaledHeight) / 2,
        xScale: scale,
        yScale: scale
      });
    }
  }

  fs.writeFileSync(outputPath, await newPdf.save());

  return {
    inputPages: pageCount,
    outputPages: pageCount,
    warning:
      'Smart image rendering was not available for this PDF, so the converter used safe PDF scaling instead. Render detail: ' +
      renderErrorMessage
  };
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

  try {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const renderedPageBuffer = await renderPdfPage(inputPath, pageIndex);

      if (selectedMode === 'split2' || selectedMode === 'split4') {
        const pieces = await prepareSplitPieces(renderedPageBuffer, selectedMode);
        outputPngPages.push(...(pieces.length ? pieces : [await prepareImageForLabel(renderedPageBuffer, 'smart')]));
      } else {
        outputPngPages.push(await prepareImageForLabel(renderedPageBuffer, selectedMode));
      }
    }
  } catch (err) {
    if (selectedMode === 'split2' || selectedMode === 'split4') {
      throw new Error('Split mode needs PDF image rendering support. Try Smart Crop or Fit mode instead. Details: ' + err.message);
    }

    return processPdfVectorFallback(inputPath, outputPath, selectedMode, err.message);
  }

  await buildPdfFromPngPages(outputPngPages, outputPath);

  return {
    inputPages: pageCount,
    outputPages: outputPngPages.length,
    warning: ''
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
    outputPngPages.push(...(pieces.length ? pieces : [await prepareImageForLabel(imageBuffer, 'smart')]));
  } else {
    outputPngPages.push(await prepareImageForLabel(imageBuffer, selectedMode));
  }

  await buildPdfFromPngPages(outputPngPages, outputPath);

  return {
    inputPages: 1,
    outputPages: outputPngPages.length,
    warning: ''
  };
}

async function processUploadedFile(inputPath, outputPath, fileKind, mode) {
  if (fileKind === 'pdf') return processPdfFile(inputPath, outputPath, mode);
  if (fileKind === 'image') return processImageFile(inputPath, outputPath, mode);
  throw new Error('Unsupported file type.');
}

function converterForm(defaultMode = 'smart') {
  const checked = (mode) => (defaultMode === mode ? 'checked' : '');

  return `
    <form class="upload-box" action="/convert" method="POST" enctype="multipart/form-data" onsubmit="return trackUploadStarted(this);">
      <input type="file" name="labelFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" onchange="trackFileSelected(this)" required />

      <div class="mode-grid">
        <label class="mode-card">
          <input type="radio" name="mode" value="smart" ${checked('smart')} onchange="trackModeSelected(this.value)" />
          <span class="mode-title">Smart Crop</span>
          <span class="mode-help">Best default. Finds label content, removes blank space, and auto-rotates.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="fit" ${checked('fit')} onchange="trackModeSelected(this.value)" />
          <span class="mode-title">Fit</span>
          <span class="mode-help">Safest. Keeps the whole page or image visible inside 4x6.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="fill" ${checked('fill')} onchange="trackModeSelected(this.value)" />
          <span class="mode-title">Fill</span>
          <span class="mode-help">Fills the entire 4x6 label. May crop edges.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="autorotate" ${checked('autorotate')} onchange="trackModeSelected(this.value)" />
          <span class="mode-title">Auto-Rotate</span>
          <span class="mode-help">Keeps content visible but rotates landscape labels.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="rotate90" ${checked('rotate90')} onchange="trackModeSelected(this.value)" />
          <span class="mode-title">Rotate 90°</span>
          <span class="mode-help">Manual rescue option for labels facing the wrong direction.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="split2" ${checked('split2')} onchange="trackModeSelected(this.value)" />
          <span class="mode-title">Split 2 Labels</span>
          <span class="mode-help">Splits an 8.5x11 sheet into top and bottom label sections.</span>
        </label>

        <label class="mode-card">
          <input type="radio" name="mode" value="split4" ${checked('split4')} onchange="trackModeSelected(this.value)" />
          <span class="mode-title">Split 4 Labels</span>
          <span class="mode-help">Splits a sheet into four sections and converts non-blank labels.</span>
        </label>
      </div>

      <button type="submit" class="btn full">Convert Now</button>
    </form>
  `;
}

function printerRescueKit() {
  return `
    <div class="card compact">
      <h2>Printer Rescue Kit</h2>
      <p class="muted">Quick tools for the problems sellers actually run into after the label is converted.</p>
      <div class="tool-grid">
        <a class="tool-card" href="/test-print.pdf" onclick="trackTestLabelClick();">
          <strong>Print Test Label</strong>
          <span>Download a 4x6 calibration PDF.</span>
        </a>
        <a class="tool-card" href="/print-settings">
          <strong>Print Settings</strong>
          <span>Stop scaling, shrinking, and sideways prints.</span>
        </a>
        <a class="tool-card" href="/troubleshooting">
          <strong>Troubleshooting</strong>
          <span>Fix tiny labels, margins, and barcode issues.</span>
        </a>
        <a class="tool-card" href="#" onclick="bookmarkHelp(); return false;">
          <strong>Bookmark Tool</strong>
          <span>Save this converter for your next shipment.</span>
        </a>
      </div>
    </div>
  `;
}

app.get('/', (req, res) => {
  res.send(
    pageTemplate({
      title: 'Convert Shipping Labels to 4x6',
      canonicalPath: '/',
      pageType: 'home_converter',
      description: 'Free smart crop tool to convert PDF, PNG, JPG, and WEBP shipping labels into clean 4x6 thermal printer PDFs.',
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
            <span class="pill">No Signup</span>
          </div>
        </section>

        <div class="card" style="text-align:center;">
          <h2>Upload Your Label</h2>
          <p>Default mode uses Smart Crop to find the actual label, remove blank space, rotate when needed, and rebuild a clean 4x6 PDF.</p>
          ${converterForm()}
          <div class="success-box">
            <strong>Privacy:</strong> No account required. Uploaded and converted files are temporary and automatically deleted.
          </div>
        </div>

        <div class="feature-grid">
          <div class="feature"><strong>PDF + Image Uploads</strong><span class="muted">Convert PDFs, screenshots, PNGs, JPGs, JPEGs, and WEBP files.</span></div>
          <div class="feature"><strong>Smart Crop</strong><span class="muted">Removes blank page space around your label.</span></div>
          <div class="feature"><strong>Split Sheets</strong><span class="muted">Pull labels from 2-up and 4-up sheet layouts.</span></div>
        </div>

        ${printerRescueKit()}

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

app.post('/convert', handleUpload, async (req, res) => {
  const startedAt = Date.now();

  if (!req.file) {
    return res.status(400).send(
      pageTemplate({
        title: 'No File Uploaded',
        canonicalPath: '/',
        robots: 'noindex, nofollow',
        pageType: 'no_file_uploaded',
        description: 'No file was uploaded for conversion.',
        content: `<div class="card"><h1>No File Uploaded</h1><p>Please upload a PDF or image shipping label and try again.</p><a href="/" class="btn">Try Again</a></div>`
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
    const processingMs = Date.now() - startedAt;

    logConversionEvent({
      event: 'convert_success',
      success: true,
      mode: selectedMode,
      fileKind,
      inputPages: result.inputPages,
      outputPages: result.outputPages,
      processingMs,
      warning: result.warning
    });

    const warningBox = result.warning
      ? `<div class="danger-box"><strong>Note:</strong><p>${escapeHtml(result.warning)}</p></div>`
      : '';

    res.send(
      pageTemplate({
        title: 'Label Ready',
        canonicalPath: '/',
        robots: 'noindex, nofollow',
        pageType: 'conversion_success',
        description: 'Your converted 4x6 thermal shipping label is ready to download.',
        content: `
          <div class="card">
            <h1>Success! Your 4x6 Label Is Ready</h1>
            <p class="muted">Preview it below, then download your converted PDF. Converted files expire automatically.</p>

            <iframe class="preview-frame" src="/preview/${outName}"></iframe>

            <div class="social-row">
              <a href="/download/${outName}" class="btn" download onclick="trackDownload(${jsValue(outName)}, ${jsValue(selectedMode)}, ${jsValue(fileKind)}, ${jsValue(result.outputPages)});">Download PDF</a>
              <a href="/print-settings" class="btn secondary">Print Settings</a>
              <a href="/test-print.pdf" class="btn secondary" onclick="trackTestLabelClick();">Test Label</a>
              <a href="/" class="btn secondary">Convert Another</a>
              <button onclick="copySiteLink()" class="btn secondary">Copy Link</button>
            </div>

            <div class="success-box">
              <strong>Converted with ${escapeHtml(modeLabel(selectedMode))} mode.</strong>
              <p style="margin-bottom:0;">Input pages: ${escapeHtml(result.inputPages)}. Output 4x6 pages: ${escapeHtml(result.outputPages)}. Processing time: ${escapeHtml(processingMs)}ms. If the output looks too zoomed in, try Fit mode. If it has too much white space, try Smart Crop or Fill.</p>
            </div>

            ${warningBox}

            <div class="card compact">
              <h2>Best Print Settings</h2>
              <ol class="steps">
                <li>Open the downloaded PDF.</li>
                <li>Choose your thermal printer.</li>
                <li>Set paper size to <strong>4 x 6 inches</strong>.</li>
                <li>Set scaling to <strong>Actual Size</strong> or <strong>100%</strong>.</li>
                <li>Turn off “Fit to page” if your label prints small.</li>
              </ol>
            </div>

            <div class="money-box">
              <h3>Printer Troubles?</h3>
              <p>Upgrade to a wireless setup. See our <a href="/best-thermal-printers" onclick="trackPrinterGuideClick();">2026 Thermal Printer Guide</a>.</p>
            </div>

            <script>
              trackEvent('convert_success', {
                mode: ${jsValue(selectedMode)},
                file_type: ${jsValue(fileKind)},
                input_pages: ${jsValue(result.inputPages)},
                output_pages: ${jsValue(result.outputPages)},
                processing_ms: ${jsValue(processingMs)},
                used_fallback: ${jsValue(Boolean(result.warning))}
              });
            </script>
          </div>
        `
      })
    );
  } catch (err) {
    const processingMs = Date.now() - startedAt;

    console.error(err);

    logConversionEvent({
      event: 'convert_failed',
      success: false,
      mode: selectedMode,
      fileKind,
      inputPages: 0,
      outputPages: 0,
      processingMs,
      warning: false,
      error: err.message
    });

    res.status(500).send(
      pageTemplate({
        title: 'Conversion Failed',
        canonicalPath: '/',
        robots: 'noindex, nofollow',
        pageType: 'conversion_failed',
        description: 'The label conversion failed.',
        content: `
          <div class="card">
            <h1>Conversion Failed</h1>
            <div class="danger-box"><p>${escapeHtml(err.message)}</p></div>
            <h2>Try This</h2>
            <ol class="steps">
              <li>Try <strong>Fit</strong> mode first.</li>
              <li>If your label is sideways, try <strong>Rotate 90°</strong>.</li>
              <li>If your label has large blank space, try <strong>Smart Crop</strong>.</li>
              <li>If it is a sheet with multiple labels, try <strong>Split 2</strong> or <strong>Split 4</strong>.</li>
            </ol>
            <a href="/" class="btn">Try Again</a>

            <script>
              trackEvent('convert_failed', {
                mode: ${jsValue(selectedMode)},
                file_type: ${jsValue(fileKind)},
                reason: ${jsValue(err.message)},
                processing_ms: ${jsValue(processingMs)}
              });
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

app.get('/preview/:filename', (req, res) => sendConvertedPdf(req, res, 'inline'));
app.get('/download/:filename', (req, res) => sendConvertedPdf(req, res, 'attachment'));

app.get('/test-print.pdf', async (req, res) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([TARGET_WIDTH_POINTS, TARGET_HEIGHT_POINTS]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 8, y: 8, width: 272, height: 416, borderWidth: 2, borderColor: rgb(0, 0, 0) });
  page.drawRectangle({ x: 24, y: 24, width: 240, height: 384, borderWidth: 1, borderColor: rgb(0.3, 0.3, 0.3) });
  page.drawText('4 x 6 Thermal Printer Test', { x: 42, y: 372, size: 18, font: bold, color: rgb(0, 0, 0) });
  page.drawText('Print at Actual Size / 100%', { x: 62, y: 344, size: 13, font: regular, color: rgb(0, 0, 0) });
  page.drawText('If this border is cut off, your printer is scaling or using the wrong paper size.', {
    x: 28,
    y: 305,
    size: 9,
    font: regular,
    color: rgb(0, 0, 0),
    maxWidth: 232
  });
  page.drawText('PDFtoThermal.com', { x: 88, y: 52, size: 14, font: bold, color: rgb(0, 0, 0) });

  const bytes = await pdfDoc.save();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="4x6-thermal-test-label.pdf"');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.send(Buffer.from(bytes));
});

app.get('/etsy-label-fix', (req, res) => {
  res.send(pageTemplate({
    title: 'Fix Etsy Labels Printing Too Small',
    canonicalPath: '/etsy-label-fix',
    pageType: 'seo_etsy',
    description: 'Fix Etsy shipping labels that print too small, sideways, or stuck in the corner. Convert Etsy labels to clean 4x6 thermal printer PDFs.',
    content: `<div class="card"><h1>How to Fix Etsy Labels Printing Too Small</h1><p>Are your Etsy labels printing tiny, sideways, or stuck in the corner of your 4x6 thermal paper? This usually happens when Etsy provides a full-page PDF instead of a thermal-printer-ready label.</p><h2>Common Etsy Label Problems</h2><ul><li>Label prints tiny in one corner</li><li>Barcode is too small to scan</li><li>Extra margins waste thermal labels</li><li>Label downloads as an 8.5x11 PDF</li></ul><h2>How to Fix It</h2><ol class="steps"><li>Download your Etsy shipping label as a PDF.</li><li>Upload it to PDF to Thermal.</li><li>Use Smart Crop mode.</li><li>Download the converted 4x6 PDF.</li></ol><a href="/" class="btn">Convert Etsy Label</a></div>`
  }));
});

app.get('/ebay-standard-envelope', (req, res) => {
  res.send(pageTemplate({
    title: 'eBay Standard Envelope Label to 4x6',
    canonicalPath: '/ebay-standard-envelope',
    pageType: 'seo_ebay',
    description: 'Convert eBay Standard Envelope and eBay shipping labels into clean 4x6 thermal printer PDFs.',
    content: `<div class="card"><h1>Convert eBay Standard Envelope Labels to 4x6</h1><p>eBay Standard Envelope labels can download in a format that does not print cleanly on 4x6 thermal printers. They may print sideways, too small, or with too much blank space.</p><h2>What This Tool Does</h2><ul><li>Resizes eBay labels to 4x6</li><li>Helps rotate wide labels</li><li>Removes blank margins with Smart Crop</li><li>Creates a cleaner PDF for thermal printers</li></ul><a href="/" class="btn">Convert eBay Label</a></div>`
  }));
});

app.get('/tiktok-shop-fix', (req, res) => {
  res.send(pageTemplate({
    title: 'TikTok Shop Label Resize Tool',
    canonicalPath: '/tiktok-shop-fix',
    pageType: 'seo_tiktok',
    description: 'Resize TikTok Shop shipping labels for 4x6 thermal printers. Fix labels that print too small, sideways, or with large margins.',
    content: `<div class="card"><h1>Fix TikTok Shop Labels for 4x6 Thermal Printers</h1><p>If your TikTok Shop shipping label prints too small, sideways, or with extra margins, upload it here and convert it to a clean 4x6 thermal label.</p><h2>Best For</h2><ul><li>TikTok Shop seller labels</li><li>Marketplace shipping PDFs</li><li>4x6 thermal printer output</li><li>Labels with blank space around the barcode area</li></ul><a href="/" class="btn">Resize TikTok Shop Label</a></div>`
  }));
});

app.get('/amazon-fnsku-resize', (req, res) => {
  res.send(pageTemplate({
    title: 'Amazon FNSKU Label Resize Tool',
    canonicalPath: '/amazon-fnsku-resize',
    pageType: 'seo_amazon',
    description: 'Prepare Amazon FNSKU, FBA, and product labels for thermal label printing.',
    content: `<div class="card"><h1>Resize Amazon FNSKU Labels for Thermal Printers</h1><p>Prepare Amazon FNSKU, FBA, and product label PDFs for cleaner thermal label printing.</p><h2>Use This For</h2><ul><li>Amazon FBA labels</li><li>Amazon FNSKU labels</li><li>Product barcode labels</li><li>Shipping label PDFs</li></ul><a href="/" class="btn">Convert Amazon Label</a></div>`
  }));
});

app.get('/image-to-4x6', (req, res) => {
  res.send(pageTemplate({
    title: 'Convert PNG or JPG Label to 4x6 PDF',
    canonicalPath: '/image-to-4x6',
    pageType: 'image_converter',
    description: 'Convert PNG, JPG, JPEG, or WEBP shipping label screenshots into clean 4x6 thermal printer PDF files.',
    content: `<div class="card"><h1>Convert PNG or JPG Labels to 4x6 PDF</h1><p>Have a screenshot or downloaded image label instead of a PDF? Upload your PNG, JPG, JPEG, or WEBP file and convert it into a 4x6 thermal-printer-ready PDF.</p><h2>Best Uses</h2><ul><li>Screenshot labels</li><li>Mobile app label downloads</li><li>PNG and JPG shipping labels</li><li>Marketplace labels saved as images</li></ul>${converterForm()}</div>`
  }));
});

app.get('/split-label-sheet', (req, res) => {
  res.send(pageTemplate({
    title: 'Split 8.5x11 Label Sheets into 4x6 Labels',
    canonicalPath: '/split-label-sheet',
    pageType: 'split_sheet_converter',
    description: 'Split 8.5x11 PDF label sheets into separate 4x6 thermal printer label PDFs using 2-label or 4-label split modes.',
    content: `<div class="card"><h1>Split 8.5x11 Label Sheets into 4x6 Labels</h1><p>Some marketplaces download labels as full-page sheets with multiple labels. Use Split 2 Labels or Split 4 Labels mode to pull the non-blank label sections and convert each one into its own 4x6 page.</p><h2>Which Split Mode Should You Use?</h2><ul><li><strong>Split 2 Labels:</strong> best for top-and-bottom label sheets.</li><li><strong>Split 4 Labels:</strong> best for sheets with four label blocks or smaller barcode labels.</li><li><strong>Smart Crop:</strong> best when there is only one label on the page.</li></ul>${converterForm('split2')}</div>`
  }));
});

app.get('/print-settings', (req, res) => {
  res.send(pageTemplate({
    title: 'Best 4x6 Thermal Printer Settings',
    canonicalPath: '/print-settings',
    pageType: 'print_settings',
    description: 'Recommended printer settings for 4x6 thermal labels, including Actual Size, 100% scale, and correct paper size.',
    content: `
      <div class="card">
        <h1>Best 4x6 Thermal Printer Settings</h1>
        <p>Most bad label prints are caused by scaling. Use these settings after downloading your converted label.</p>
        <div class="instruction-grid">
          <div class="instruction"><h2>Windows</h2><ol class="steps"><li>Open the converted PDF.</li><li>Select your thermal printer.</li><li>Set paper size to 4 x 6 inches.</li><li>Set scale to Actual Size or 100%.</li><li>Disable Fit to Page.</li></ol></div>
          <div class="instruction"><h2>Mac</h2><ol class="steps"><li>Open the converted PDF in Preview.</li><li>Choose File &gt; Print.</li><li>Select your thermal printer.</li><li>Set paper size to 4 x 6.</li><li>Set scale to 100%.</li></ol></div>
        </div>
        <div class="social-row"><a href="/test-print.pdf" class="btn" onclick="trackTestLabelClick();">Download Test Label</a><a href="/" class="btn secondary">Convert a Label</a></div>
      </div>`
  }));
});

app.get('/troubleshooting', (req, res) => {
  res.send(pageTemplate({
    title: 'Thermal Label Troubleshooting',
    canonicalPath: '/troubleshooting',
    pageType: 'troubleshooting',
    description: 'Fix common thermal label printing problems like tiny labels, sideways labels, extra margins, and unscannable barcodes.',
    content: `
      <div class="card">
        <h1>Thermal Label Troubleshooting</h1>
        <h2>Label prints tiny</h2><p>Use Smart Crop, then print at Actual Size or 100%. Turn off Fit to Page.</p>
        <h2>Label is sideways</h2><p>Use Auto-Rotate or Rotate 90° mode.</p>
        <h2>Too much white space</h2><p>Use Smart Crop first. If there is still too much margin, try Fill mode.</p>
        <h2>Barcode is cut off</h2><p>Use Fit mode. Fill mode can crop edges if the original label shape does not match 4x6.</p>
        <h2>Multiple labels on one sheet</h2><p>Use Split 2 Labels or Split 4 Labels mode.</p>
        <div class="social-row"><a href="/" class="btn">Try Converter</a><a href="/print-settings" class="btn secondary">Print Settings</a></div>
      </div>`
  }));
});

app.get('/best-thermal-printers', (req, res) => {
  res.send(pageTemplate({
    title: 'Best Thermal Printers 2026',
    canonicalPath: '/best-thermal-printers',
    pageType: 'affiliate_printer_guide',
    description: 'A simple guide to the best thermal printers for online sellers using Etsy, eBay, Amazon, TikTok Shop, Shopify, USPS, UPS, and FedEx.',
    content: `<div class="card"><h1>Best Thermal Printers for Sellers in 2026</h1><p>A good thermal printer can save time, reduce wasted labels, and make shipping faster for Etsy, eBay, Amazon, Shopify, and TikTok Shop sellers.</p><h2>What to Look For</h2><ul><li>4x6 label support</li><li>USB and wireless options</li><li>Mac and Windows compatibility</li><li>Reliable barcode clarity</li><li>Easy driver setup</li></ul><h2>Recommended Wireless Thermal Printer</h2><p>For many sellers, a wireless 4x6 thermal printer is the easiest setup because it works with laptop and mobile workflows.</p><a href="https://www.amazon.com/dp/B08MBYJR7C?tag=${AMZ_ID}" class="btn" rel="sponsored nofollow" onclick="trackAffiliateClick('thermal_printer');">View Thermal Printer on Amazon</a></div>`
  }));
});

app.get('/analytics-check', (req, res) => {
  res.send(pageTemplate({
    title: 'Analytics Check',
    canonicalPath: '/analytics-check',
    robots: 'noindex, nofollow',
    pageType: 'analytics_check',
    description: 'Analytics check page.',
    content: `
      <div class="card">
        <h1>Analytics Check</h1>
        <p>This page is for verifying that Google Analytics events are firing.</p>
        <p><strong>GA ID:</strong> ${escapeHtml(GA_ID)}</p>
        <div class="social-row">
          <button class="btn" onclick="trackEvent('analytics_test_click', { test_value: 'manual_button' }); alert('Test event fired. Check GA DebugView or Realtime.');">Fire Test Event</button>
          <a href="/" class="btn secondary">Back to Converter</a>
        </div>
      </div>
    `
  }));
});

app.get('/faq', (req, res) => {
  res.send(pageTemplate({
    title: 'FAQ',
    canonicalPath: '/faq',
    pageType: 'faq',
    description: 'Frequently asked questions about converting shipping labels into 4x6 thermal printer PDFs.',
    content: `<div class="card"><h1>FAQ</h1><h2>What file types do you support?</h2><p>We support PDF, PNG, JPG, JPEG, and WEBP label files.</p><h2>What does Smart Crop do?</h2><p>Smart Crop detects the non-white label area, removes extra blank space, rotates landscape labels when needed, and rebuilds the result as a clean 4x6 PDF.</p><h2>What does Split 2 Labels do?</h2><p>Split 2 Labels divides each page into a top half and bottom half, detects non-blank sections, and converts each detected label into a separate 4x6 page.</p><h2>What does Split 4 Labels do?</h2><p>Split 4 Labels divides each page into four sections, detects non-blank sections, and converts each detected section into a separate 4x6 page.</p><h2>Does this work for screenshots?</h2><p>Yes. Upload a PNG, JPG, JPEG, or WEBP screenshot and use Smart Crop or Fit mode.</p><h2>Are uploaded files stored forever?</h2><p>No. Uploaded and converted files are temporary and are cleaned from the server automatically.</p></div>`
  }));
});

app.get('/privacy', (req, res) => {
  res.send(pageTemplate({
    title: 'Privacy Policy',
    canonicalPath: '/privacy',
    pageType: 'privacy',
    description: 'Privacy policy for PDF to Thermal, including how uploaded label files are handled.',
    content: `<div class="card"><h1>Privacy Policy</h1><p>PDF to Thermal processes uploaded files temporarily for conversion purposes.</p><h2>Uploaded Files</h2><p>Uploaded and converted files are stored temporarily and automatically deleted from the server after a short period of time.</p><h2>Analytics</h2><p>This website uses Google Analytics to understand website traffic and improve the service.</p><h2>Affiliate Links</h2><p>Some links on this website may be affiliate links. If you purchase through those links, we may earn a commission at no additional cost to you.</p><h2>Personal Information</h2><p>We do not sell uploaded documents or personal information.</p><h2>Contact</h2><p>For questions, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p></div>`
  }));
});

app.get('/terms', (req, res) => {
  res.send(pageTemplate({
    title: 'Terms of Use',
    canonicalPath: '/terms',
    pageType: 'terms',
    description: 'Terms of use for PDF to Thermal.',
    content: `<div class="card"><h1>Terms of Use</h1><p>PDF to Thermal is provided as a free utility. Users are responsible for confirming that converted labels print correctly and remain scannable before shipping packages.</p><h2>No Warranty</h2><p>This tool is provided as-is without warranties. Always verify the final label before use.</p><h2>Acceptable Use</h2><p>Do not upload illegal, harmful, or unrelated documents. This service is intended for shipping labels and marketplace label formatting.</p><h2>Contact</h2><p>Questions can be sent to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p></div>`
  }));
});

app.get('/contact', (req, res) => {
  res.send(pageTemplate({
    title: 'Contact',
    canonicalPath: '/contact',
    pageType: 'contact',
    description: 'Contact PDF to Thermal support.',
    content: `<div class="card"><h1>Contact PDF to Thermal</h1><p>Need help with a label conversion issue or printer setting question?</p><p>Email: <a href="mailto:${SUPPORT_EMAIL}?subject=PDF%20to%20Thermal%20Support">${SUPPORT_EMAIL}</a></p><p>Please describe the marketplace, printer model, and which conversion mode you tried. Do not email sensitive documents unless necessary.</p><a href="/" class="btn">Back to Converter</a></div>`
  }));
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /preview/
Disallow: /download/
Disallow: /analytics-check

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  const pages = [
    '/',
    '/etsy-label-fix',
    '/ebay-standard-envelope',
    '/tiktok-shop-fix',
    '/amazon-fnsku-resize',
    '/image-to-4x6',
    '/split-label-sheet',
    '/print-settings',
    '/troubleshooting',
    '/best-thermal-printers',
    '/faq',
    '/privacy',
    '/terms',
    '/contact'
  ];

  const urls = pages.map((page) => `
  <url>
    <loc>${SITE_URL}${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('');

  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'pdf-to-thermal',
    phase: 4,
    analytics: true,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).send(
    pageTemplate({
      title: 'Page Not Found',
      canonicalPath: req.path,
      robots: 'noindex, nofollow',
      pageType: 'not_found',
      description: 'The requested page could not be found.',
      content: `<div class="card"><h1>Page Not Found</h1><p>The page you are looking for does not exist.</p><a href="/" class="btn">Go to Converter</a></div>`
    })
  );
});

setInterval(cleanup, 15 * 60 * 1000);
cleanup();

app.listen(PORT, () => {
  console.log(`PDF to Thermal live on port ${PORT}`);
});
