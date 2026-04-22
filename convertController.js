const path = require('path');
const { convertPdfToThermal } = require('../services/pdfService');
const { convertImageToThermalPdf } = require('../services/imageService');
const { safeUnlink } = require('../utils/cleanup');

async function handleConversion(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).render('index', {
        pageTitle: 'PDF to Thermal | Convert Shipping Labels to 4x6',
        error: 'Please choose a PDF, JPG, or PNG file.'
      });
    }

    const uploadedPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let result;

    if (ext === '.pdf') {
      result = await convertPdfToThermal(uploadedPath, req.file.originalname);
    } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      result = await convertImageToThermalPdf(uploadedPath, req.file.originalname);
    } else {
      throw new Error('Unsupported file type.');
    }

    await safeUnlink(uploadedPath);

    return res.render('result', {
      pageTitle: 'Your Converted Label | PDF to Thermal',
      success: true,
      message: 'Your label is ready.',
      downloadUrl: result.downloadUrl,
      outputFilename: result.outputFilename
    });
  } catch (error) {
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
    return next(error);
  }
}

module.exports = { handleConversion };
