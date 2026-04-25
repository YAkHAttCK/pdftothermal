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

// Middlewares
app.use(express.urlencoded({ extended: true }));
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Auto-cleanup files older than 1 hour
function cleanupOldFiles() {
  const now = Date.now();
  [uploadsDir, downloadsDir].forEach(dir => {
    try {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (now - fs.statSync(filePath).mtimeMs > 3600000) fs.unlinkSync(filePath);
      });
    } catch (e) {}
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.use('/downloads', express.static(downloadsDir));

// Master Page Template
function pageTemplate({ title = 'PDF to Thermal', content = '', canonicalPath = '/' }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="canonical" href="${SITE_URL}${canonicalPath}" />
    <style>
      :root { --primary: #2563eb; --dark: #0f172a; --light: #f8fafc; --border: #e2e8f0; --accent: #eff6ff; }
      body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: var(--light); color: var(--dark); line-height: 1.6; }
      .container { max-width: 900px; margin: 0 auto; padding: 0 20px; }
      header { padding: 20px 0; border-bottom: 1px solid var(--border); background: white; display: flex; justify-content: space-between; align-items: center; }
      .logo { font-size: 22px; font-weight: 800; color: var(--primary); text-decoration: none; }
      nav a { margin-left: 15px; text-decoration: none; color: #64748b; font-weight: 600; font-size: 14px; }
      .card { background: white; padding: 32px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid var(--border); margin-top: 30px; }
      .btn { background: var(--primary); color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; display: inline-block; font-weight: 700; border: none; cursor: pointer; transition: 0.2s; }
      .btn:hover { background: #1d4ed8; transform: translateY(-1px); }
      .btn.secondary { background: var(--accent); color: var(--primary); }
      .preview-frame { width: 100%; height: 550px; border: 1px solid var(--border); border-radius: 12px; margin: 20px 0; background: #eee; }
      .money-box { background: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 14px; margin-top: 25px; }
      footer { background: var(--dark); color: white; padding: 40px 0; text-align: center; margin-top: 60px; font-size: 14px; }
      h1 { font-size: 28px; margin-bottom: 10px; }
      .seo-links { margin-top: 40px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; font-size: 13px; }
      .seo-links a { color: var(--primary); text-decoration: none; background: white; padding: 8px; border-radius: 6px; border: 1px solid var(--border); text-align: center; }
    </style>
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config','${GA_ID}');</script>
  </head>
  <body>
    <header><div class="container" style="display:flex; justify-content:space-between; align-items:center; width:100%;"><a href="/" class="logo">PDF to Thermal</a><nav><a href="/best-thermal-printers">Best Printers</a><a href="/faq">FAQ</a></nav></div></header>
    <div class="container">${content}</div>
    <footer>
        <p>&copy; 2026 PDF to Thermal | <a href="/privacy" style="color:white">Privacy</a> | <a href="/terms" style="color:white">Terms</a></p>
        <p style="opacity:0.6">The world's favorite marketplace shipping label converter.</p>
    </footer>
  </body>
  </html>`;
}

// SEO Landing Page Helper
function renderSEOPage(req, res, h1, text, pathName) {
    res.send(pageTemplate({
        title: h1 + ' | PDF to Thermal',
        canonicalPath: pathName,
        content: `<div class="card"><h1>${h1}</h1><p>${text}</p><br><a href="/" class="btn">Go to Converter</a></div>`
    }));
}

// Logic Functions
async function imageToPdf(inputPath, outputPath, mode) {
  const metadata = await sharp(inputPath).metadata();
  const pipeline = mode === 'autorotate' && metadata.width > metadata.height ? sharp(inputPath).rotate(90) : sharp(inputPath);
  const imageBuffer = await pipeline.resize(1200, 1800, { fit: mode === 'fill' ? 'cover' : 'contain', background: { r: 255, g: 255, b: 255 } }).png().toBuffer();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([288, 432]);
  const embedded = await pdfDoc.embedPng(imageBuffer);
  page.drawImage(embedded, { x: 0, y: 0, width: 288, height: 432 });
  fs.writeFileSync(outputPath, await pdfDoc.save());
}

async function pdfTo4x6(inputPath, outputPath, mode) {
  const existingPdf = await PDFDocument.load(fs.readFileSync(inputPath));
  const newPdf = await PDFDocument.create();
  const pages = existingPdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const [copiedPage] = await newPdf.copyPages(existingPdf, [i]);
    const page = newPdf.addPage([288, 432]);
    const { width, height } = copiedPage.getSize();
    const shouldRotate = mode === 'autorotate' && width > height;
    const scale = Math.min(288 / (shouldRotate ? height : width), 432 / (shouldRotate ? width : height));
    page.drawPage(copiedPage, { 
        x: shouldRotate ? 288 - (288 - height * scale) / 2 : (288 - width * scale) / 2, 
        y: (432 - height * scale) / 2, 
        xScale: scale, yScale: scale, 
        rotate: shouldRotate ? degrees(90) : undefined 
    });
  }
  fs.writeFileSync(outputPath, await newPdf.save());
}

// ROUTES
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml`);
});

app.get('/sitemap.xml', (req, res) => {
  const paths = [
    '', '/best-thermal-printers', '/faq', '/privacy', '/terms',
    '/ebay-8-5x11-to-4x6', '/etsy-label-printing-too-small', '/poshmark-label-to-4x6', '/pirateship-label-to-4x6',
    '/amazon-seller-label-to-4x6', '/tiktok-shop-label-fix', '/walmart-marketplace-label-resizer', '/whatnot-label-to-4x6'
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${SITE_URL}${p}</loc></url>`).join('')}</urlset>`;
  res.type('application/xml').send(xml);
});

app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | Convert Shipping Labels to 4x6',
    content: `
      <div class="card" style="text-align:center;">
        <h1>Resize Labels to 4x6</h1>
        <p>The fastest way to fix shipping labels for your thermal printer.</p>
        <form action="/convert" method="POST" enctype="multipart/form-data" style="margin-top:20px;">
          <input type="file" name="labelFile" required style="margin-bottom:20px;"/><br>
          <div style="margin-bottom:20px;">
            <label><input type="radio" name="mode" value="fit" checked> Fit to Page</label> &nbsp;
            <label><input type="radio" name="mode" value="fill"> Fill Area</label> &nbsp;
            <label><input type="radio" name="mode" value="autorotate"> Auto Rotate</label>
          </div>
          <button type="submit" class="btn">Convert & Preview</button>
        </form>
      </div>
      <div class="seo-links">
        <a href="/amazon-seller-label-to-4x6">Amazon Seller Fix</a>
        <a href="/tiktok-shop-label-fix">TikTok Shop Labels</a>
        <a href="/ebay-8-5x11-to-4x6">eBay 8.5x11 to 4x6</a>
        <a href="/etsy-label-printing-too-small">Etsy Printing Fix</a>
        <a href="/walmart-marketplace-label-resizer">Walmart Labels</a>
        <a href="/whatnot-label-to-4x6">Whatnot Label Fix</a>
        <a href="/poshmark-label-to-4x6">Poshmark Converter</a>
        <a href="/pirateship-label-to-4x6">Pirate Ship to 4x6</a>
      </div>`
  }));
});

