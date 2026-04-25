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
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper for professional page layout
function pageTemplate({ title = 'PDF to Thermal', content = '', error = null }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root {
        --primary: #2563eb;
        --dark: #0f172a;
        --light: #f8fafc;
        --accent: #eff6ff;
        --border: #e2e8f0;
      }
      body {
        margin: 0;
        font-family: 'Inter', -apple-system, sans-serif;
        background-color: var(--light);
        color: var(--dark);
        line-height: 1.6;
      }
      .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
      header { padding: 20px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: white; }
      .logo { font-size: 24px; font-weight: 800; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 8px; }
      .logo-icon { background: var(--primary); color: white; padding: 4px 8px; border-radius: 6px; font-size: 18px; }
      .nav-links a { margin-left: 20px; text-decoration: none; color: #64748b; font-weight: 500; }
      .hero { padding: 80px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
      .hero h1 { font-size: 48px; line-height: 1.1; margin-bottom: 20px; }
      .hero p { font-size: 18px; color: #64748b; margin-bottom: 30px; }
      .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border: 1px solid var(--border); }
      .upload-box { border: 2px dashed var(--primary); background: var(--accent); padding: 30px; border-radius: 12px; text-align: center; }
      .btn { background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; transition: 0.2s; text-decoration: none; display: inline-block; }
      .btn:hover { background: #1d4ed8; transform: translateY(-2px); }
      .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 60px 0; }
      .feature-item { background: white; padding: 20px; border-radius: 12px; border: 1px solid var(--border); }
      .feature-item h3 { margin-top: 0; color: var(--primary); }
      footer { background: var(--dark); color: white; padding: 40px 0; text-align: center; margin-top: 60px; }
      .alert { background: #fef2f2; color: #b91c1c; padding: 12px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #fecaca; }
      @media (max-width: 768px) { .hero { grid-template-columns: 1fr; padding: 40px 0; } .features { grid-template-columns: 1fr; } }
    </style>
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}');
    </script>
  </head>
  <body>
    <header>
      <div class="container" style="display:flex; justify-content:space-between; width:100%;">
        <a href="/" class="logo"><span class="logo-icon">PT</span> PDF to Thermal</a>
        <nav class="nav-links">
          <a href="/faq">FAQ</a>
          <a href="/contact">Support</a>
        </nav>
      </div>
    </header>
    <div class="container">
      ${content}
    </div>
    <footer>
      <div class="container">
        <p>&copy; 2026 PDF to Thermal. Professional Shipping Label Resizer.</p>
        <p style="font-size: 14px; opacity: 0.6;"><a href="/privacy" style="color:white;">Privacy</a> | <a href="/terms" style="color:white;">Terms</a></p>
      </div>
    </footer>
  </body>
  </html>`;
}

// Routes
app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | Convert Shipping Labels to 4x6',
    content: `
      <section class="hero">
        <div>
          <h1>Convert Shipping Labels to 4x6 Format</h1>
          <p>Tired of labels that don't fit your thermal printer? Upload your PDF or image and get a perfectly sized 4x6 label in seconds.</p>
          <div style="display:flex; gap:10px;">
            <span style="background:#e2e8f0; padding:4px 12px; border-radius:99px; font-size:14px; font-weight:600;">USPS</span>
            <span style="background:#e2e8f0; padding:4px 12px; border-radius:99px; font-size:14px; font-weight:600;">UPS</span>
            <span style="background:#e2e8f0; padding:4px 12px; border-radius:99px; font-size:14px; font-weight:600;">FedEx</span>
          </div>
        </div>
        <div class="card">
          <h2>Start Conversion</h2>
          <form action="/convert" method="POST" enctype="multipart/form-data">
            <div class="upload-box">
              <input type="file" name="labelFile" accept=".pdf,.png,.jpg,.jpeg" required style="margin-bottom:20px;"/>
              <button type="submit" class="btn" style="width:100%;">Convert Label Now</button>
            </div>
          </form>
          <p style="font-size:12px; margin-top:10px; color:#94a3b8; text-align:center;">Supports PDF, JPG, PNG up to 15MB</p>
        </div>
      </section>
      <section class="features">
        <div class="feature-item">
          <h3>Auto-Resizing</h3>
          <p>We use advanced PDF engines to scale your labels exactly to 4x6 inches without losing quality.</p>
        </div>
        <div class="feature-item">
          <h3>Image Processing</h3>
          <p>Upload a screenshot (JPG/PNG) and we will convert it to a print-ready PDF for your thermal printer.</p>
        </div>
        <div class="feature-item">
          <h3>Privacy First</h3>
          <p>Files are processed in real-time and deleted every hour. We never store your customer data.</p>
        </div>
      </section>
    `
  }));
});

// (Remaining routes like /faq, /contact, and /convert logic remain here...)

app.listen(PORT, () => {
  console.log(`PDF to Thermal running on port ${PORT}`);
});
