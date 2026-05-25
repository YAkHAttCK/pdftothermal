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
const GA_ID = 'G-CV6R7PF4PH';
const AMZ_ID = 'pdftothermal-20';

/* =========================================================
   DIRECTORIES
========================================================= */

const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/* =========================================================
   MULTER SETUP
========================================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/downloads', express.static(downloadsDir));

/* =========================================================
   CLEANUP OLD FILES
========================================================= */

function cleanupFiles() {
  const now = Date.now();

  [uploadsDir, downloadsDir].forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);

      const age = now - fs.statSync(filePath).mtimeMs;

      if (age > 1000 * 60 * 60) {
        fs.unlinkSync(filePath);
      }
    });
  });
}

/* =========================================================
   PAGE TEMPLATE
========================================================= */

function pageTemplate({
  title,
  description,
  canonicalPath = '/',
  content
}) {
  return `
<!DOCTYPE html>
<html lang="en">

<head>

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');
</script>

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<title>${title} | PDF to Thermal</title>

<meta name="description" content="${description}" />

<link rel="canonical" href="${SITE_URL}${canonicalPath}" />

<style>

:root{
  --primary:#2563eb;
  --dark:#0f172a;
  --light:#f8fafc;
  --border:#e2e8f0;
  --muted:#64748b;
}

*{
  box-sizing:border-box;
}

body{
  margin:0;
  font-family:Inter,system-ui,sans-serif;
  background:var(--light);
  color:var(--dark);
}

.container{
  max-width:1000px;
  margin:auto;
  padding:0 20px;
}

header{
  background:white;
  border-bottom:1px solid var(--border);
}

.header-inner{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:18px 0;
}

.logo{
  font-size:24px;
  font-weight:800;
  text-decoration:none;
  color:var(--primary);
}

nav a{
  margin-left:20px;
  color:var(--muted);
  text-decoration:none;
  font-weight:600;
}

.hero{
  padding:60px 0;
}

.card{
  background:white;
  border-radius:24px;
  padding:35px;
  box-shadow:0 4px 12px rgba(0,0,0,0.06);
  border:1px solid var(--border);
}

.hero h1{
  font-size:42px;
  line-height:1.1;
  margin-bottom:15px;
}

.hero p{
  font-size:18px;
  color:var(--muted);
  margin-bottom:30px;
}

.upload-box{
  border:2px dashed var(--border);
  border-radius:20px;
  padding:40px;
  text-align:center;
  background:#f8fbff;
}

.upload-box:hover{
  border-color:var(--primary);
}

.upload-box input{
  margin-top:15px;
}

.mode-row{
  margin-top:25px;
}

.mode-row label{
  margin-right:18px;
  font-weight:600;
}

.btn{
  background:var(--primary);
  color:white;
  border:none;
  padding:14px 26px;
  border-radius:12px;
  font-weight:700;
  cursor:pointer;
  text-decoration:none;
  display:inline-block;
}

.btn-secondary{
  background:#eff6ff;
  color:var(--primary);
}

.preview-frame{
  width:100%;
  height:550px;
  border:1px solid var(--border);
  border-radius:16px;
  margin:20px 0;
}

.feature-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
  gap:20px;
  margin-top:40px;
}

.feature{
  background:white;
  padding:24px;
  border-radius:18px;
  border:1px solid var(--border);
}

.feature h3{
  margin-top:0;
}

.seo-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
  gap:15px;
  margin-top:40px;
}

.seo-grid a{
  background:white;
  border:1px solid var(--border);
  padding:16px;
  border-radius:14px;
  text-decoration:none;
  color:var(--primary);
  font-weight:700;
}

footer{
  background:var(--dark);
  color:white;
  margin-top:70px;
  padding:35px 0;
  text-align:center;
}

footer a{
  color:white;
}

@media(max-width:700px){

.hero h1{
  font-size:32px;
}

.upload-box{
  padding:25px;
}

.header-inner{
  flex-direction:column;
  gap:15px;
}

}

</style>

</head>

<body>

<header>
  <div class="container header-inner">
    <a href="/" class="logo">PDF to Thermal</a>

    <nav>
      <a href="/best-thermal-printers">Best Printers</a>
      <a href="/faq">FAQ</a>
    </nav>
  </div>
</header>

<div class="container">
${content}
</div>

<footer>
  <div class="container">
    <p>
      © 2026 PDF to Thermal
      |
      <a href="/privacy">Privacy</a>
      |
      ${SUPPORT_EMAIL}
    </p>
  </div>
</footer>

</body>
</html>
`;
}

