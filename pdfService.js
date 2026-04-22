const fs = require('fs/promises');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const THERMAL_WIDTH = 288; // 4 inches at 72 points/inch
const THERMAL_HEIGHT = 432; // 6 inches at 72 points/inch

async function convertPdfToThermal(inputPath, originalName) {
  const existingPdfBytes = await fs.readFile(inputPath);
  const srcPdf = await PDFDocument.load(existingPdfBytes);
  const outPdf = await PDFDocument.create();

  const sourcePages = srcPdf.getPages();
  if (!sourcePages.length) {
    throw new Error('The uploaded PDF has no pages.');
  }

  const [embeddedPage] = await outPdf.embedPages([sourcePages[0]]);
  const sourceSize = embeddedPage.size();

  const scale = Math.min(
    THERMAL_WIDTH / sourceSize.width,
    THERMAL_HEIGHT / sourceSize.height
  );

  const scaledWidth = sourceSize.width * scale;
  const scaledHeight = sourceSize.height * scale;
  const x = (THERMAL_WIDTH - scaledWidth) / 2;
  const y = (THERMAL_HEIGHT - scaledHeight) / 2;

  const page = outPdf.addPage([THERMAL_WIDTH, THERMAL_HEIGHT]);
  page.drawPage(embeddedPage, {
    x,
    y,
    width: scaledWidth,
    height: scaledHeight
  });

  const pdfBytes = await outPdf.save();
  const baseName = path.parse(originalName).name.replace(/\s+/g, '-');
  const outputFilename = `${Date.now()}-${baseName}-4x6.pdf`;
  const outputPath = path.join(__dirname, '..', 'public', 'downloads', outputFilename);

  await fs.writeFile(outputPath, pdfBytes);

  return {
    outputFilename,
    downloadUrl: `/downloads/${outputFilename}`
  };
}

module.exports = { convertPdfToThermal };
