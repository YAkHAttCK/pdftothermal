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
const AMZ_ID = 'pdftothermal-20';

// Setup directories
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');
[uploadsDir, downloadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.use(express.urlencoded({ extended: true }));
app.use('/downloads', express.static(downloadsDir));

// Clean up old files
function cleanup() {
  const now = Date.now();
  [uploadsDir, downloadsDir].forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      if (now - fs.statSync(filePath).mtimeMs > 3600000) fs.unlinkSync(filePath);
    });
  });
}

// Master Page Template
function pageTemplate({ title, content, canonicalPath = '/' }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | PDF to Thermal</title>
    <link rel="canonical" href="${SITE_URL}${canonicalPath}" />
    <style>
      :root { --primary: #2563eb; --dark: #0f172a; --light: #f8fafc; --border: #e2e8f0; --accent: #eff6ff; }
      body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: var(--light); color: var(--dark); line-height: 1.6; }
      .container { max-width: 900px; margin: 0 auto; padding: 0 20px; }
      header { padding: 15px 0; border-bottom: 1px solid var(--border); background: white; display: flex; justify-content: space-between; align-items: center; }
      .logo { font-size: 22px; font-weight: 800; color: var(--primary); text-decoration: none; }
      nav a { margin-left: 15px; text-decoration: none; color: #64748b; font-weight: 600; font-size: 14px; }
      .card { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid var(--border); margin-top: 20px; }
      .btn { background: var(--primary); color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; display: inline-block; font-weight: 700; border: none; cursor: pointer; }
      .btn.secondary { background: var(--accent); color: var(--primary); }
      .preview-frame { width: 100%; height: 500px; border: 1px solid var(--border); border-radius: 12px; margin: 20px 0; background: #eee; }
      .money-box { background: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 14px; margin-top: 25px; }
      footer { background: var(--dark); color: white; padding: 30px 0; text-align: center; margin-top: 50px; font-size: 13px; }
      .social-row { display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap; }
      h1 { font-size: 28px; line-height: 1.2; }
      .seo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 30px; font-size: 13px; }
      .seo-grid a { color: var(--primary); text-decoration: none; }
    </style>
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
  </head>
  <body>
    <header><div class="container" style="display:flex; justify-content:space-between; width:100%;"><a href="/" class="logo">PDF to Thermal</a><nav><a href="/best-thermal-printers">Best Printers</a><a href="/faq">FAQ</a></nav></div></header>
    <div class="container">${content}</div>
    <footer><p>&copy; 2026 PDF to Thermal | <a href="/privacy" style="color:white">Privacy</a> | support@pdftothermal.com</p></footer>
  </body>
  </html>`;
}

// Logic: Process multi-page PDF with smarter crop/rotate
async function processPdf(inputPath, outputPath, mode) {
  const existingPdf = await PDFDocument.load(fs.readFileSync(inputPath));
  const newPdf = await PDFDocument.create();
  const pages = existingPdf.getPages();
  
  for (const copiedPage of await newPdf.copyPages(existingPdf, existingPdf.getPageIndices())) {
    const { width, height } = copiedPage.getSize();
    const isLandscape = width > height;
    const page = newPdf.addPage([288, 432]); // 4x6 scale

    // Auto-rotate wide labels (eBay Standard Envelope fix)
    const shouldRotate = (mode === 'autorotate' && isLandscape) || (mode === 'fill' && isLandscape);
    const effectiveWidth = shouldRotate ? height : width;
    const effectiveHeight = shouldRotate ? width : height;
    
    const scale = mode === 'fill' ? Math.max(288 / effectiveWidth, 432 / effectiveHeight) : Math.min(288 / effectiveWidth, 432 / effectiveHeight);
    
    page.drawPage(copiedPage, {
      x: shouldRotate ? 288 - (288 - effectiveWidth * scale) / 2 : (288 - effectiveWidth * scale) / 2,
      y: (432 - effectiveHeight * scale) / 2,
      xScale: scale, yScale: scale,
      rotate: shouldRotate ? degrees(90) : undefined
    });
  }
  fs.writeFileSync(outputPath, await newPdf.save());
}

// Routes
app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'Convert Shipping Labels to 4x6',
    content: `
      <div class="card" style="text-align:center;">
        <h1>Resize Labels to 4x6</h1>
        <p>The fastest free fix for Etsy, eBay, and Amazon shipping labels.</p>
        <form action="/convert" method="POST" enctype="multipart/form-data">
          <input type="file" name="labelFile" required style="margin-bottom:20px;"/><br>
          <div style="margin-bottom:20px;">
            <label><input type="radio" name="mode" value="fit" checked> Fit (Safest)</label> &nbsp;
            <label><input type="radio" name="mode" value="fill"> Fill (No Margins)</label> &nbsp;
            <label><input type="radio" name="mode" value="autorotate"> Auto-Rotate</label>
          </div>
          <button type="submit" class="btn">Convert Now</button>
        </form>
      </div>
      <div class="seo-grid">
        <a href="/etsy-label-fix">Fix Etsy Labels printing small</a>
        <a href="/ebay-standard-envelope">eBay Standard Envelope to 4x6</a>
        <a href="/tiktok-shop-fix">TikTok Shop Label resizing</a>
        <a href="/amazon-fnsku-resize">Amazon FNSKU to Thermal</a>
      </div>`
  }));
});

// BATCH 1 SEO PAGES
app.get('/etsy-label-fix', (req, res) => {
  res.send(pageTemplate({
    title: 'Fix Etsy Labels Printing Too Small',
    canonicalPath: '/etsy-label-fix',
    content: `
      <div class="card">
        <h1>How to Fix Etsy Labels Printing in the Corner</h1>
        <p>Are your Etsy labels printing tiny or stuck in the corner of your 4x6 paper? This happens when Etsy provides an 8.5x11 PDF. Our tool auto-crops the label content and scales it to fill the 4x6 area perfectly.</p>
        <ul>
            <li>Eliminates tiny, unscannable barcodes</li>
            <li>No more manual screenshots or cropping in Adobe</li>
            <li>Works for Etsy return labels too</li>
        </ul>
        <a href="/" class="btn">Go to Etsy Converter</a>
      </div>`
  }));
});

app.post('/convert', upload.single('labelFile'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  cleanup();
  const outName = `converted-${Date.now()}.pdf`;
  const outPath = path.join(downloadsDir, outName);
  try {
    await processPdf(req.file.path, outPath, req.body.mode);
    res.send(pageTemplate({
      title: 'Label Ready',
      content: `
        <div class="card">
          <h1>Success! Your 4x6 Label is Ready</h1>
          <iframe class="preview-frame" src="/downloads/${outName}"></iframe>
          <div class="social-row">
            <a href="/downloads/${outName}" class="btn" download>Download PDF</a>
            <a href="/" class="btn secondary">Convert Another</a>
            <button onclick="navigator.clipboard.writeText('${SITE_URL}');alert('Link Copied!')" class="btn secondary">Copy Link to Share</button>
          </div>
          <div class="money-box">
            <h3>🖨️ Printer Troubles?</h3>
            <p>Upgrade to a wireless setup. See our <a href="/best-thermal-printers">2026 Thermal Printer Guide</a>.</p>
          </div>
        </div>`
    }));
  } catch (err) { res.status(500).send(err.message); }
  finally { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

// Existing affiliate and FAQ routes...
app.get('/best-thermal-printers', (req, res) => {
  res.send(pageTemplate({
    title: 'Best Thermal Printers 2026',
    content: `<div class="card"><h1>2026 Printer Guide</h1><p>Top picks for high-volume sellers.</p><a href="https://www.amazon.com/dp/B08MBYJR7C?tag=${AMZ_ID}" class="btn">View Rollo on Amazon</a></div>`
  }));
});

app.get('/faq', (req, res) => { res.send(pageTemplate({ title: 'FAQ', content: '<div class="card"><h1>FAQ</h1><p>We support PDF, PNG, and JPG.</p></div>' })); });

app.listen(PORT, () => console.log(`Rescue station live on ${PORT}`));
