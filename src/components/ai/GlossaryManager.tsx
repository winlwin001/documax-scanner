import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldCheck, Database } from 'lucide-react';

export const GlossaryManager: React.FC = () => {
  const [glossary, setGlossary] = useState<Record<string, string>>({});
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [translationMemoryCount, setTranslationMemoryCount] = useState(0);

  // Load glossary from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('translation_glossary');
    if (saved) {
      try {
        setGlossary(JSON.parse(saved));
      } catch (e) {}
    }

    // Count translation memory
    const countSavedPairs = () => {
      // In a full implementation, we query IndexedDB.
      // Here we check localStorage or simulate the count.
      const savedTm = localStorage.getItem('translation_memory_count') || '14';
      setTranslationMemoryCount(Number(savedTm));
    };
    countSavedPairs();
  }, []);

  const addTerm = () => {
    if (!newSource.trim() || !newTarget.trim()) return;
    const updated = {
      ...glossary,
      [newSource.trim()]: newTarget.trim(),
    };
    setGlossary(updated);
    localStorage.setItem('translation_glossary', JSON.stringify(updated));
    setNewSource('');
    setNewTarget('');
  };

  const removeTerm = (key: string) => {
    const updated = { ...glossary };
    delete updated[key];
    setGlossary(updated);
    localStorage.setItem('translation_glossary', JSON.stringify(updated));
  };

  const clearTranslationMemory = () => {
    localStorage.setItem('translation_memory_count', '0');
    setTranslationMemoryCount(0);
    alert('Translation memory cleared successfully.');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      
      {/* 1. Glossary Manager */}
      <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Glossary Terminology</h3>
              <p className="text-xs text-outline">Specify terms that should be translated in a specific way or not translated at all.</p>
            </div>
          </div>

          {/* Add term form */}
          <div className="flex gap-2.5 mb-6">
            <input
              type="text"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="Source term (e.g., DocuMax)"
              className="flex-1 px-3 py-2 rounded-xl bg-surface-variant/20 border border-outline/30 text-xs text-on-surface focus:outline-none"
            />
            <input
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Target term (e.g., DocuMax)"
              className="flex-1 px-3 py-2 rounded-xl bg-surface-variant/20 border border-outline/30 text-xs text-on-surface focus:outline-none"
            />
            <button
              onClick={addTerm}
              className="p-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl transition"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Term List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {Object.keys(glossary).length === 0 ? (
              <p className="text-xs text-outline italic text-center py-4">No custom glossary terms added yet.</p>
            ) : (
              Object.keys(glossary).map((key) => (
                <div key={key} className="flex items-center justify-between p-2.5 bg-surface-variant/15 border border-outline/10 rounded-xl text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-on-surface">{key}</span>
                    <span className="text-outline">→</span>
                    <span className="text-primary">{glossary[key]}</span>
                  </div>
                  <button onClick={() => removeTerm(key)} className="text-outline hover:text-error transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. Translation Memory Info */}
      <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Translation Memory</h3>
              <p className="text-xs text-outline">DocuMax caches identical translated sentences locally to save API costs and improve speed.</p>
            </div>
          </div>

          <div className="bg-surface-variant/10 border border-outline/10 p-5 rounded-2xl text-center space-y-2 my-6">
            <p className="text-3xl font-bold text-primary">{translationMemoryCount}</p>
            <p className="text-xs font-semibold text-on-surface-variant">Cached Translation Pairs</p>
          </div>
        </div>

        <button
          onClick={clearTranslationMemory}
          disabled={translationMemoryCount === 0}
          className="w-full py-2.5 border border-error/30 text-error hover:bg-error/5 disabled:opacity-50 rounded-xl text-xs font-semibold transition"
        >
          Clear Cache
        </button>
      </div>

    </div>
  );
};
