const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument, degrees } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS and Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    pageTitle: 'PDF to Thermal | Convert Shipping Labels to 4x6' 
  });
});

app.get('/faq', (req, res) => {
  res.render('faq', { pageTitle: 'FAQ | PDF to Thermal' });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { pageTitle: 'Privacy Policy | PDF to Thermal' });
});

app.get('/terms', (req, res) => {
  res.render('terms', { pageTitle: 'Terms of Service | PDF to Thermal' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { pageTitle: 'Contact Us | PDF to Thermal' });
});

// Conversion Logic and Server Start
app.listen(PORT, () => {
  console.log(`Thermal converter live at port ${PORT}`);
});
