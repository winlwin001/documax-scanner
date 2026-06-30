import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { localDb } from '../utils/localDb';
import type { LocalDocument } from '../utils/localDb';
import type { AppUser } from '../context/AuthContext';

export const documentService = {
  // Save a document (supports guest/offline local-first, and Supabase cloud sync)
  async createDocument(
    user: AppUser | null,
    name: string,
    mimeType: string,
    pages: { image: Blob; pageNumber: number }[],
    isLocalOnly: boolean = false
  ): Promise<LocalDocument> {
    const docId = 'doc-' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    // Calculate total size of page images
    let totalSize = 0;
    pages.forEach(p => { totalSize += p.image.size; });

    const doc: LocalDocument = {
      id: docId,
      name,
      mimeType,
      size: totalSize,
      isLocalOnly: isLocalOnly || !user || user.isGuest || !isSupabaseConfigured,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Save to local IndexedDB (always do this for offline-first resilience)
    await localDb.saveDocument(doc);
    
    for (const p of pages) {
      const pageId = `page-${docId}-${p.pageNumber}`;
      await localDb.savePage({
        id: pageId,
        documentId: docId,
        pageNumber: p.pageNumber,
        image: p.image,
      });
    }

    // 2. If online, signed-in, and not explicitly local-only, upload to Supabase
    if (user && !user.isGuest && !isLocalOnly && isSupabaseConfigured) {
      try {
        // Insert metadata in Supabase
        const { error: dbError } = await supabase.from('documents').insert({
          id: docId,
          user_id: user.id,
          name,
          mime_type: mimeType,
          file_size: totalSize,
          is_local_only: false,
          created_at: now,
          updated_at: now,
        });

        if (dbError) throw dbError;

        // Upload each page image to Supabase Storage
        for (const p of pages) {
          const pageId = `page-${docId}-${p.pageNumber}`;
          const filePath = `${user.id}/${docId}/${pageId}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, p.image, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) throw uploadError;

          // Save page record in Supabase
          await supabase.from('pages').insert({
            id: pageId,
            document_id: docId,
            page_number: p.pageNumber,
            image_path: filePath,
          });
        }

        // Log audit trail
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          document_id: docId,
          action: 'create',
          created_at: now,
        });

      } catch (e) {
        console.error('Failed to sync to Supabase. Kept in local storage.', e);
        // Mark as local-only due to sync failure
        doc.isLocalOnly = true;
        await localDb.saveDocument(doc);
      }
    }

    return doc;
  },

  // Retrieve all documents (merges local and cloud)
  async getDocuments(user: AppUser | null): Promise<LocalDocument[]> {
    // Always start with local documents
    const localDocs = await localDb.getAllDocuments();

    if (!user || user.isGuest || !isSupabaseConfigured) {
      return localDocs;
    }

    try {
      // Fetch from Supabase
      const { data: cloudDocs, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Merge cloud docs into local list, avoiding duplicates
      const localDocIds = new Set(localDocs.map(d => d.id));
      const mergedDocs = [...localDocs];

      for (const cd of cloudDocs) {
        if (!localDocIds.has(cd.id)) {
          mergedDocs.push({
            id: cd.id,
            name: cd.name,
            mimeType: cd.mime_type,
            size: cd.file_size,
            isLocalOnly: false,
            googleDriveId: cd.google_drive_id,
            createdAt: cd.created_at,
            updatedAt: cd.updated_at,
          });
        }
      }

      // Sort by date
      return mergedDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error('Failed to fetch from cloud. Showing local documents.', e);
      return localDocs;
    }
  },

  // Delete a document from local and cloud
  async deleteDocument(user: AppUser | null, docId: string): Promise<void> {
    // 1. Delete from Local DB
    await localDb.deleteDocument(docId);

    // 2. Delete from Supabase
    if (user && !user.isGuest && isSupabaseConfigured) {
      try {
        // Supabase storage delete folder (requires deleting individual files)
        const pages = await localDb.getPagesForDocument(docId);
        const filePaths = pages.map(p => `${user.id}/${docId}/${p.id}.jpg`);
        
        if (filePaths.length > 0) {
          await supabase.storage.from('documents').remove(filePaths);
        }

        // Table delete (cascade deletes pages and OCR results if configured in DB, else manual)
        await supabase.from('documents').delete().eq('id', docId);

        // Audit Log
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          document_id: docId,
          action: 'delete',
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to delete from Supabase:', e);
      }
    }
  },

  // Sync a local-only document to the cloud (e.g. after signing in)
  async syncDocumentToCloud(user: AppUser, docId: string): Promise<void> {
    if (user.isGuest || !isSupabaseConfigured) return;

    const doc = await localDb.getDocument(docId);
    if (!doc || !doc.isLocalOnly) return;

    try {
      const pages = await localDb.getPagesForDocument(docId);

      // Insert metadata in Supabase
      const { error: dbError } = await supabase.from('documents').insert({
        id: docId,
        user_id: user.id,
        name: doc.name,
        mime_type: doc.mimeType,
        file_size: doc.size,
        is_local_only: false,
        created_at: doc.createdAt,
        updated_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      // Upload page images to Supabase Storage
      for (const p of pages) {
        const filePath = `${user.id}/${docId}/${p.id}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, p.image, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        await supabase.from('pages').insert({
          id: p.id,
          document_id: docId,
          page_number: p.pageNumber,
          image_path: filePath,
        });

        // Sync OCR result if exists
        const ocr = await localDb.getOcrForPage(p.id);
        if (ocr) {
          await supabase.from('ocr_results').insert({
            id: ocr.id,
            page_id: p.id,
            raw_text: ocr.rawText,
            hocr_data: ocr.hocrData,
            language: ocr.language,
            engine: ocr.engine,
          });
        }
      }

      // Update local doc status
      doc.isLocalOnly = false;
      await localDb.saveDocument(doc);

      // Log audit trail
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        document_id: docId,
        action: 'sync',
        created_at: new Date().toISOString(),
      });

    } catch (e) {
      console.error('Failed to sync document to cloud:', e);
      throw e;
    }
  },

  // Google Drive Uploading via OAuth 2.0
  async uploadToGoogleDrive(accessToken: string, fileName: string, mimeType: string, fileBlob: Blob): Promise<string> {
    const metadata = {
      name: fileName,
      mimeType: mimeType,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Drive upload failed: ${errorText}`);
    }

    const data = await response.json();
    return data.id; // Returns Google Drive File ID
  }
};
