const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const WIDTH_PX = 1200;
const HEIGHT_PX = 1800;
const THERMAL_WIDTH = 288;
const THERMAL_HEIGHT = 432;

async function convertImageToThermalPdf(inputPath, originalName) {
  const resizedBuffer = await sharp(inputPath)
    .resize({
      width: WIDTH_PX,
      height: HEIGHT_PX,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toBuffer();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([THERMAL_WIDTH, THERMAL_HEIGHT]);
  const embeddedImage = await pdfDoc.embedPng(resizedBuffer);

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: THERMAL_WIDTH,
    height: THERMAL_HEIGHT
  });

  const pdfBytes = await pdfDoc.save();
  const baseName = path.parse(originalName).name.replace(/\s+/g, '-');
  const outputFilename = `${Date.now()}-${baseName}-4x6.pdf`;
  const outputPath = path.join(__dirname, '..', 'public', 'downloads', outputFilename);

  await fs.writeFile(outputPath, pdfBytes);

  return {
    outputFilename,
    downloadUrl: `/downloads/${outputFilename}`
  };
}

module.exports = { convertImageToThermalPdf };
