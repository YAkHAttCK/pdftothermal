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

function pageTemplate({ title = 'PDF to Thermal', description = 'Convert shipping labels to 4x6 thermal format.', content = '' }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <style>
      :root {
        --bg: #f4f7fb;
        --card: #ffffff;
        --text: #0f172a;
        --muted: #64748b;
        --line: #dbe4ee;
        --primary: #2563eb;
        --primary-dark: #1d4ed8;
        --accent: #eff6ff;
        --success: #166534;
        --error: #b91c1c;
        --shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
        --radius: 18px;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Inter, Arial, Helvetica, sans-serif;
        background:
          radial-gradient(circle at top left, #eef4ff 0, transparent 32%),
          radial-gradient(circle at top right, #eef8ff 0, transparent 28%),
          var(--bg);
        color: var(--text);
      }

      a {
        color: var(--primary);
        text-decoration: none;
      }

      a:hover { text-decoration: underline; }

      .container {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 0 10px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-weight: 800;
        color: var(--text);
      }

      .brand-badge {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--primary), #60a5fa);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 800;
        box-shadow: var(--shadow);
      }

      .nav-links {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
      }

      .nav-links a {
        color: var(--muted);
        font-weight: 600;
      }

      .hero {
        padding: 28px 0 18px;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 24px;
        align-items: stretch;
      }

      .hero-card,
      .card {
        background: var(--card);
        border: 1px solid rgba(219, 228, 238, 0.8);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }

      .hero-copy {
        padding: 34px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--accent);
        color: var(--primary);
        border: 1px solid #bfdbfe;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 16px;
      }

      h1 {
        margin: 0 0 14px;
        font-size: clamp(36px, 5vw, 56px);
        line-height: 1.02;
        letter-spacing: -0.03em;
      }

      .lead {
        margin: 0 0 22px;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.6;
        max-width: 700px;
      }

      .hero-points {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 20px 0 22px;
      }

      .hero-point {
        background: #f8fafc;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px;
      }

      .hero-point strong {
        display: block;
        margin-bottom: 4px;
        font-size: 15px;
      }

      .hero-point span {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }

      .trust-line {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .upload-card {
        padding: 24px;
      }

      .upload-card h2 {
        margin: 0 0 10px;
        font-size: 26px;
      }

      .upload-card p {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.55;
      }

      .upload-box {
        border: 2px dashed #bfdbfe;
        background: linear-gradient(180deg, #f8fbff 0%, #f7fbff 100%);
        border-radius: 16px;
        padding: 22px;
      }

      .upload-box label {
        display: block;
        font-weight: 700;
        margin-bottom: 10px;
      }

      input[type="file"] {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: white;
        margin-bottom: 14px;
      }

      button, .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 46px;
        padding: 0 18px;
        border-radius: 12px;
        border: 0;
        background: var(--primary);
        color: white;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
      }

      button:hover, .btn:hover {
        background: var(--primary-dark);
        text-decoration: none;
      }

      .microcopy {
        margin-top: 12px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .section {
        padding: 18px 0;
      }

      .section-title {
        margin: 0 0 16px;
        font-size: 30px;
        letter-spacing: -0.02em;
      }

      .section-subtitle {
        margin: 0 0 24px;
        color: var(--muted);
        line-height: 1.6;
        max-width: 760px;
      }

      .cards-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .step-card,
      .info-card,
      .mini-card {
        background: white;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 22px;
        box-shadow: var(--shadow);
      }

      .step-number {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: var(--accent);
        color: var(--primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .step-card h3,
      .info-card h3,
      .mini-card h3 {
        margin: 0 0 8px;
        font-size: 19px;
      }

      .step-card p,
      .info-card p,
      .mini-card p,
      .faq-item p,
      .legal p,
      .contact-list p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .cards-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .use-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .use-item {
        background: white;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 16px;
        font-weight: 700;
      }

      .cta {
        margin: 18px 0 32px;
        background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
        color: white;
        border-radius: 20px;
        padding: 30px;
        box-shadow: var(--shadow);
      }

      .cta h2 {
        margin: 0 0 10px;
        font-size: 30px;
      }

      .cta p {
        margin: 0 0 18px;
        color: rgba(255,255,255,0.82);
        line-height: 1.6;
        max-width: 760px;
      }

      .cta .btn {
        background: white;
        color: var(--primary);
        box-shadow: none;
      }

      .faq-grid {
        display: grid;
        gap: 14px;
      }

      .faq-item {
        background: white;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 18px;
      }

      .faq-item h3 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      .footer {
        padding: 26px 0 48px;
        color: var(--muted);
        font-size: 14px;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 12px;
      }

      .result-card {
        max-width: 760px;
        margin: 44px auto;
        padding: 32px;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 800;
        margin-bottom: 16px;
      }

      .status.success {
        background: #ecfdf3;
        color: var(--success);
        border: 1px solid #bbf7d0;
      }

      .status.error {
        background: #fef2f2;
        color: var(--error);
        border: 1px solid #fecaca;
      }

      .result-card h1 {
        font-size: 36px;
        margin-bottom: 12px;
      }

      .result-card p {
        color: var(--muted);
        line-height: 1.6;
      }

      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
      }

      .btn.secondary {
        background: #eef2ff;
        color: var(--primary);
        box-shadow: none;
      }

      .legal, .contact-list {
        display: grid;
        gap: 16px;
      }

      @media (max-width: 920px) {
        .hero-grid,
        .cards-3,
        .cards-2,
        .use-grid {
          grid-template-columns: 1fr;
        }

        .hero-copy,
        .upload-card {
          padding: 24px;
        }

        .hero-points {
          grid-template-columns: 1fr;
        }

        .nav {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header class="nav">
        <a class="brand" href="/">
          <span class="brand-badge">PT</span>
          <span>PDF to Thermal</span>
        </a>
        <nav class="nav-links">
          <a href="/">Home</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>

      ${content}

      <footer class="footer">
        <div>PDF to Thermal helps turn shipping labels into 4x6 thermal-printer-ready files.</div>
        <div class="footer-links">
          <a href="/">Home</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/contact">Contact</a>
        </div>
      </footer>
    </div>
  </body>
  </html>
  `;
}

app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | Convert Shipping Labels to 4x6 Thermal Format',
    description: 'Upload a PDF, JPG, or PNG shipping label and convert it into a 4x6 thermal-printer-ready PDF.',
    content: `
      <section class="hero">
        <div class="hero-grid">
          <div class="hero-card hero-copy">
            <div class="eyebrow">4x6 label conversion made simple</div>
            <h1>Convert shipping labels to 4x6 thermal format</h1>
            <p class="lead">
              Upload a PDF, JPG, or PNG label and turn it into a clean thermal-printer-ready PDF in seconds.
            </p>

            <div class="hero-points">
              <div class="hero-point">
                <strong>Built for shipping labels</strong>
                <span>Made for 4x6 thermal printing instead of generic file conversion.</span>
              </div>
              <div class="hero-point">
                <strong>Fast upload and download</strong>
                <span>Simple browser-based flow with no account required in this version.</span>
              </div>
              <div class="hero-point">
                <strong>Supports common formats</strong>
                <span>Upload PDF, PNG, JPG, or JPEG and get a print-ready PDF back.</span>
              </div>
              <div class="hero-point">
                <strong>Useful for marketplaces</strong>
                <span>Good for USPS, UPS, FedEx, Amazon returns, eBay, Etsy, and more.</span>
              </div>
            </div>

            <div class="trust-line">
              Works best for common shipping workflows where you need a simple 4x6 output for a thermal label printer.
            </div>
          </div>

          <div class="hero-card upload-card">
            <h2>Upload your label</h2>
            <p>
              Version 1 converts the first page of a PDF and returns a 4x6 PDF designed for thermal printing.
            </p>

            <form action="/convert" method="POST" enctype="multipart/form-data" class="upload-box">
              <label for="labelFile">Select a file</label>
              <input id="labelFile" type="file" name="labelFile" accept=".pdf,.png,.jpg,.jpeg" required />
              <button type="submit">Upload and Convert</button>
              <div class="microcopy">
                Supported file types: PDF, PNG, JPG, JPEG.<br />
                Max upload size: 15 MB.
              </div>
            </form>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">How it works</h2>
        <p class="section-subtitle">
          PDF to Thermal is designed to keep the process simple: upload your label, convert it to 4x6, then download the finished PDF.
        </p>
        <div class="cards-3">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3>Upload your file</h3>
            <p>Use a PDF, JPG, PNG, or JPEG shipping label from your computer or phone.</p>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <h3>Convert to 4x6</h3>
            <p>The app reformats the label into a standard 4x6 PDF for thermal printers.</p>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>Download and print</h3>
            <p>Open the converted file and print it on your 4x6 thermal label printer.</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Built for common label problems</h2>
        <p class="section-subtitle">
          Many labels arrive in awkward PDFs or image formats that do not line up well with a thermal printer. This tool helps bridge that gap.
        </p>
        <div class="use-grid">
          <div class="use-item">USPS labels</div>
          <div class="use-item">UPS labels</div>
          <div class="use-item">FedEx labels</div>
          <div class="use-item">Amazon return labels</div>
          <div class="use-item">eBay shipping labels</div>
          <div class="use-item">Etsy shipping labels</div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Why people use PDF to Thermal</h2>
        <div class="cards-2">
          <div class="info-card">
            <h3>Focused instead of generic</h3>
            <p>
              This is not another broad file converter. It is built around one job: getting shipping labels into a usable 4x6 thermal format.
            </p>
          </div>
          <div class="info-card">
            <h3>Simple enough for repeat use</h3>
            <p>
              The goal is a practical tool you can use quickly without needing design software, printer workarounds, or extra cleanup steps.
            </p>
          </div>
        </div>
      </section>

      <section class="cta">
        <h2>Fix your shipping label in seconds</h2>
        <p>
          Upload your file, convert it to 4x6, and download a cleaner PDF for your thermal printer.
        </p>
        <a class="btn" href="/">Start with a label upload</a>
      </section>
    `
  }));
});

app.get('/faq', (req, res) => {
  res.send(pageTemplate({
    title: 'FAQ | PDF to Thermal',
    description: 'Frequently asked questions about PDF to Thermal.',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title" style="margin-bottom: 10px;">Frequently asked questions</h1>
          <p class="section-subtitle" style="margin-bottom: 22px;">
            Quick answers about supported files, output format, and how this early version works.
          </p>

          <div class="faq-grid">
            <div class="faq-item">
              <h3>What file types can I upload?</h3>
              <p>PDF, PNG, JPG, and JPEG are supported in the current version.</p>
            </div>
            <div class="faq-item">
              <h3>What size is the output?</h3>
              <p>The tool creates a 4x6 PDF intended for common thermal label printers.</p>
            </div>
            <div class="faq-item">
              <h3>Does it work with USPS, UPS, and FedEx labels?</h3>
              <p>Yes. It is intended for common carrier and marketplace label workflows.</p>
            </div>
            <div class="faq-item">
              <h3>Does it convert every page in a PDF?</h3>
              <p>Not yet. Version 1 converts the first page of a PDF.</p>
            </div>
            <div class="faq-item">
              <h3>Do I need an account?</h3>
              <p>No. The current version is designed to be quick and simple, with no account required.</p>
            </div>
            <div class="faq-item">
              <h3>What is the upload size limit?</h3>
              <p>The current upload size limit is 15 MB.</p>
            </div>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/privacy', (req, res) => {
  res.send(pageTemplate({
    title: 'Privacy Policy | PDF to Thermal',
    description: 'Privacy information for PDF to Thermal.',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title" style="margin-bottom: 10px;">Privacy Policy</h1>
          <div class="legal">
            <p>
              PDF to Thermal is a file-processing tool. When you upload a file, it is temporarily processed to create a converted output.
            </p>
            <p>
              This early version is intended for testing and development. Before broader public launch, this page should be updated with your final retention, deletion, and usage policies.
            </p>
            <p>
              Do not upload highly sensitive files until your final privacy language and storage practices are fully in place.
            </p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/terms', (req, res) => {
  res.send(pageTemplate({
    title: 'Terms | PDF to Thermal',
    description: 'Terms of use for PDF to Thermal.',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title" style="margin-bottom: 10px;">Terms of Use</h1>
          <div class="legal">
            <p>
              PDF to Thermal is provided as-is in this early version. Features, performance, and file-handling behavior may change as the tool improves.
            </p>
            <p>
              By using the site, you agree not to upload unlawful content, malicious files, or material you do not have the right to process.
            </p>
            <p>
              Before public launch, this page should be updated with complete legal terms that match your final business and hosting setup.
            </p>
          </div>
        </div>
      </section>
    `
  }));
});

app.get('/contact', (req, res) => {
  res.send(pageTemplate({
    title: 'Contact | PDF to Thermal',
    description: 'Contact PDF to Thermal.',
    content: `
      <section class="section">
        <div class="card" style="padding: 28px;">
          <h1 class="section-title" style="margin-bottom: 10px;">Contact</h1>
          <div class="contact-list">
            <p>
              This page is a placeholder for your public contact details.
            </p>
            <p>
              Before launch, add your preferred contact method such as a support email, business contact form, or help desk link.
            </p>
            <p>
              Suggested support email format: <strong>support@pdftothermal.com</strong>
            </p>
          </div>
        </div>
      </section>
    `
  }));
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
    return res.status(400).send(pageTemplate({
      title: 'Upload Error | PDF to Thermal',
      content: `
        <div class="card result-card">
          <div class="status error">Upload error</div>
          <h1>No file uploaded</h1>
          <p>Please go back and choose a PDF, PNG, JPG, or JPEG file before submitting.</p>
          <div class="button-row">
            <a class="btn" href="/">Back Home</a>
          </div>
        </div>
      `
    }));
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

    res.send(pageTemplate({
      title: 'Conversion Complete | PDF to Thermal',
      content: `
        <div class="card result-card">
          <div class="status success">Conversion complete</div>
          <h1>Your 4x6 PDF is ready</h1>
          <p>
            Your file was processed successfully. Download the converted PDF and print it on a 4x6 thermal label printer.
          </p>
          <div class="button-row">
            <a class="btn" href="/downloads/${outputName}" download>Download 4x6 PDF</a>
            <a class="btn secondary" href="/">Convert Another File</a>
          </div>
        </div>
      `
    }));
  } catch (err) {
    console.error(err);
    res.status(500).send(pageTemplate({
      title: 'Conversion Failed | PDF to Thermal',
      content: `
        <div class="card result-card">
          <div class="status error">Conversion failed</div>
          <h1>Something went wrong</h1>
          <p>${err.message}</p>
          <div class="button-row">
            <a class="btn" href="/">Try Again</a>
          </div>
        </div>
      `
    }));
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