// Expanded SEO Batch
app.get('/amazon-seller-label-to-4x6', (req, res) => renderSEOPage(req, res, 'Amazon Seller Label to 4x6 Converter', 'Fix Amazon Seller Central shipping and FNSKU labels that are too large for your thermal printer.', '/amazon-seller-label-to-4x6'));
app.get('/tiktok-shop-label-fix', (req, res) => renderSEOPage(req, res, 'TikTok Shop Shipping Label 4x6 Fix', 'Instantly resize TikTok Shop labels to the correct 4x6 format for easy thermal printing.', '/tiktok-shop-label-fix'));
app.get('/walmart-marketplace-label-resizer', (req, res) => renderSEOPage(req, res, 'Walmart Seller Label to 4x6 Resizer', 'Professional resizing for Walmart Marketplace and DSV labels into thermal-ready 4x6 PDFs.', '/walmart-marketplace-label-resizer'));
app.get('/whatnot-label-to-4x6', (req, res) => renderSEOPage(req, res, 'Whatnot Shipping Label to 4x6 Converter', 'Convert Whatnot live-sale labels into a clean 4x6 format for bulk thermal printing.', '/whatnot-label-to-4x6'));
app.get('/ebay-8-5x11-to-4x6', (req, res) => renderSEOPage(req, res, 'eBay 8.5x11 to 4x6 Converter', 'Quickly crop and resize eBay PDF labels for your thermal printer.', '/ebay-8-5x11-to-4x6'));
app.get('/etsy-label-printing-too-small', (req, res) => renderSEOPage(req, res, 'Fix Etsy Label Printing Too Small', 'Force your Etsy labels to fill the 4x6 area. No more tiny barcodes.', '/etsy-label-printing-too-small'));
app.get('/poshmark-label-to-4x6', (req, res) => renderSEOPage(req, res, 'Poshmark 4x6 Label Converter', 'Convert Poshmark labels to print-ready thermal format.', '/poshmark-label-to-4x6'));
app.get('/pirateship-label-to-4x6', (req, res) => renderSEOPage(req, res, 'Pirate Ship 4x6 Converter', 'Perfectly scale Pirate Ship labels for any 4x6 printer.', '/pirateship-label-to-4x6'));

