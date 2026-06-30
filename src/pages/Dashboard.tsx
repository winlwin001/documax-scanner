import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { documentService } from '../services/documentService';
import type { LocalDocument } from '../utils/localDb';
import { 
  Search, Grid, List, FolderOpen, Upload, Download, Trash2, 
  CloudLightning, CloudOff, Cloud, RefreshCw, FileText, FileImage, 
  FileSpreadsheet, HardDrive 
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { limits, incrementUsage, checkLimit } = useSubscription();

  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load documents on mount / user change
  const loadDocs = async () => {
    setLoading(true);
    try {
      const docs = await documentService.getDocuments(user);
      setDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [user]);

  // Handle Drag-and-Drop / File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const file = files[0];

    // Gating check: File Size Limit
    const sizeInMB = file.size / 1024 / 1024;
    if (sizeInMB > limits.maxFileSizeMB) {
      alert(`File size exceeds limit of ${limits.maxFileSizeMB}MB for your plan. Please upgrade.`);
      return;
    }

    setUploading(true);
    setUploadProgress(20);

    try {
      // For uploading a pre-existing file:
      // We convert it to a page image if it's an image, or save it as a document.
      // For simplicity, we create a document. If it's a PDF/TXT, we store it.
      setUploadProgress(50);

      // Create document
      await documentService.createDocument(
        user,
        file.name.replace(/\.[^/.]+$/, ''),
        file.type,
        [{ image: file, pageNumber: 1 }] // Represent file as page 1
      );

      setUploadProgress(100);
      await loadDocs();
    } catch (e) {
      console.error(e);
      alert('Failed to upload document.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete Document
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await documentService.deleteDocument(user, id);
      await loadDocs();
    } catch (e) {
      console.error(e);
      alert('Failed to delete document.');
    }
  };

  // Sync to Cloud
  const handleSync = async (id: string) => {
    if (!user) return;
    try {
      await documentService.syncDocumentToCloud(user, id);
      await loadDocs();
      alert('Document synced to cloud successfully!');
    } catch (e) {
      console.error(e);
      alert('Sync failed.');
    }
  };

  // Sync to Google Drive
  const handleGoogleDriveSync = async (doc: LocalDocument) => {
    // In production, we fetch the Google Drive OAuth token from the session/profile.
    // Here we will simulate the sync or request the user to authenticate if needed.
    if (!checkLimit('googleDriveSyncs')) {
      alert('Google Drive sync is a premium feature. Please upgrade to Pro or Business.');
      return;
    }

    alert(`Uploading "${doc.name}" to Google Drive...`);
    incrementUsage('googleDriveSyncs');
  };

  // Filters and Search
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === 'pdf') return matchesSearch && doc.mimeType.includes('pdf');
    if (filterType === 'images') return matchesSearch && doc.mimeType.includes('image');
    if (filterType === 'sheets') return matchesSearch && (doc.mimeType.includes('sheet') || doc.mimeType.includes('csv') || doc.name.endsWith('.csv') || doc.name.endsWith('.xlsx'));
    if (filterType === 'text') return matchesSearch && (doc.mimeType.includes('text') || doc.name.endsWith('.txt') || doc.name.endsWith('.md'));
    
    return matchesSearch;
  });

  // Calculate local storage size
  const totalStorageUsed = documents.reduce((acc, doc) => acc + doc.size, 0);
  const totalStorageLimitBytes = limits.maxFileSizeMB * 1024 * 1024 * 20; // 20x individual file size limit
  const storagePercentage = Math.min(100, (totalStorageUsed / totalStorageLimitBytes) * 100);

  // Helper for document icon
  const getDocIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="text-error" size={24} />;
    if (mime.includes('image')) return <FileImage className="text-primary" size={24} />;
    if (mime.includes('sheet') || mime.includes('csv')) return <FileSpreadsheet className="text-success" size={24} />;
    return <FolderOpen className="text-secondary" size={24} />;
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Header & Storage Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Documents</h1>
          <p className="text-sm text-outline mt-1">Manage, convert, and scan your documents.</p>
        </div>

        {/* Storage Progress Card */}
        <div className="bg-surface-variant/20 border border-surface-variant/50 rounded-3xl p-4.5 flex items-center gap-4.5 max-w-sm w-full shadow-sm">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <HardDrive size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-on-surface">Storage Used</span>
              <span className="text-outline">{(totalStorageUsed / 1024 / 1024).toFixed(2)} MB / {(totalStorageLimitBytes / 1024 / 1024).toFixed(0)} MB</span>
            </div>
            <div className="w-full h-2 bg-outline/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${storagePercentage}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. File Upload & Filter Toolbar */}
      <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-surface-variant/25 border border-outline/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm text-on-surface transition"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* View switcher */}
            <div className="border border-outline/30 rounded-xl p-1 flex bg-surface-variant/10">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-surface text-primary shadow-sm' : 'text-outline'}`}
              >
                <Grid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-surface text-primary shadow-sm' : 'text-outline'}`}
              >
                <List size={16} />
              </button>
            </div>

            {/* Upload Button */}
            <label className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary hover:bg-primary/95 rounded-full cursor-pointer transition font-semibold text-sm shadow-sm">
              <Upload size={16} />
              <span>Upload File</span>
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

        </div>

        {/* Filter Categories */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline/10">
          {[
            { id: 'all', label: t.filterAll },
            { id: 'pdf', label: t.filterPdf },
            { id: 'images', label: t.filterImages },
            { id: 'sheets', label: t.filterSheets },
            { id: 'text', label: t.filterText },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                filterType === cat.id
                  ? 'bg-primary/15 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Uploading Progress */}
      {uploading && (
        <div className="bg-surface border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="animate-spin text-primary" size={20} />
            <div>
              <p className="text-sm font-semibold text-on-surface">Uploading document...</p>
              <p className="text-xs text-outline">Processing page elements</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">{uploadProgress}%</span>
        </div>
      )}

      {/* 4. Document List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-outline gap-3">
          <RefreshCw className="animate-spin" size={32} />
          <span className="text-sm">Loading documents...</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-outline/25 rounded-3xl text-center bg-surface-variant/5">
          <FolderOpen size={48} className="text-outline/40 mb-3" />
          <p className="text-sm font-bold text-on-surface-variant max-w-xs">{t.noDocuments}</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Layout */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map((doc) => (
            <div 
              key={doc.id}
              className="bg-surface border border-outline/15 hover:border-primary/40 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-3 bg-surface-variant/50 rounded-2xl flex-shrink-0">
                    {getDocIcon(doc.mimeType)}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-on-surface truncate" title={doc.name}>
                      {doc.name}
                    </h3>
                    <p className="text-xs text-outline">
                      {(doc.size / 1024).toFixed(1)} KB • {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Cloud/Sync indicators */}
                <div>
                  {doc.isLocalOnly ? (
                    <button 
                      onClick={() => handleSync(doc.id)}
                      className="p-1.5 bg-secondary/10 hover:bg-secondary/25 text-primary rounded-xl transition"
                      title="Sync to Cloud"
                    >
                      <CloudOff size={14} />
                    </button>
                  ) : (
                    <span className="p-1.5 text-primary bg-primary/10 rounded-xl flex items-center justify-center" title="Synced to Cloud">
                      <Cloud size={14} />
                    </span>
                  )}
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between border-t border-outline/10 pt-4 mt-2">
                <button
                  onClick={() => handleGoogleDriveSync(doc)}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <CloudLightning size={12} />
                  <span>Google Drive</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* Since it's local/already downloaded, download button might just fetch and trigger browser download */}
                  <button 
                    onClick={() => {
                      // Trigger download (normally from supabase or localDb)
                      alert('Downloading document...');
                    }}
                    className="p-2 hover:bg-surface-variant/40 rounded-xl text-on-surface-variant transition"
                    title="Download"
                  >
                    <Download size={15} />
                  </button>
                  <button 
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 hover:bg-error/10 text-outline hover:text-error rounded-xl transition"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Layout */
        <div className="bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-surface-variant/30 border-b border-outline/15">
                  <th className="p-4 font-bold text-on-surface-variant">Name</th>
                  <th className="p-4 font-bold text-on-surface-variant">Format</th>
                  <th className="p-4 font-bold text-on-surface-variant">Size</th>
                  <th className="p-4 font-bold text-on-surface-variant">Date Created</th>
                  <th className="p-4 font-bold text-on-surface-variant">Status</th>
                  <th className="p-4 font-bold text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/10">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-surface-variant/10 transition">
                    <td className="p-4 font-bold text-on-surface truncate max-w-xs">{doc.name}</td>
                    <td className="p-4 text-on-surface-variant font-medium">{doc.mimeType.split('/').pop()?.toUpperCase()}</td>
                    <td className="p-4 text-on-surface-variant">{(doc.size / 1024).toFixed(1)} KB</td>
                    <td className="p-4 text-on-surface-variant">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td className="p-4">
                      {doc.isLocalOnly ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-outline">
                          <CloudOff size={12} /> Local Only
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          <Cloud size={12} /> Synced
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleGoogleDriveSync(doc)}
                          className="p-2 hover:bg-surface-variant/35 rounded-xl text-primary transition"
                          title="Google Drive"
                        >
                          <CloudLightning size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 hover:bg-error/10 text-outline hover:text-error rounded-xl transition"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
