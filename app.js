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

// Professional Page Template
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

// Fixed Routes
app.get('/', (req, res) => {
  res.send(pageTemplate({
    title: 'PDF to Thermal | 4x6 Label Converter',
    content: `<div class="card"><h1>Convert Labels to 4x6</h1><form action="/convert" method="POST" enctype="multipart/form-data"><input type="file" name="labelFile" required/><br><br><button type="submit" class="btn">Convert Now</button></form></div>`
  }));
});

app.get('/faq', (req, res) => {
  res.send(pageTemplate({
    title: 'FAQ | PDF to Thermal',
    content: `<div class="card"><h1>Frequently Asked Questions</h1><p><b>Supported files:</b> PDF, JPG, PNG.</p><p><b>Output size:</b> 4x6 inches for thermal printers.</p></div>`
  }));
});

app.get('/contact', (req, res) => {
  res.send(pageTemplate({
    title: 'Contact Support | PDF to Thermal',
    content: `<div class="card"><h1>Contact Us</h1><p>Need help? Email us at: <b>${SUPPORT_EMAIL}</b></p></div>`
  }));
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