/* =========================================================
   ANALYTICS EVENTS
========================================================= */

function analyticsEvent(eventName) {
  return `
<script>
gtag('event', '${eventName}');
</script>
`;
}

/* =========================================================
   PDF PROCESSING
========================================================= */

async function processPdf(inputPath, outputPath, mode) {

  const existingPdf = await PDFDocument.load(
    fs.readFileSync(inputPath)
  );

  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(
    existingPdf,
    existingPdf.getPageIndices()
  );

  copiedPages.forEach(copiedPage => {

    const { width, height } = copiedPage.getSize();

    const isLandscape = width > height;

    const page = newPdf.addPage([288, 432]);

    const shouldRotate =
      (mode === 'autorotate' && isLandscape) ||
      (mode === 'fill' && isLandscape);

    const effectiveWidth = shouldRotate ? height : width;
    const effectiveHeight = shouldRotate ? width : height;

    const scale =
      mode === 'fill'
        ? Math.max(288 / effectiveWidth, 432 / effectiveHeight)
        : Math.min(288 / effectiveWidth, 432 / effectiveHeight);

    page.drawPage(copiedPage, {
      x: (288 - effectiveWidth * scale) / 2,
      y: (432 - effectiveHeight * scale) / 2,
      xScale: scale,
      yScale: scale,
      rotate: shouldRotate ? degrees(90) : undefined
    });

  });

  fs.writeFileSync(
    outputPath,
    await newPdf.save()
  );
}

/* =========================================================
   IMAGE TO PDF SUPPORT (PHASE 1)
========================================================= */

async function processImage(inputPath, outputPath) {

  const image = sharp(inputPath);

  const metadata = await image.metadata();

  const resizedBuffer = await image
    .flatten({ background: '#ffffff' })
    .resize({
      width: 1200,
      height: 1800,
      fit: 'inside'
    })
    .png()
    .toBuffer();

  const pdfDoc = await PDFDocument.create();

  const page = pdfDoc.addPage([288, 432]);

  const embedded = await pdfDoc.embedPng(resizedBuffer);

  const imgDims = embedded.scale(0.24);

  page.drawImage(embedded, {
    x: (288 - imgDims.width) / 2,
    y: (432 - imgDims.height) / 2,
    width: imgDims.width,
    height: imgDims.height
  });

  fs.writeFileSync(
    outputPath,
    await pdfDoc.save()
  );
}

/* =========================================================
   ROUTES
========================================================= */

app.get('/', (req, res) => {

  res.send(pageTemplate({

    title: 'Convert Shipping Labels to 4x6',
    description: 'Convert PDF, PNG, JPG shipping labels into perfect 4x6 thermal printer labels instantly.',

    content: `

<section class="hero">

<div class="card">

<h1>
Fix Shipping Labels for Thermal Printers in Seconds
</h1>

<p>
Convert USPS, UPS, FedEx, Etsy, Amazon, Mercari, and eBay labels into perfect 4x6 thermal PDFs instantly.
</p>

<form
  action="/convert"
  method="POST"
  enctype="multipart/form-data"
>

<div class="upload-box">

<h2>Upload Label</h2>

<p>
Supports PDF, PNG, JPG, JPEG, and WEBP
</p>

<input
  type="file"
  name="labelFile"
  accept=".pdf,.png,.jpg,.jpeg,.webp"
  required
/>

</div>

<div class="mode-row">

<label>
<input type="radio" name="mode" value="fit" checked />
Fit
</label>

<label>
<input type="radio" name="mode" value="fill" />
Fill
</label>

<label>
<input type="radio" name="mode" value="autorotate" />
Auto Rotate
</label>

</div>

<br>

<button class="btn" type="submit">
Convert Now
</button>

</form>

</div>

<div class="feature-grid">

<div class="feature">
<h3>PDF Support</h3>
<p>
Convert standard 8.5x11 shipping labels into thermal size automatically.
</p>
</div>

<div class="feature">
<h3>Image Support</h3>
<p>
Upload screenshots and JPG labels directly from your phone.
</p>
</div>

<div class="feature">
<h3>Auto Rotate</h3>
<p>
Fix sideways labels automatically for Rollo, Zebra, Jadens, and Munbyn printers.
</p>
</div>

</div>

<div class="seo-grid">

<a href="/etsy-label-fix">
Fix Etsy Labels Printing Small
</a>

<a href="/ebay-standard-envelope">
eBay Standard Envelope Fix
</a>

<a href="/amazon-fnsku-resize">
Amazon FNSKU Label Resize
</a>

<a href="/ups-label-to-4x6">
UPS Label to 4x6 Converter
</a>

</div>

</section>

${analyticsEvent('homepage_view')}

`
  }));

});

