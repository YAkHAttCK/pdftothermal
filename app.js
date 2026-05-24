const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, degrees } = require('pdf-lib');

const app = express();

const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://pdftothermal.com';
const SUPPORT_EMAIL = 'support@pdftothermal.com';
const GA_ID = 'G-CV6R7PF4PH';
const AMZ_ID = 'pdftothermal-20';

// Setup directories
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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
  }
});

app.use(express.urlencoded({ extended: true }));
app.use('/downloads', express.static(downloadsDir));

// Clean up old files
function cleanup() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000;

  [uploadsDir, downloadsDir].forEach((dir) => {
    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);

      try {
        if (now - fs.statSync(filePath).mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Cleanup failed for ${filePath}:`, err.message);
      }
    });
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

// Master Page Template
function pageTemplate({ title, description, content, canonicalPath = '/' }) {
  const metaDescription =
    description ||
    'Free tool to resize shipping labels into clean 4x6 thermal printer PDFs for Etsy, eBay, Amazon, TikTok Shop, and other marketplaces.';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
${googleTag()}
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${title} | PDF to Thermal</title>
  <meta name="description" content="${metaDescription}" />
  <link rel="canonical" href="${SITE_URL}${canonicalPath}" />

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
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--light);
      color: var(--dark);
      line-height: 1.6;
    }

    .container {
      max-width: 980px;
      margin: 0 auto;
      padding: 0 20px;
    }

    header {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 15px 0;
    }

    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .logo {
      font-size: 22px;
      font-weight: 800;
      color: var(--primary);
      text-decoration: none;
      white-space: nowrap;
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
      font-weight: 700;
      font-size: 14px;
    }

    nav a:hover {
      color: var(--primary);
    }

    .hero {
      padding: 38px 0 10px;
      text-align: center;
    }

    .card {
      background: #ffffff;
      padding: 30px;
      border-radius: 20px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      border: 1px solid var(--border);
      margin-top: 24px;
    }

    .btn {
      background: var(--primary);
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 10px;
      text-decoration: none;
      display: inline-block;
      font-weight: 800;
      border: none;
      cursor: pointer;
      font-size: 15px;
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

    .preview-frame {
      width: 100%;
      height: 520px;
      border: 1px solid var(--border);
      border-radius: 12px;
      margin: 20px 0;
      background: #f1f5f9;
    }

    .money-box {
      background: var(--warning-bg);
      border: 1px solid var(--warning-border);
      padding: 20px;
      border-radius: 14px;
      margin-top: 25px;
    }

    .social-row {
      display: flex;
      gap: 10px;
      margin: 20px 0;
      flex-wrap: wrap;
    }

    h1 {
      font-size: 34px;
      line-height: 1.15;
      margin: 0 0 12px;
    }

    h2 {
      font-size: 24px;
      line-height: 1.25;
      margin-top: 28px;
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
      max-width: 420px;
      padding: 14px;
      border: 1px dashed var(--border);
      border-radius: 12px;
      background: var(--light);
      margin-bottom: 18px;
    }

    .mode-row {
      display: flex;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 20px;
      font-size: 15px;
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
      font-weight: 700;
      background: #ffffff;
      border: 1px solid var(--border);
      padding: 16px;
      border-radius: 14px;
    }

    .seo-grid a:hover {
      border-color: var(--primary);
    }

    footer {
      background: var(--dark);
      color: #ffffff;
      padding: 30px 0;
      text-align: center;
      margin-top: 50px;
      font-size: 13px;
    }

    footer a {
      color: #ffffff;
    }

    @media (max-width: 700px) {
      .header-inner {
        flex-direction: column;
        align-items: flex-start;
      }

      nav {
        justify-content: flex-start;
      }

      h1 {
        font-size: 28px;
      }

      .seo-grid {
        grid-template-columns: 1fr;
      }

      .card {
        padding: 22px;
      }
    }
  </style>
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

// Process multi-page PDF into 4x6 thermal label size
async function processPdf(inputPath, outputPath, mode) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const existingPdf = await PDFDocument.load(existingPdfBytes);

  const newPdf = await PDFDocument.create();
  const pageIndices = existingPdf.getPageIndices();
  const copiedPages = await newPdf.copyPages(existingPdf, pageIndices);

  for (const copiedPage of copiedPages) {
    const originalSize = copiedPage.getSize();
    const originalWidth = originalSize.width;
    const originalHeight = originalSize.height;

    const targetWidth = 288;
    const targetHeight = 432;

    const isLandscape = originalWidth > originalHeight;
    const shouldRotate =
      (mode === 'autorotate' && isLandscape) ||
      (mode === 'fill' && isLandscape);

    const effectiveWidth = shouldRotate ? originalHeight : originalWidth;
    const effectiveHeight = shouldRotate ? originalWidth : originalHeight;

    const scale =
      mode === 'fill'
        ? Math.max(targetWidth / effectiveWidth, targetHeight / effectiveHeight)
        : Math.min(targetWidth / effectiveWidth, targetHeight / effectiveHeight);

    const scaledWidth = effectiveWidth * scale;
    const scaledHeight = effectiveHeight * scale;

    const page = newPdf.addPage([targetWidth, targetHeight]);

    if (shouldRotate) {
      page.drawPage(copiedPage, {
        x: (targetWidth - scaledWidth) / 2 + scaledWidth,
        y: (targetHeight - scaledHeight) / 2,
        xScale: scale,
        yScale: scale,
        rotate: degrees(90)
      });
    } else {
      page.drawPage(copiedPage, {
        x: (targetWidth - scaledWidth) / 2,
        y: (targetHeight - scaledHeight) / 2,
        xScale: scale,
        yScale: scale
      });
    }
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
        'Free online tool to convert shipping label PDFs into clean 4x6 thermal printer labels for Etsy, eBay, Amazon, TikTok Shop, and more.',
      content: `
        <section class="hero">
          <h1>Resize Shipping Labels to 4x6</h1>
          <p class="muted">The fast, free fix for Etsy, eBay, Amazon, TikTok Shop, and other marketplace labels.</p>
        </section>

        <div class="card" style="text-align:center;">
          <h2>Upload Your Label PDF</h2>
          <p>Convert your label into a clean 4x6 thermal-printer-ready PDF.</p>

          <form class="upload-box" action="/convert" method="POST" enctype="multipart/form-data">
            <input type="file" name="labelFile" accept="application/pdf,.pdf" required />

            <div class="mode-row">
              <label>
                <input type="radio" name="mode" value="fit" checked />
                Fit / safest
              </label>

              <label>
                <input type="radio" name="mode" value="fill" />
                Fill / no margins
              </label>

              <label>
                <input type="radio" name="mode" value="autorotate" />
                Auto-rotate
              </label>
            </div>

            <button type="submit" class="btn">Convert Now</button>
          </form>
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
app.post('/convert', upload.single('labelFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file was uploaded.');
  }

  cleanup();

  const mode = req.body.mode || 'fit';
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
              <a href="/downloads/${outName}" class="btn" download>Download PDF</a>
              <a href="/" class="btn secondary">Convert Another</a>
              <button onclick="navigator.clipboard.writeText('${SITE_URL}'); alert('Link copied!')" class="btn secondary">
                Copy Link to Share
              </button>
            </div>

            <div class="money-box">
              <h3>Printer Troubles?</h3>
              <p>Upgrade to a wireless setup. See our <a href="/best-thermal-printers">2026 Thermal Printer Guide</a>.</p>
            </div>
          </div>
        `
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).send(`Conversion failed: ${err.message}`);
  } finally {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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
        'Fix Etsy shipping labels that print too small, sideways, or stuck in the corner. Convert Etsy labels to 4x6 thermal printer PDFs.',
      content: `
        <div class="card">
          <h1>How to Fix Etsy Labels Printing Too Small</h1>
          <p>Are your Etsy labels printing tiny, sideways, or stuck in the corner of your 4x6 paper? This usually happens when Etsy provides a full-page PDF instead of a thermal-printer-ready label.</p>

          <h2>Common Etsy Label Problems</h2>
          <ul>
            <li>Label prints tiny in one corner</li>
            <li>Barcode is too small to scan</li>
            <li>Extra margins waste thermal labels</li>
            <li>Label downloads as an 8.5x11 PDF</li>
          </ul>

          <p>Upload your Etsy label and convert it into a clean 4x6 PDF for your thermal printer.</p>

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
        'Convert eBay Standard Envelope and eBay shipping labels into 4x6 thermal printer PDFs.',
      content: `
        <div class="card">
          <h1>Convert eBay Standard Envelope Labels to 4x6</h1>
          <p>eBay Standard Envelope labels can download in a format that does not print cleanly on 4x6 thermal printers. They may print sideways, too small, or with too much blank space.</p>

          <h2>What This Tool Does</h2>
          <ul>
            <li>Resizes eBay labels to 4x6</li>
            <li>Helps rotate wide labels</li>
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
        'A simple guide to the best thermal printers for online sellers using Etsy, eBay, Amazon, TikTok Shop, and Shopify.',
      content: `
        <div class="card">
          <h1>Best Thermal Printers for Sellers in 2026</h1>
          <p>A good thermal printer can save time, reduce wasted labels, and make shipping faster for Etsy, eBay, Amazon, Shopify, and TikTok Shop sellers.</p>

          <h2>Recommended Wireless Thermal Printer</h2>
          <p>For many sellers, a wireless 4x6 thermal printer is the easiest setup because it works with laptops and mobile workflows.</p>

          <a href="https://www.amazon.com/dp/B08MBYJR7C?tag=${AMZ_ID}" class="btn" rel="sponsored nofollow">
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
          <p>We currently support PDF label files.</p>

          <h2>Does this work for Etsy?</h2>
          <p>Yes. This tool is built to help resize Etsy shipping labels into a 4x6 thermal printer format.</p>

          <h2>Does this work for eBay?</h2>
          <p>Yes. It can help with eBay shipping labels and eBay Standard Envelope label formatting.</p>

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
          <p>Uploaded and converted files are automatically deleted from the server after a short period of time.</p>

          <h2>Analytics</h2>
          <p>This website uses Google Analytics to understand website traffic and improve the service.</p>

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

app.listen(PORT, () => {
  console.log(`PDF to Thermal live on port ${PORT}`);
});
