import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface LocalDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isLocalOnly: boolean;
  googleDriveId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalPage {
  id: string;
  documentId: string;
  pageNumber: number;
  image: Blob;
  transformMatrix?: any;
}

export interface LocalOcrResult {
  id: string;
  pageId: string;
  rawText: string;
  hocrData?: any;
  language: string;
  engine: 'tesseract' | 'google_vision';
}

interface DocuMaxDB extends DBSchema {
  documents: {
    key: string;
    value: LocalDocument;
    indexes: { 'by-date': string };
  };
  pages: {
    key: string;
    value: LocalPage;
    indexes: { 'by-document': string };
  };
  ocr_results: {
    key: string;
    value: LocalOcrResult;
    indexes: { 'by-page': string };
  };
}

let dbPromise: Promise<IDBPDatabase<DocuMaxDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<DocuMaxDB>('documax-db', 1, {
      upgrade(db) {
        // Documents store
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('by-date', 'createdAt');

        // Pages store
        const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
        pageStore.createIndex('by-document', 'documentId');

        // OCR results store
        const ocrStore = db.createObjectStore('ocr_results', { keyPath: 'id' });
        ocrStore.createIndex('by-page', 'pageId');
      },
    });
  }
  return dbPromise;
};

export const localDb = {
  // Documents
  async saveDocument(doc: LocalDocument): Promise<void> {
    const db = await getDB();
    await db.put('documents', doc);
  },

  async getDocument(id: string): Promise<LocalDocument | undefined> {
    const db = await getDB();
    return db.get('documents', id);
  },

  async getAllDocuments(): Promise<LocalDocument[]> {
    const db = await getDB();
    const docs = await db.getAll('documents');
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async deleteDocument(id: string): Promise<void> {
    const db = await getDB();
    // Delete document
    await db.delete('documents', id);
    
    // Delete associated pages and OCR results
    const pages = await this.getPagesForDocument(id);
    for (const page of pages) {
      await db.delete('pages', page.id);
      const ocr = await this.getOcrForPage(page.id);
      if (ocr) {
        await db.delete('ocr_results', ocr.id);
      }
    }
  },

  // Pages
  async savePage(page: LocalPage): Promise<void> {
    const db = await getDB();
    await db.put('pages', page);
  },

  async getPagesForDocument(documentId: string): Promise<LocalPage[]> {
    const db = await getDB();
    const pages = await db.getAllFromIndex('pages', 'by-document', documentId);
    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  },

  // OCR Results
  async saveOcrResult(ocr: LocalOcrResult): Promise<void> {
    const db = await getDB();
    await db.put('ocr_results', ocr);
  },

  async getOcrForPage(pageId: string): Promise<LocalOcrResult | undefined> {
    const db = await getDB();
    const results = await db.getAllFromIndex('ocr_results', 'by-page', pageId);
    return results[0];
  },
};
