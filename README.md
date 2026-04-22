# PDF to Thermal

Starter Node.js app for converting shipping labels into 4x6 thermal-printer-ready PDFs.

## Features
- Upload PDF, JPG, or PNG labels
- Convert to a 4x6 PDF layout
- Download the converted file
- Simple marketing pages included

## Stack
- Node.js
- Express
- EJS
- Multer
- pdf-lib
- Sharp

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env`
3. Start the app:
   ```bash
   npm start
   ```
4. Visit `http://localhost:3000`

## Render settings
- Build command: `npm install`
- Start command: `npm start`

## Notes
- This starter version converts the first page of uploaded PDFs.
- Review and expand the privacy policy and terms before launching publicly.
- Add a cleanup job later if you want automatic deletion of old download files.
