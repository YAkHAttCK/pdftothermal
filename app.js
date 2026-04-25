const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const sharp = require('sharp');

const app = express();
const port = process.env.PORT || 3000;

// 1. SETUP: Multer for file handling
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());

// 2. ROUTES
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'PDF to Thermal | 4x6 Label Converter',
        description: 'Convert shipping labels to 4x6 thermal format for Rollo, Munbyn, and more.'
    });
});

// 3. CORE PROCESSING ENGINE
app.post('/convert', upload.single('label'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const inputPath = req.file.path;
        const mode = req.body.mode; // 'fit', 'crop', 'rotate'
        const outputPath = path.join(__dirname, 'public/downloads', `thermal-${Date.now()}.pdf`);

        // Ensure download directory exists
        if (!fs.existsSync(path.join(__dirname, 'public/downloads'))) {
            fs.mkdirSync(path.join(__dirname, 'public/downloads'), { recursive: true });
        }

        let finalPdfBytes;

        if (req.file.mimetype === 'application/pdf') {
            // --- PDF PROCESSING ---
            const existingPdfBytes = fs.readFileSync(inputPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const newPdf = await PDFDocument.create();
            const pages = pdfDoc.getPages();

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                
                // Create 4x6 inch page (72 points per inch)
                const newPage = newPdf.addPage([288, 432]); 
                const embeddedPage = await newPdf.embedPage(page);

                if (mode === 'rotate' && width > height) {
                    // Auto-rotate logic
                    newPage.drawPage(embeddedPage, {
                        x: 288, y: 0,
                        width: 432, height: 288,
                        rotate: degrees(90),
                    });
                } else if (mode === 'crop') {
                    // Zoom/Crop logic: Scale to fill width, centering the content
                    const scale = 288 / width;
                    newPage.drawPage(embeddedPage, {
                        x: 0, y: (432 - (height * scale)) / 2,
                        width: 288, height: height * scale,
                    });
                } else {
                    // Default 'Fit' logic
                    const scale = Math.min(288 / width, 432 / height);
                    newPage.drawPage(embeddedPage, {
                        x: (288 - (width * scale)) / 2,
                        y: (432 - (height * scale)) / 2,
                        width: width * scale, height: height * scale,
                    });
                }
            }
            finalPdfBytes = await newPdf.save();
        } else {
            // --- IMAGE PROCESSING (JPG/PNG) ---
            const imageBuffer = await sharp(inputPath)
                .resize(1200, 1800, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                .toFormat('pdf')
                .toBuffer();
            finalPdfBytes = imageBuffer;
        }

        fs.writeFileSync(outputPath, finalPdfBytes);
        
        // Return URL for the frontend preview/download
        res.json({ 
            success: true, 
            downloadUrl: `/downloads/${path.basename(outputPath)}` 
        });

    } catch (err) {
        console.error("Conversion Error:", err);
        res.status(500).json({ success: false, message: 'Server error during conversion.' });
    }
});

// 4. CLEANUP: Keep Render's disk clean
setInterval(() => {
    const folders = ['./uploads', './public/downloads'];
    folders.forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                const filePath = path.join(dir, file);
                if (Date.now() - fs.statSync(filePath).mtime > 3600000) {
                    fs.unlinkSync(filePath);
                }
            });
        }
    });
}, 900000); // Check every 15 mins

app.listen(port, () => {
    console.log(`Thermal converter live at port ${port}`);
});
