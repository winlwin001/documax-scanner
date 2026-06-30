# DocuMax - Cross-Platform Document Management Application

DocuMax is a production-ready, cross-platform document management application built with **React**, **TypeScript**, **Tailwind CSS v4**, **Supabase**, and **Capacitor**. It runs as a responsive, offline-first Progressive Web App (PWA) and can be packaged for Android and iOS.

---

## Key Features

1. **Document Scanner**: Real-time camera capture, automatic edge contour detection (via OpenCV.js), perspective correction (quadrilateral warp), image enhancement filters (grayscale, binarization, contrast), and OCR.
2. **AI-Powered OCR**: Local, offline-first text extraction using **Tesseract.js** with an online fallback to **Google Cloud Vision API** via Supabase Edge Functions.
3. **PDF Tools Suite**: Browser-native PDF operations using `pdf-lib` and `pdfjs-dist`:
   - Merge, split, rotate, and reorder pages.
   - Compress, watermark, and password-protect (encrypt) PDFs.
   - Digital Signing: Draw signatures on an interactive canvas and place them on any page.
4. **Converters**:
   - Convert Text, Markdown, HTML, and JSON to styled PDF and Word (`.docx`) documents.
   - Multi-format image converter (JPG, PNG, WEBP).
5. **Spreadsheet Editor**: Fully interactive grid editor using SheetJS (`xlsx`) for importing, cell-by-cell editing, and exporting CSV/Excel sheets.
6. **QR & Barcode**: Scan QR/Barcodes from the device camera and generate custom colored QR codes.
7. **Offline-First PWA**: Uses **IndexedDB** (`idb` library) to store documents, pages, and OCR results locally on the device, enabling full offline functionality.
8. **Stripe Billing & Gating**: Three subscription tiers (Free, Pro, Business) with monthly feature gating, usage trackers, and a mock billing portal for instant local testing.
9. **Admin Dashboard**: Analytics (active users, OCR run counts, monthly revenue), user management (manual tier adjustment), and real-time system audit logs.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Framer Motion
- **Mobile Packaging**: Capacitor JS (Android & iOS)
- **Local Storage**: IndexedDB (via `idb` wrapper)
- **Cloud Backend**: Supabase (Authentication, PostgreSQL Database, Storage)
- **Payment Processing**: Stripe (Checkout & Webhooks)
- **Core Processing Libraries**: OpenCV.js, Tesseract.js, pdf-lib, pdfjs-dist, SheetJS, HTML5-QRCode, docx, jsPDF

---

## Getting Started

### 1. Installation

Install all package dependencies:
```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory and add your credentials:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Cloud (Optional, for Google Sign-In and Google Vision OCR)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```
*Note: If these variables are not set, the application will automatically fall back to **Local Offline / Guest Mode**, allowing you to test all features (including scanner, PDF tools, grid editor, and mock subscription upgrades) immediately without any backend setup!*

### 3. Database Migration

If you are setting up Supabase, copy the contents of [20260629000000_init_schema.sql](file:///C:/App/Scanner/supabase/migrations/20260629000000_init_schema.sql) and run them in the **Supabase SQL Editor**. This will set up all tables, Row Level Security (RLS) policies, and auth triggers.

### 4. Running the App

Start the local Vite development server:
```bash
npm run dev
```

---

## Packaging for Mobile (Android & iOS)

DocuMax is configured with Capacitor. To build and run native mobile applications:

1. **Build the Web App**:
   ```bash
   npm run build
   ```

2. **Add Mobile Platforms**:
   ```bash
   npx cap add android
   npx cap add ios
   ```

3. **Sync Web Assets to Native Projects**:
   ```bash
   npx cap sync
   ```

4. **Open in IDEs** (Android Studio / Xcode):
   ```bash
   npx cap open android
   npx cap open ios
   ```
From there, you can run the app in the emulator or deploy it to physical devices.
