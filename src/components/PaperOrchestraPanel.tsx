'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X, Music2, Loader, CheckCircle2, Circle, Copy, Download,
  FileText, Sparkles, ChevronRight,
} from 'lucide-react';
import styles from '@/app/page.module.css';
import MarkdownRenderer from './MarkdownRenderer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
}

type SectionStatus = 'pending' | 'writing' | 'done';

interface PaperOrchestraPanelProps {
  folder: string;
  projectName: string;
  defaultJournal?: string;
  onClose: () => void;
  onNoteSaved: () => void;
}

// ── SSE reader helper ─────────────────────────────────────────────────────────

async function* readSSE(response: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch { /* skip malformed */ }
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PaperOrchestraPanel({
  folder,
  projectName,
  defaultJournal = '',
  onClose,
  onNoteSaved,
}: PaperOrchestraPanelProps) {
  const [journalTarget, setJournalTarget] = useState(defaultJournal);
  const [writingStyle, setWritingStyle] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionStatus, setSectionStatus] = useState<Record<string, SectionStatus>>({});
  const [sectionContent, setSectionContent] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [fullPaper, setFullPaper] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState('');
  const [view, setView] = useState<'section' | 'full'>('section');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleRun = async () => {
    setIsRunning(true);
    setError('');
    setFullPaper('');
    setSavedPath('');
    setSectionContent({});
    setSectionStatus({});
    setActiveSection(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/research/paper_orchestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, journalTarget, writingStyle }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Server error');
        return;
      }

      for await (const event of readSSE(res)) {
        if (abort.signal.aborted) break;

        switch (event.event) {
          case 'start':
            setSections(event.sections as Section[]);
            setSectionStatus(
              Object.fromEntries((event.sections as Section[]).map((s) => [s.id, 'pending']))
            );
            break;

          case 'section_start':
            setActiveSection(event.section as string);
            setSectionStatus((prev) => ({ ...prev, [event.section as string]: 'writing' }));
            setView('section');
            // Scroll to top of preview
            previewRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            break;

          case 'section_done':
            setSectionContent((prev) => ({ ...prev, [event.section as string]: event.content as string }));
            setSectionStatus((prev) => ({ ...prev, [event.section as string]: 'done' }));
            break;

          case 'complete':
            setFullPaper(event.paper as string);
            setSavedPath(event.filePath as string);
            setWordCount(event.wordCount as number);
            setActiveSection(null);
            setView('full');
            onNoteSaved();
            break;

          case 'error':
            setError(event.message as string);
            break;
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message || 'Connection failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullPaper || Object.values(sectionContent).join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = fullPaper || Object.values(sectionContent).join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = journalTarget ? `Paper_${journalTarget.replace(/\s+/g, '_')}` : 'PaperOrchestra';
    a.download = `${name}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // What to display in the main preview area
  const previewContent = view === 'full' && fullPaper
    ? fullPaper
    : activeSection && sectionContent[activeSection]
      ? sectionContent[activeSection]
      : activeSection
        ? `*Writing ${sections.find((s) => s.id === activeSection)?.label ?? activeSection}…*`
        : fullPaper || Object.values(sectionContent).join('\n\n') || '*Click **Write Paper** to begin.*';

  const doneCount = Object.values(sectionStatus).filter((s) => s === 'done').length;
  const totalCount = sections.length;

  return (
    <div className={styles.orchestraOverlay}>
      <div className={styles.orchestraModal}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={styles.orchestraHeader}>
          <div className={styles.orchestraTitle}>
            <Music2 size={18} style={{ color: 'var(--accent-base)' }} />
            PaperOrchestra
          </div>
          <span className={styles.orchestraBadge}>{projectName}</span>

          {/* Journal target input */}
          <input
            value={journalTarget}
            onChange={(e) => setJournalTarget(e.target.value)}
            placeholder="Target journal (e.g. Nature Communications)"
            disabled={isRunning}
            style={{
              flex: '1 1 220px', padding: '6px 10px', fontSize: '0.82rem',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
              borderRadius: '6px', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />

          {/* Style notes input */}
          <input
            value={writingStyle}
            onChange={(e) => setWritingStyle(e.target.value)}
            placeholder="Style notes (optional, e.g. technical, concise)"
            disabled={isRunning}
            style={{
              flex: '1 1 180px', padding: '6px 10px', fontSize: '0.82rem',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
              borderRadius: '6px', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
            {isRunning ? (
              <button
                onClick={handleStop}
                style={{
                  padding: '8px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Stop
              </button>
            ) : (
              <button className={styles.orchestraRunBtn} onClick={handleRun}>
                <Sparkles size={15} />
                Write Paper
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className={styles.orchestraBody}>

          {/* Left: section steps */}
          <div className={styles.orchestraSidebar}>
            <div style={{ padding: '0 16px 10px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sections {totalCount > 0 && `${doneCount}/${totalCount}`}
            </div>

            {sections.length === 0 && !isRunning && (
              <div style={{ padding: '0 16px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Click <strong>Write Paper</strong> to start the orchestration. The AI will write each section sequentially.
              </div>
            )}

            {sections.map((s) => {
              const status = sectionStatus[s.id] ?? 'pending';
              const isActive = activeSection === s.id;
              return (
                <div
                  key={s.id}
                  className={`${styles.orchestraSectionStep} ${isActive ? styles.orchestraSectionStepActive : ''} ${status === 'done' ? styles.orchestraSectionStepDone : ''}`}
                  onClick={() => { if (status !== 'pending') { setActiveSection(s.id); setView('section'); } }}
                  style={{ cursor: status !== 'pending' ? 'pointer' : 'default' }}
                >
                  {status === 'done' ? (
                    <CheckCircle2 size={13} />
                  ) : isActive ? (
                    <Loader size={13} className={styles.writingIndicator} />
                  ) : (
                    <Circle size={13} style={{ opacity: 0.4 }} />
                  )}
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {status === 'done' && !isActive && (
                    <ChevronRight size={11} style={{ opacity: 0.4 }} />
                  )}
                </div>
              );
            })}

            {/* View toggle */}
            {fullPaper && (
              <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  View
                </div>
                {(['section', 'full'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                      borderRadius: '5px', border: 'none', cursor: 'pointer',
                      background: view === v ? 'rgba(139,92,246,0.12)' : 'transparent',
                      color: view === v ? 'var(--accent-base)' : 'var(--text-muted)',
                      fontSize: '0.78rem', marginBottom: '4px',
                    }}
                  >
                    {v === 'section' ? '§ Section view' : '📄 Full paper'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: preview */}
          <div className={styles.orchestraMain}>
            {isRunning && (
              <div style={{
                padding: '8px 16px', background: 'rgba(139,92,246,0.08)',
                borderBottom: '1px solid rgba(139,92,246,0.15)',
                fontSize: '0.78rem', color: 'var(--accent-base)',
                display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
              }}>
                <Loader size={12} className={styles.writingIndicator} />
                Writing {sections.find((s) => s.id === activeSection)?.label ?? '…'}
                {doneCount > 0 && ` · ${doneCount}/${totalCount} sections done`}
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8rem', color: '#ef4444', flexShrink: 0 }}>
                Error: {error}
              </div>
            )}

            <div className={styles.orchestraPreview} ref={previewRef}>
              <MarkdownRenderer content={previewContent} />
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className={styles.orchestraFooter}>
          {savedPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#10b981' }}>
              <FileText size={13} />
              Saved: <strong>{savedPath.split(/[/\\]/).pop()}</strong>
              &nbsp;·&nbsp;
              <span style={{ color: 'var(--text-muted)' }}>{wordCount.toLocaleString()} words</span>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {(fullPaper || doneCount > 0) && (
              <>
                <button
                  onClick={handleCopy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', color: copied ? '#10b981' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '0.8rem',
                  }}
                >
                  <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '0.8rem',
                  }}
                >
                  <Download size={13} /> Download .md
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
