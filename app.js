const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safeName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.use('/downloads', express.static(downloadsDir));

function pageTemplate(content) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PDF to Thermal</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f7f8fb;
        color: #1f2937;
      }
      .wrap {
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 20px;
      }
      .card {
        background: white;
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      }
      h1, h2 {
        margin-top: 0;
      }
      .hero {
        margin-bottom: 24px;
      }
      .muted {
        color: #6b7280;
      }
      .upload-box {
        border: 2px dashed #cbd5e1;
        border-radius: 14px;
        padding: 24px;
        margin-top: 20px;
        background: #f8fafc;
      }
      input[type="file"] {
        margin: 12px 0;
      }
      button, .btn {
        background: #2563eb;
        color: white;
        border: none;
        padding: 12px 18px;
        border-radius: 10px;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
      }
      button:hover, .btn:hover {
        background: #1d4ed8;
      }
      .links {
        margin-top: 18px;
      }
      .links a {
        margin-right: 14px;
        color: #2563eb;
        text-decoration: none;
      }
      .note {
        margin-top: 14px;
        font-size: 14px;
        color: #6b7280;
      }
      .success {
        color: #166534;
        font-weight: bold;
      }
      .error {
        color: #b91c1c;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${content}
    </div>
  </body>
  </html>
  `;
}

app.get('/', (req, res) => {
  res.send(pageTemplate(`
    <div class="card">
      <div class="hero">
        <h1>Convert Shipping Labels to 4x6 Thermal Format</h1>
        <p class="muted">Upload a PDF, JPG, or PNG label and turn it into a 4x6 thermal-printer-ready PDF.</p>
      </div>

      <form action="/convert" method="POST" enctype="multipart/form-data" class="upload-box">
        <label><strong>Select a label file</strong></label><br />
        <input type="file" name="labelFile" accept=".pdf,.png,.jpg,.jpeg" required />
        <br />
        <button type="submit">Upload and Convert</button>
        <div class="note">Supports PDF, PNG, JPG, and JPEG. Version 1 converts the first page of a PDF.</div>
      </form>

      <div class="links">
        <a href="/faq">FAQ</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/contact">Contact</a>
      </div>
    </div>
  `));
});

app.get('/faq', (req, res) => {
  res.send(pageTemplate(`
    <div class="card">
      <h1>FAQ</h1>
      <p><strong>What file types can I upload?</strong><br />PDF, PNG, JPG, and JPEG.</p>
      <p><strong>What size is the output?</strong><br />A 4x6 PDF formatted for thermal label printing.</p>
      <p><strong>Does it work with USPS, UPS, and FedEx?</strong><br />Yes, that is the goal of the tool.</p>
      <a class="btn" href="/">Back Home</a>
    </div>
  `));
});

app.get('/privacy', (req, res) => {
  res.send(pageTemplate(`
    <div class="card">
      <h1>Privacy Policy</h1>
      <p>This early version temporarily processes uploaded files in order to convert them. Update this page before public launch with your final privacy terms.</p>
      <a class="btn" href="/">Back Home</a>
    </div>
  `));
});

app.get('/terms', (req, res) => {
  res.send(pageTemplate(`
    <div class="card">
      <h1>Terms</h1>
      <p>This early version is provided as-is for testing. Update this page before public launch with your final terms of service.</p>
      <a class="btn" href="/">Back Home</a>
    </div>
  `));
});

app.get('/contact', (req, res) => {
  res.send(pageTemplate(`
    <div class="card">
      <h1>Contact</h1>
      <p>For now, add your preferred contact method here before launch.</p>
      <a class="btn" href="/">Back Home</a>
    </div>
  `));
});

async function imageToPdf(inputPath, outputPath) {
  const widthPx = 1200;
  const heightPx = 1800;

  const imageBuffer = await sharp(inputPath)
    .resize(widthPx, heightPx, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toBuffer();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([288, 432]);

  const embedded = await pdfDoc.embedPng(imageBuffer);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: 288,
    height: 432
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

async function pdfTo4x6(inputPath, outputPath) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const existingPdf = await PDFDocument.load(existingPdfBytes);
  const newPdf = await PDFDocument.create();

  const [copiedPage] = await newPdf.copyPages(existingPdf, [0]);
  const originalWidth = copiedPage.getWidth();
  const originalHeight = copiedPage.getHeight();

  const targetWidth = 288;
  const targetHeight = 432;

  const page = newPdf.addPage([targetWidth, targetHeight]);

  const scale = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
  const scaledWidth = originalWidth * scale;
  const scaledHeight = originalHeight * scale;

  const x = (targetWidth - scaledWidth) / 2;
  const y = (targetHeight - scaledHeight) / 2;

  page.drawPage(copiedPage, {
    x,
    y,
    xScale: scale,
    yScale: scale
  });

  const pdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

app.post('/convert', upload.single('labelFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send(pageTemplate(`
      <div class="card">
        <p class="error">No file uploaded.</p>
        <a class="btn" href="/">Back Home</a>
      </div>
    `));
  }

  const inputPath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const outputName = `converted-${Date.now()}.pdf`;
  const outputPath = path.join(downloadsDir, outputName);

  try {
    if (ext === '.pdf') {
      await pdfTo4x6(inputPath, outputPath);
    } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      await imageToPdf(inputPath, outputPath);
    } else {
      throw new Error('Unsupported file type.');
    }

    res.send(pageTemplate(`
      <div class="card">
        <p class="success">Your file was converted successfully.</p>
        <p><a class="btn" href="/downloads/${outputName}" download>Download 4x6 PDF</a></p>
        <a class="btn" href="/">Convert Another File</a>
      </div>
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(pageTemplate(`
      <div class="card">
        <p class="error">Conversion failed: ${err.message}</p>
        <a class="btn" href="/">Back Home</a>
      </div>
    `));
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  }
});

app.listen(PORT, () => {
  console.log(`PDF to Thermal running on port ${PORT}`);
});