app.get('/best-thermal-printers', (req, res) => {
  res.send(pageTemplate({
    title: 'Best Thermal Shipping Label Printers of 2026',
    canonicalPath: '/best-thermal-printers',
    content: `
      <div class="card">
        <h1>Top 4x6 Thermal Printers for 2026</h1>
        <p>Stop buying ink. These are the top-rated printers for eBay, Etsy, and Amazon sellers.</p>
        <div style="border-top:1px solid #eee; margin:20px 0; padding-top:20px;">
            <h3>1. Rollo Wireless (Top Choice)</h3>
            <p>The industry standard. Fast, reliable, and works via Wi-Fi from any device.</p>
            <a href="https://www.amazon.com/dp/B08MBYJR7C?tag=${AMZ_ID}" class="btn" target="_blank">Check Price on Amazon</a>
        </div>
        <div style="border-top:1px solid #eee; margin:20px 0; padding-top:20px;">
            <h3>2. MUNBYN P941</h3>
            <p>Sleek design, easy setup, and legendary durability for home businesses.</p>
            <a href="https://www.amazon.com/dp/B08B8H57R6?tag=${AMZ_ID}" class="btn" target="_blank">Check Price on Amazon</a>
        </div>
      </div>`
  }));
});

app.post('/convert', upload.single('labelFile'), async (req, res) => {
  if (!req.file) return res.status(400).send('Upload a file.');
  cleanupOldFiles();
  const outputName = `converted-${Date.now()}.pdf`;
  const outputPath = path.join(downloadsDir, outputName);
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    (ext === '.pdf') ? await pdfTo4x6(req.file.path, outputPath, req.body.mode) : await imageToPdf(req.file.path, outputPath, req.body.mode);
    res.send(pageTemplate({
      title: 'Success | Your Label is Ready',
      content: `
        <div class="card">
          <h1>Conversion Ready!</h1>
          <iframe class="preview-frame" src="/downloads/${outputName}"></iframe>
          <div style="display:flex; gap:10px;">
            <a href="/downloads/${outputName}" class="btn" download>Download PDF</a>
            <a href="/" class="btn secondary">Convert Another</a>
          </div>
          <div class="money-box">
            <h3>🖨️ Need a professional setup?</h3>
            <p>Check out our <a href="/best-thermal-printers">2026 Thermal Printer Buyer's Guide</a> to see our top picks.</p>
          </div>
        </div>`
    }));
  } catch (err) { res.status(500).send("Error: " + err.message); }
  finally { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

app.get('/faq', (req, res) => { res.send(pageTemplate({ title: 'FAQ', content: '<div class="card"><h1>FAQ</h1><p>We support all major marketplaces including Amazon, TikTok, eBay, and Etsy.</p></div>' })); });
app.get('/privacy', (req, res) => { res.send(pageTemplate({ title: 'Privacy', content: '<div class="card"><h1>Privacy</h1><p>Files are deleted automatically after 1 hour.</p></div>' })); });
app.get('/terms', (req, res) => { res.send(pageTemplate({ title: 'Terms', content: '<div class="card"><h1>Terms</h1><p>Use at your own risk. Always preview your labels.</p></div>' })); });

app.listen(PORT, () => { console.log(`Magic happening on port ${PORT}`); });
