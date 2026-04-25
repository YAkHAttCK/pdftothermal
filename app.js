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
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper for cleaning up files older than 1 hour
function cleanupOldFiles() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000;
  [uploadsDir, downloadsDir].forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      if (now - fs.statSync(filePath).mtimeMs > maxAge) fs.unlinkSync(filePath);
    });
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use('/downloads', express.static(downloadsDir));

function pageTemplate({ title = 'PDF to Thermal', content = '' }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root { --primary: #2563eb; --dark: #0f172a; --light: #f8fafc; --border: #e2e8f0; }
      body { margin: 0; font-family: sans-serif; background: var(--light); color: var(--dark); line-height: 1.6; }
      .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
      header { padding: 20px 0; border-bottom: 1px solid var(--border); background: white; display: flex; justify-content: space-between; align-items: center; }
      .logo { font-size: 24px; font-weight: 800; color: var(--primary); text-decoration: none; }
      nav a { margin-left: 20px; text-decoration: none; color: #64748b; font-weight: 500; }
      .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid var(--border); margin-top: 40px; }
      .btn { background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; cursor: pointer; border: none; }
      .preview-container { margin-top: 20px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; height: 500px; background: #eee; }
      footer { background: var(--dark); color: white; padding: 40px 0; text-align: center; margin-top: 60px; }
    </style>
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date()); gtag('config', '${GA_ID}');
    </script>
  </head>
  <body>
    <header><div class="container"><a href="/" class="logo">PDF to Thermal</a><nav><a href="/faq">FAQ</a><a href="/contact">Support</a></nav></div></header>
    <div class="container">${content}</div>
    <footer><p>&copy; 2026 PDF to Thermal. support@pdftothermal.com</p></footer>
  </body>
  </html>`;
}

// Logic functions (imageToPdf, pdfTo4x6) remain consistent from previous stable build
async function imageToPdf(inputPath, outputPath, mode) {
  const imageBuffer = await sharp(inputPath)
    .resize(1200, 1800, { fit: mode === 'fill' ? 'cover' : 'contain', background: { r: 255, g: 255, b: 255 } })
    .toBuffer();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([288, 432]);
  const embedded = await pdfDoc.embedJpg(imageBuffer);
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
    const scale = Math.min(288 / width, 432 / height);
    page.drawPage(copiedPage, { x: (288 - width * scale) / 2, y: (432 - height * scale) / 2, xScale: scale, yScale: scale });
  }
  fs.writeFileSync(outputPath, await newPdf.save());
}

// Routes
app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | 4x6 Label Converter',
    content: `
      <div class="card">
        <h1>Convert Labels to 4x6</h1>
        <p>Select your label and conversion mode below.</p>
        <form action="/convert" method="POST" enctype="multipart/form-data">
          <input type="file" name="labelFile" required/><br><br>
          <label><input type="radio" name="mode" value="fit" checked> Fit Entire Label</label><br>
          <label><input type="radio" name="mode" value="fill"> Fill 4x6 Area</label><br><br>
          <button type="submit" class="btn">Convert & Preview</button>
        </form>
      </div>`
  }));
});

app.post('/convert', upload.single('labelFile'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  cleanupOldFiles();
  const outputName = `converted-${Date.now()}.pdf`;
  const outputPath = path.join(downloadsDir, outputName);
  const ext = path.extname(req.file.originalname).toLowerCase();
  
  try {
    if (ext === '.pdf') await pdfTo4x6(req.file.path, outputPath, req.body.mode);
    else await imageToPdf(req.file.path, outputPath, req.body.mode);

    res.send(pageTemplate({
      title: 'Preview Your Label',
      content: `
        <div class="card">
          <h1>Your Label is Ready!</h1>
          <p>Review the preview below before downloading.</p>
          <div class="preview-container">
            <iframe src="/downloads/${outputName}" width="100%" height="100%" style="border:none;"></iframe>
          </div>
          <div style="margin-top:20px; display:flex; gap:10px;">
            <a href="/downloads/${outputName}" class="btn" download>Download 4x6 PDF</a>
            <a href="/" class="btn" style="background:#64748b;">Convert Another</a>
          </div>
        </div>`
    }));
  } catch (err) { res.status(500).send(err.message); }
  finally { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

app.get('/faq', (req, res) => { res.send(pageTemplate({ title: 'FAQ', content: '<div class="card"><h1>FAQ</h1><p>We support PDF, JPG, and PNG.</p></div>' })); });
app.get('/contact', (req, res) => { res.send(pageTemplate({ title: 'Contact', content: `<div class="card"><h1>Contact</h1><p>Email: ${SUPPORT_EMAIL}</p></div>` })); });

app.listen(PORT, () => { console.log(`Server live at port ${PORT}`); });
