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

// 1. Setup Folders
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 2. Setup Multer (The "Upload Engine")
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use('/downloads', express.static(downloadsDir));

// 3. Page Template
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
      body { margin: 0; font-family: sans-serif; background-color: var(--light); color: var(--dark); line-height: 1.6; }
      .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
      header { padding: 20px 0; border-bottom: 1px solid var(--border); background: white; display: flex; justify-content: space-between; align-items: center; }
      .logo { font-size: 24px; font-weight: 800; color: var(--primary); text-decoration: none; }
      nav a { margin-left: 20px; text-decoration: none; color: #64748b; font-weight: 500; }
      .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid var(--border); margin-top: 40px; }
      .btn { background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; }
      footer { background: var(--dark); color: white; padding: 40px 0; text-align: center; margin-top: 60px; }
    </style>
  </head>
  <body>
    <header><div class="container"><a href="/" class="logo">PDF to Thermal</a><nav><a href="/faq">FAQ</a><a href="/contact">Support</a></nav></div></header>
    <div class="container">${content}</div>
    <footer><p>&copy; 2026 PDF to Thermal. support@pdftothermal.com</p></footer>
  </body>
  </html>`;
}

// 4. Conversion Logic (The "Math")
async function imageToPdf(inputPath, outputPath) {
  const imageBuffer = await sharp(inputPath)
    .resize(1200, 1800, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .toBuffer();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([288, 432]); // 4x6 at 72dpi
  const embedded = await pdfDoc.embedJpg(imageBuffer);
  page.drawImage(embedded, { x: 0, y: 0, width: 288, height: 432 });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

async function pdfTo4x6(inputPath, outputPath) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const existingPdf = await PDFDocument.load(existingPdfBytes);
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(existingPdf, [0]);
  const page = newPdf.addPage([288, 432]);
  page.drawPage(copiedPage, { x: 0, y: 0, xScale: 0.5, yScale: 0.5 }); // Simple scale
  const pdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

// 5. Routes
app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | 4x6 Label Converter',
    content: `<div class="card"><h1>Convert Labels to 4x6</h1><form action="/convert" method="POST" enctype="multipart/form-data"><input type="file" name="labelFile" required/><br><br><button type="submit" class="btn">Convert Now</button></form></div>`
  }));
});

app.get('/faq', (req, res) => {
  res.send(pageTemplate({ title: 'FAQ', content: `<div class="card"><h1>FAQ</h1><p>We support PDF, JPG, and PNG.</p></div>` }));
});

app.get('/contact', (req, res) => {
  res.send(pageTemplate({ title: 'Contact', content: `<div class="card"><h1>Contact</h1><p>Email: ${SUPPORT_EMAIL}</p></div>` }));
});

app.post('/convert', upload.single('labelFile'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const inputPath = req.file.path;
  const outputName = `converted-${Date.now()}.pdf`;
  const outputPath = path.join(downloadsDir, outputName);

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.pdf') await pdfTo4x6(inputPath, outputPath);
    else await imageToPdf(inputPath, outputPath);

    res.send(pageTemplate({
      title: 'Success',
      content: `<div class="card"><h1>Success!</h1><a href="/downloads/${outputName}" class="btn" download>Download 4x6 PDF</a></div>`
    }));
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
