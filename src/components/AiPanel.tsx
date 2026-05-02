'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Sparkles, MessageCircle, GripVertical, Paperclip,
  Save, Send, Calendar, Database, ChevronDown, ChevronRight, Download, FilePlus
} from 'lucide-react';
import styles from '@/app/page.module.css';
import MarkdownRenderer from './MarkdownRenderer';
import type { ChatMessage, CalendarTask, Note, ProjectMeta } from '@/lib/types';

interface AiPanelProps {
  summaryContent: string;
  chatMessages: ChatMessage[];
  activeNote: Note | null;
  planFolder: string;
  isCommittingPlan: boolean;
  attachedDocsText: string;
  attachedDocsNames: string[];
  projectMeta: ProjectMeta | null;
  author: string;
  onDocAttached: (text: string, name: string) => void;
  onClearAttachments: () => void;
  onMessagesChange: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onCommitPlan: () => void;
  onNoteCreated: () => void;
  onClose: () => void;
}

export default function AiPanel({
  summaryContent,
  chatMessages,
  activeNote,
  planFolder,
  isCommittingPlan,
  attachedDocsText,
  attachedDocsNames,
  projectMeta,
  author,
  onDocAttached,
  onClearAttachments,
  onMessagesChange,
  onCommitPlan,
  onNoteCreated,
  onClose,
}: AiPanelProps) {
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(380);
  const [isResizingAi, setIsResizingAi] = useState(false);
  const [isDocUploading, setIsDocUploading] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [savingMsgIdx, setSavingMsgIdx] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const indexedSources = projectMeta?.fileIndex ?? [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleMouseDownResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = aiPanelWidth;
      setIsResizingAi(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        setAiPanelWidth(Math.max(300, Math.min(700, startWidth + (startX - ev.clientX))));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizingAi(false);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [aiPanelWidth]
  );

  const handleSendMessage = async () => {
    if (!chatInput.trim() && !attachedDocsText) return;

    const rawInput = chatInput;
    const userContent = attachedDocsText
      ? `[ATTACHED FILE CONTEXT]\n${attachedDocsText}\n\n[USER QUERY]\n${rawInput}`
      : rawInput;

    const userMsg: ChatMessage = { role: 'user', content: rawInput };
    const payloadMsg: ChatMessage = { role: 'user', content: userContent };

    onMessagesChange((prev) => [...prev, userMsg]);
    setChatInput('');
    onClearAttachments();
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/notes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, payloadMsg],
          contextFile: activeNote?.path,
          projectFolder: planFolder || activeNote?.folder,
        }),
      });
      const data = await res.json();
      onMessagesChange((prev) => [
        ...prev,
        { role: 'assistant', content: res.ok ? data.message : `Error: ${data.error}` },
      ]);
    } catch {
      onMessagesChange((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to connect to AI service.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsDocUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/notes/upload_doc', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        onDocAttached(`\n--- File: ${data.filename} ---\n${data.text}`, data.filename);
      } else {
        alert(`Failed to extract text: ${data.error}`);
      }
    } catch {
      alert('Failed to upload document');
    } finally {
      setIsDocUploading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleSaveToNote = async (content: string, index: number) => {
    const folder = planFolder || activeNote?.folder;
    if (!folder) return;

    const filename = prompt('Enter filename for the new note:', `AI_Response_${new Date().getTime()}.md`);
    if (!filename) return;

    setSavingMsgIdx(index);
    try {
      const res = await fetch('/api/notes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folder,
          filename,
          content,
          author
        }),
      });
      if (res.ok) {
        onNoteCreated();
        alert('Note saved successfully!');
      } else {
        const data = await res.json();
        alert(`Failed to save note: ${data.error}`);
      }
    } catch {
      alert('Error connecting to server');
    } finally {
      setSavingMsgIdx(null);
    }
  };

  const handleDownload = (content: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Response_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Inject a source's summary into the chat input
  const injectSource = (relPath: string, summary?: string) => {
    const text = summary
      ? `Re: "${relPath}" — ${summary}`
      : `Tell me more about "${relPath}"`;
    setChatInput((prev) => (prev ? `${prev}\n${text}` : text));
  };

  return (
    <div
      className={styles.aiPanel}
      style={{ width: `${aiPanelWidth}px`, transition: isResizingAi ? 'none' : 'width 0.2s ease' }}
    >
      {/* Resize handle */}
      <div className={styles.aiPanelResizeHandle} onMouseDown={handleMouseDownResize}>
        <GripVertical size={12} />
      </div>

      {/* Header */}
      <div className={styles.aiPanelHeader}>
        <div className={styles.aiPanelTitle}>
          <div className={styles.aiPanelTitleIcon}><Sparkles size={16} /></div>
          <span>AI Assistant</span>
          {indexedSources.length > 0 && (
            <span style={{
              marginLeft: '6px', fontSize: '0.65rem', padding: '1px 6px',
              background: 'rgba(16,185,129,0.15)', color: '#10b981',
              borderRadius: '10px', fontWeight: 600,
            }}>
              {indexedSources.length} sources
            </span>
          )}
        </div>
        <button className={styles.aiPanelClose} onClick={onClose} title="Close panel">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className={styles.aiPanelContent}>
        {/* ── Indexed sources collapsible ─────────────────────────── */}
        {indexedSources.length > 0 && (
          <div style={{
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '6px',
            marginBottom: '10px',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setShowSources((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                padding: '7px 10px', background: 'rgba(16,185,129,0.07)',
                border: 'none', cursor: 'pointer', color: '#10b981', fontSize: '0.77rem',
              }}
            >
              <Database size={12} />
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>
                Project Sources ({indexedSources.length})
              </span>
              {showSources ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {showSources && (
              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                {indexedSources.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => injectSource(src.relativePath, src.summary)}
                    title={src.summary ?? src.relativePath}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '4px', padding: '5px 8px', cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span style={{
                      fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', flexShrink: 0,
                      background: src.fileType === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                      color: src.fileType === 'pdf' ? '#ef4444' : '#3b82f6',
                    }}>
                      {src.fileType.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {src.relativePath}
                    </span>
                  </button>
                ))}
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '4px 2px 0', lineHeight: 1.4 }}>
                  Click a source to ask the AI about it. All summaries are automatically included in every response.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Summary section ─────────────────────────────────────── */}
        {summaryContent && (
          <div className={styles.aiSummarySection}>
            <div className={styles.aiSectionLabel}>
              <Sparkles size={12} /><span>Summary</span>
            </div>
            <div className={styles.aiSummaryBody}>
              <MarkdownRenderer content={summaryContent} />
            </div>
          </div>
        )}

        {/* ── Chat messages ────────────────────────────────────────── */}
        {chatMessages.length > 0 && (
          <div className={styles.aiChatSection}>
            <div className={styles.aiSectionLabel}>
              <MessageCircle size={12} /><span>Conversation</span>
            </div>
            <div className={styles.aiChatMessages}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`${styles.aiChatBubble} ${msg.role === 'user' ? styles.aiChatUser : styles.aiChatAssistant}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div className={styles.aiChatRole}>{msg.role === 'user' ? 'You' : 'AI'}</div>
                    {msg.role === 'assistant' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleDownload(msg.content)} 
                          title="Download as .md"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                        >
                          <Download size={12} />
                        </button>
                        <button 
                          onClick={() => handleSaveToNote(msg.content, i)} 
                          disabled={savingMsgIdx === i}
                          title="Save as Note in Project"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                        >
                          {savingMsgIdx === i ? <div className={styles.aiChatSpinner} style={{ width: 10, height: 10 }} /> : <FilePlus size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.aiChatText}>
                    <MarkdownRenderer content={msg.content} />
                  </div>
                  {msg.calendarTasks && msg.calendarTasks.length > 0 && (
                    <CalendarTaskButtons tasks={msg.calendarTasks} />
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.aiPanelFooter}>
        {attachedDocsNames.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-base)', marginBottom: '8px' }}>
            📎 Attached: {attachedDocsNames.join(', ')}
          </div>
        )}
        <div className={styles.aiChatInputWrapper}>
          <input
            type="text"
            className={styles.aiChatInput}
            placeholder={indexedSources.length > 0 ? `Ask about this project (${indexedSources.length} sources loaded)…` : 'Ask about this note…'}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          />
          <input type="file" ref={docInputRef} style={{ display: 'none' }} onChange={handleDocUpload} />
          <button
            className={styles.aiChatSendBtn}
            style={{ background: 'transparent', color: 'var(--text-muted)' }}
            onClick={() => docInputRef.current?.click()}
            disabled={isDocUploading}
            title="Attach Document"
          >
            {isDocUploading ? <div className={styles.aiChatSpinner} /> : <Paperclip size={16} />}
          </button>
          {planFolder && (
            <button
              className={styles.aiChatSendBtn}
              style={{ background: 'transparent', color: 'var(--accent-base)', fontWeight: 600, padding: '0 8px', width: 'auto' }}
              onClick={onCommitPlan}
              disabled={isCommittingPlan}
              title="Accept & Commit Plan"
            >
              {isCommittingPlan
                ? <div className={styles.aiChatSpinner} />
                : <><Save size={16} /><span style={{ marginLeft: '4px', fontSize: '0.75rem' }}>Commit</span></>
              }
            </button>
          )}
          <button
            className={styles.aiChatSendBtn}
            onClick={handleSendMessage}
            disabled={isChatLoading || (!chatInput.trim() && !attachedDocsText)}
            title="Send message"
          >
            {isChatLoading ? <div className={styles.aiChatSpinner} /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarTaskButtons({ tasks }: { tasks: CalendarTask[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-base)' }}>Suggested Calendar Tasks:</span>
      {tasks.map((t, idx) => {
        const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(t.title)}&body=${encodeURIComponent(t.description)}&startdt=${encodeURIComponent(t.start)}&enddt=${encodeURIComponent(t.end)}`;
        const gStart = t.start.replace(/[-:]/g, '');
        const gEnd = t.end.replace(/[-:]/g, '');
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t.title)}&details=${encodeURIComponent(t.description)}&dates=${gStart}/${gEnd}`;
        return (
          <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{t.title}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{new Date(t.start).toLocaleDateString()}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={outlookUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#0078d4', textDecoration: 'none', background: 'rgba(0,120,212,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                <Calendar size={12} /> Outlook
              </a>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#ea4335', textDecoration: 'none', background: 'rgba(234,67,53,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                <Calendar size={12} /> Google
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
