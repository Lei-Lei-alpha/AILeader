'use client';

import React, { useState } from 'react';
import { Database, BookOpenCheck, Loader, RefreshCw, AlertCircle } from 'lucide-react';
import type { ProjectMeta } from '@/lib/types';

interface FileIndexStatusProps {
  folder: string;
  projectMeta: ProjectMeta | null;
  isIndexing: boolean;
  onIndex: (folder: string, force?: boolean) => void;
  onAnalyzeLiterature: (folder: string) => void;
  isAnalyzing: boolean;
}

export default function FileIndexStatus({
  folder,
  projectMeta,
  isIndexing,
  onIndex,
  onAnalyzeLiterature,
  isAnalyzing,
}: FileIndexStatusProps) {
  const [showFiles, setShowFiles] = useState(false);

  if (!folder) return null;

  const fileIndex = projectMeta?.fileIndex ?? [];
  const indexedCount = fileIndex.length;
  const lastIndexed = indexedCount > 0
    ? Math.max(...fileIndex.map((e) => e.lastIndexed))
    : null;

  const formatAge = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const hasIndex = indexedCount > 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 12px',
      background: 'rgba(139,92,246,0.06)',
      border: '1px solid rgba(139,92,246,0.15)',
      borderRadius: '6px',
      marginBottom: '10px',
      flexWrap: 'wrap',
    }}>
      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
        {isIndexing ? (
          <Loader size={14} style={{ animation: 'spinAi 1s linear infinite', color: 'var(--accent-base)', flexShrink: 0 }} />
        ) : hasIndex ? (
          <Database size={14} style={{ color: 'var(--accent-base)', flexShrink: 0 }} />
        ) : (
          <AlertCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}

        <span style={{ fontSize: '0.78rem', color: isIndexing ? 'var(--accent-base)' : hasIndex ? 'var(--text-secondary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {isIndexing
            ? 'Indexing project files…'
            : hasIndex
              ? `${indexedCount} file${indexedCount !== 1 ? 's' : ''} indexed${lastIndexed ? ` · ${formatAge(lastIndexed)}` : ''}`
              : 'No files indexed yet'}
        </span>

        {hasIndex && (
          <button
            onClick={() => setShowFiles((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px', flexShrink: 0 }}
            title="Show/hide indexed files"
          >
            {showFiles ? '▴' : '▾'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onIndex(folder, false)}
          disabled={isIndexing}
          title={hasIndex ? 'Re-index changed files' : 'Index all project files with AI'}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)',
            background: 'rgba(139,92,246,0.1)', color: 'var(--accent-base)',
            cursor: isIndexing ? 'not-allowed' : 'pointer', fontSize: '0.75rem', opacity: isIndexing ? 0.5 : 1,
          }}
        >
          <RefreshCw size={11} /> {hasIndex ? 'Re-index' : 'Index Now'}
        </button>

        {hasIndex && (
          <button
            onClick={() => onAnalyzeLiterature(folder)}
            disabled={isAnalyzing || isIndexing}
            title="Run AI literature analysis on all indexed files"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)',
              background: 'rgba(16,185,129,0.08)', color: '#10b981',
              cursor: (isAnalyzing || isIndexing) ? 'not-allowed' : 'pointer', fontSize: '0.75rem',
              opacity: (isAnalyzing || isIndexing) ? 0.5 : 1,
            }}
          >
            <BookOpenCheck size={11} />
            {isAnalyzing ? 'Analyzing…' : 'Analyze Literature'}
          </button>
        )}
      </div>

      {/* Expandable file list */}
      {showFiles && hasIndex && (
        <div style={{ width: '100%', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto' }}>
            {fileIndex.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span style={{
                  padding: '1px 5px', borderRadius: '3px', fontSize: '0.65rem',
                  background: entry.fileType === 'pdf' ? 'rgba(239,68,68,0.15)' : entry.fileType === 'md' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)',
                  color: entry.fileType === 'pdf' ? '#ef4444' : entry.fileType === 'md' ? '#3b82f6' : 'var(--accent-base)',
                  flexShrink: 0,
                }}>
                  {entry.fileType.toUpperCase()}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.relativePath}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
