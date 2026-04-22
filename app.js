require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const convertRouter = require('./routes/convert');

const app = express();
const PORT = process.env.PORT || 3000;

const requiredDirs = ['uploads', 'public/downloads'];
requiredDirs.forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'PDF to Thermal | Convert Shipping Labels to 4x6',
    error: null
  });
});

app.get('/faq', (req, res) => {
  res.render('faq', { pageTitle: 'FAQ | PDF to Thermal' });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { pageTitle: 'Privacy Policy | PDF to Thermal' });
});

app.get('/terms', (req, res) => {
  res.render('terms', { pageTitle: 'Terms | PDF to Thermal' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { pageTitle: 'Contact | PDF to Thermal' });
});

app.use('/', convertRouter);

app.use((req, res) => {
  res.status(404).render('result', {
    pageTitle: 'Page Not Found | PDF to Thermal',
    success: false,
    message: 'Page not found.',
    downloadUrl: null,
    outputFilename: null
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('result', {
    pageTitle: 'Error | PDF to Thermal',
    success: false,
    message: err.message || 'Something went wrong while processing your file.',
    downloadUrl: null,
    outputFilename: null
  });
});

app.listen(PORT, () => {
  console.log(`PDF to Thermal running on port ${PORT}`);
});