/* =========================================================
   CONVERT
========================================================= */

app.post(
  '/convert',
  upload.single('labelFile'),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    cleanupFiles();

    const ext = path.extname(req.file.originalname).toLowerCase();

    const outputName = `converted-${Date.now()}.pdf`;

    const outputPath = path.join(
      downloadsDir,
      outputName
    );

    try {

      if (ext === '.pdf') {

        await processPdf(
          req.file.path,
          outputPath,
          req.body.mode || 'fit'
        );

      } else {

        await processImage(
          req.file.path,
          outputPath
        );

      }

      res.send(pageTemplate({

        title: 'Label Ready',
        description: 'Your shipping label has been converted successfully.',

        content: `

<div class="hero">

<div class="card">

<h1>
Success! Your 4x6 Label is Ready
</h1>

<iframe
  class="preview-frame"
  src="/downloads/${outputName}"
></iframe>

<div style="display:flex; gap:15px; flex-wrap:wrap;">

<a
  href="/downloads/${outputName}"
  class="btn"
  download
>
Download PDF
</a>

<a
  href="/"
  class="btn btn-secondary"
>
Convert Another
</a>

<button
  class="btn btn-secondary"
  onclick="navigator.clipboard.writeText('${SITE_URL}/downloads/${outputName}')"
>
Copy Share Link
</button>

</div>

</div>

</div>

${analyticsEvent('conversion_success')}
${analyticsEvent('download_ready')}

`

      }));

    } catch (err) {

      console.error(err);

      res.status(500).send(err.message);

    } finally {

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

    }

  }
);

/* =========================================================
   SEO ROUTES
========================================================= */

app.get('/etsy-label-fix', (req, res) => {

  res.send(pageTemplate({

    title: 'Fix Etsy Labels Printing Too Small',
    description: 'Fix Etsy shipping labels printing tiny on thermal printers.',

    canonicalPath: '/etsy-label-fix',

    content: `
<div class="hero">

<div class="card">

<h1>
How to Fix Etsy Labels Printing Tiny
</h1>

<p>
Etsy often exports labels in 8.5x11 format. Our free converter automatically scales and centers Etsy labels for 4x6 thermal printers.
</p>

<a href="/" class="btn">
Fix Etsy Labels
</a>

</div>

</div>
`

  }));

});

/* =========================================================
   PRINTER PAGE
========================================================= */

app.get('/best-thermal-printers', (req, res) => {

  res.send(pageTemplate({

    title: 'Best Thermal Printers 2026',
    description: 'Top thermal printers for Etsy, Amazon, eBay, and Shopify sellers.',

    content: `
<div class="hero">

<div class="card">

<h1>
Best Thermal Printers for 2026
</h1>

<p>
Our favorite wireless thermal printers for shipping labels.
</p>

<a
  href="https://www.amazon.com/dp/B08MBYJR7C?tag=${AMZ_ID}"
  class="btn"
>
View Rollo on Amazon
</a>

</div>

</div>
`

  }));

});

/* =========================================================
   FAQ
========================================================= */

app.get('/faq', (req, res) => {

  res.send(pageTemplate({

    title: 'FAQ',
    description: 'Frequently asked questions.',

    content: `
<div class="hero">

<div class="card">

<h1>
Frequently Asked Questions
</h1>

<h3>What file types are supported?</h3>
<p>
PDF, PNG, JPG, JPEG, and WEBP.
</p>

<h3>What printers work?</h3>
<p>
Rollo, Zebra, Jadens, Munbyn, Brother, and most thermal printers.
</p>

<h3>Is it free?</h3>
<p>
Yes.
</p>

</div>

</div>
`

  }));

});

/* =========================================================
   PRIVACY
========================================================= */

app.get('/privacy', (req, res) => {

  res.send(pageTemplate({

    title: 'Privacy Policy',
    description: 'Privacy policy.',

    content: `
<div class="hero">

<div class="card">

<h1>
Privacy Policy
</h1>

<p>
Uploaded files are automatically deleted after processing.
</p>

</div>

</div>
`

  }));

});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
