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
const AMZ_ID = 'pdftothermal-20'; // Your Associate ID

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
      .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
      header { padding: 20px 0; border-bottom: 1px solid var(--border); background: white; display: flex; justify-content: space-between; align-items: center; }
      .logo { font-size: 24px; font-weight: 800; color: var(--primary); text-decoration: none; }
      nav a { margin-left: 20px; text-decoration: none; color: #64748b; font-weight: 600; }
      .card { background: white; padding: 32px; border-radius: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid var(--border); margin-top: 30px; }
      .btn { background: var(--primary); color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; display: inline-block; font-weight: 700; border: none; cursor: pointer; transition: 0.2s; }
      .btn:hover { background: #1d4ed8; transform: translateY(-1px); }
      .btn.secondary { background: var(--accent); color: var(--primary); }
      .preview-frame { width: 100%; height: 600px; border: 1px solid var(--border); border-radius: 12px; margin: 20px 0; background: #eee; }
      .money-box { background: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 14px; margin-top: 25px; }
      footer { background: var(--dark); color: white; padding: 40px 0; text-align: center; margin-top: 60px; }
      @media (max-width: 768px) { .preview-frame { height: 400px; } }
    </style>
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
  </head>
  <body>
    <header><div class="container"><a href="/" class="logo">PDF to Thermal</a><nav><a href="/best-thermal-printers">Best Printers</a><a href="/faq">FAQ</a></nav></div></header>
    <div class="container">${content}</div>
    <footer><p>&copy; 2026 PDF to Thermal. support@pdftothermal.com</p></footer>
  </body>
  </html>`;
}

// Logic functions (imageToPdf, pdfTo4x6) 
async function imageToPdf(inputPath, outputPath, mode) {
  const metadata = await sharp(inputPath).metadata();
  const pipeline = mode === 'autorotate' && metadata.width > metadata.height ? sharp(inputPath).rotate(90) : sharp(inputPath);
  const imageBuffer = await pipeline.resize(1200, 1800, { fit: mode === 'fill' ? 'cover' : 'contain', background: { r: 255, g: 255, b: 255 } }).png().toBuffer();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([288, 432]);
  const embedded = await pdfDoc.embedPng(imageBuffer);
  page.drawImage(embedded, { x: 0, y: 0, width: 288, height: 432 });
  fs.writeFileSync(outputPath, await pdfDoc.save());
  return { pageCount: 1 };
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
  return { pageCount: pages.length };
}

// ROUTES
app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | Convert Shipping Labels to 4x6',
    content: `
      <div class="card" style="text-align:center;">
        <h1>Convert Labels to 4x6</h1>
        <p>Perfectly resize USPS, UPS, and FedEx labels for your thermal printer.</p>
        <form action="/convert" method="POST" enctype="multipart/form-data" style="margin-top:20px;">
          <input type="file" name="labelFile" required style="margin-bottom:20px;"/><br>
          <div style="margin-bottom:20px;">
            <label><input type="radio" name="mode" value="fit" checked> Fit Entire Label</label> &nbsp;
            <label><input type="radio" name="mode" value="fill"> Fill 4x6 Area</label> &nbsp;
            <label><input type="radio" name="mode" value="autorotate"> Auto Rotate</label>
          </div>
          <button type="submit" class="btn">Convert & Preview</button>
        </form>
      </div>`
  }));
});

app.get('/best-thermal-printers', (req, res) => {
  res.send(pageTemplate({
    title: 'Best Thermal Shipping Label Printers of 2026',
    canonicalPath: '/best-thermal-printers',
    content: `
      <div class="card">
        <h1>Top 4x6 Thermal Printers for 2026</h1>
        <p>Save money on ink and tape with these high-performance thermal label printers.</p>
        <hr style="border:0; border-top:1px solid var(--border); margin:20px 0;">
        <h3>1. Rollo Wireless Label Printer (Best Overall)</h3>
        <p>The industry standard for e-commerce. High speed, no jams, and works with everything.</p>
        <a href="https://www.amazon.com/dp/B08MBYJR7C?tag=${AMZ_ID}" class="btn" target="_blank">View Price on Amazon</a>
        <br><br>
        <h3>2. MUNBYN ITPP941 (Best for Home Office)</h3>
        <p>A reliable, compact choice that comes in multiple colors to fit your desk setup.</p>
        <a href="https://www.amazon.com/dp/B08B8H57R6?tag=${AMZ_ID}" class="btn" target="_blank">View Price on Amazon</a>
      </div>`
  }));
});

app.post('/convert', upload.single('labelFile'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  cleanupOldFiles();
  const outputName = `converted-${Date.now()}.pdf`;
  const outputPath = path.join(downloadsDir, outputName);
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const result = (ext === '.pdf') ? await pdfTo4x6(req.file.path, outputPath, req.body.mode) : await imageToPdf(req.file.path, outputPath, req.body.mode);
    res.send(pageTemplate({
      title: 'Success | Your Label is Ready',
      content: `
        <div class="card">
          <h1>Conversion Complete!</h1>
          <iframe class="preview-frame" src="/downloads/${outputName}"></iframe>
          <div style="display:flex; gap:10px;">
            <a href="/downloads/${outputName}" class="btn" download>Download 4x6 PDF</a>
            <a href="/" class="btn secondary">Convert Another</a>
          </div>
          <div class="money-box">
            <h3>🖨️ Tired of printer headaches?</h3>
            <p>If you're still using an inkjet or an old printer, you're losing time. Check out our <a href="/best-thermal-printers">2026 Thermal Printer Guide</a> to find a better way to ship.</p>
          </div>
        </div>`
    }));
  } catch (err) { res.status(500).send(err.message); }
  finally { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

app.get('/faq', (req, res) => { res.send(pageTemplate({ title: 'FAQ', content: '<div class="card"><h1>FAQ</h1><p>We support PDF, JPG, and PNG files resized to 4x6 inches.</p></div>' })); });

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
