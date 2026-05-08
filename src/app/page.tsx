'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Edit,
  Save,
  XCircle,
  Sparkles,
  MessageCircle,
  Settings,
  Calendar,
  Menu,
  GitBranch,
  Music2,
} from 'lucide-react';
import styles from './page.module.css';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import TableOfContents from '@/components/TableOfContents';
import Sidebar from '@/components/Sidebar';
import MentorChatPanel from '@/components/MentorChatPanel';
import Dashboard from '@/components/Dashboard';
import FileIndexStatus from '@/components/FileIndexStatus';
import ResearchPipelineView from '@/components/ResearchPipelineView';
import PaperOrchestraPanel from '@/components/PaperOrchestraPanel';
import NotificationBell from '@/components/NotificationBell';
import type { Note, ChatMessage, CalendarTask, ProjectMeta, MentorChatMode, LLMProvider, AppSettings } from '@/lib/types';

export default function Home() {
  // ── Core data ────────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<string[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [author, setAuthor] = useState('');
  const [projectFolders, setProjectFolders] = useState<Set<string>>(new Set());

  // ── Note viewing / editing ───────────────────────────────────────────────
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [activeContent, setActiveContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeNoteRef = useRef<Note | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Settings ─────────────────────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteUnusedFigures, setDeleteUnusedFigures] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('ollama');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [skyworkApiKey, setSkyworkApiKey] = useState('');
  const [skyworkGatewayUrl, setSkyworkGatewayUrl] = useState('');
  const [mentorPersona, setMentorPersona] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  // ── AI Panel (shared state) ───────────────────────
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [attachedDocsText, setAttachedDocsText] = useState('');
  const [attachedDocsNames, setAttachedDocsNames] = useState<string[]>([]);
  const [chatMode, setChatMode] = useState<MentorChatMode>('mentor');

  // ── AI Plan modal ────────────────────────────────────────────────────────
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planFolder, setPlanFolder] = useState('');
  const [planTimeFrame, setPlanTimeFrame] = useState('1 month');
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isCommittingPlan, setIsCommittingPlan] = useState(false);

  // ── Dashboard ────────────────────────────────────────────────────────────
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  // ── Phase 2: file indexing ────────────────────────────────────────────────
  const [activeProjectMeta, setActiveProjectMeta] = useState<ProjectMeta | null>(null);
  const [indexingFolder, setIndexingFolder] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Phase 3: pipeline ─────────────────────────────────────────────────────
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [pipelineFolder, setPipelineFolder] = useState<string>('');

  // ── PaperOrchestra ────────────────────────────────────────────────────────
  const [isPaperOrchestraOpen, setIsPaperOrchestraOpen] = useState(false);
  const [paperOrchestraFolder, setPaperOrchestraFolder] = useState('');

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchFolders();
    fetchNotes();
    fetchSettings();

    const listInterval = setInterval(() => {
      fetchNotes(false);
      fetchFolders();
    }, 5000);
    const contentInterval = setInterval(() => {
      if (activeNoteRef.current) pollActiveContent(activeNoteRef.current);
    }, 1000);
    // Auto re-index: check active project folder for changed files every 90 seconds
    const reindexInterval = setInterval(async () => {
      const folder = activeNoteRef.current?.folder;
      if (!folder) return;
      try {
        const res = await fetch(`/api/research/check_changes?folder=${encodeURIComponent(folder)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.needsReindex) {
          // Silently re-index without showing the indexing spinner
          await fetch('/api/research/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder }),
          });
          const metaRes = await fetch(`/api/research/meta?folder=${encodeURIComponent(folder)}`);
          if (metaRes.ok) setActiveProjectMeta(await metaRes.json());
        }
      } catch { /* ignore background polling errors */ }
    }, 90000);

    return () => {
      clearInterval(listInterval);
      clearInterval(contentInterval);
      clearInterval(reindexInterval);
    };
  }, []);

  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  // Check which registered folders have .research_meta.json whenever folders change
  useEffect(() => {
    if (folders.length === 0) return;
    checkProjectFolders(folders);
  }, [folders]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotes = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data.notes || []);
      if (data.author) setAuthor(data.author);
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setDeleteUnusedFigures(data.deleteUnusedFigures ?? false);
      setLlmProvider(data.llm_provider || 'ollama');
      setOllamaUrl(data.ollama_url || 'http://localhost:11434');
      setOllamaModel(data.ollama_model || 'llama3');
      setOpenaiApiKey(data.openai_api_key || '');
      setOpenaiModel(data.openai_model || 'gpt-4o');
      setAnthropicApiKey(data.anthropic_api_key || '');
      setAnthropicModel(data.anthropic_model || 'claude-3-5-sonnet-20240620');
      setGeminiApiKey(data.gemini_api_key || '');
      setGeminiModel(data.gemini_model || 'gemini-1.5-pro');
      setSkyworkApiKey(data.skywork_api_key || '');
      setSkyworkGatewayUrl(data.skywork_gateway_url || 'https://office.skywork.ai/api/v1');
      setMentorPersona(data.mentor_persona || '');
      if (data.author) setAuthor(data.author);
    } catch (e) {
      console.error(e);
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setDeleteUnusedFigures(data.deleteUnusedFigures ?? false);
        setLlmProvider(data.llm_provider || 'ollama');
        setOllamaUrl(data.ollama_url || 'http://localhost:11434');
        setOllamaModel(data.ollama_model || 'llama3');
        setOpenaiApiKey(data.openai_api_key || '');
        setOpenaiModel(data.openai_model || 'gpt-4o');
        setAnthropicApiKey(data.anthropic_api_key || '');
        setAnthropicModel(data.anthropic_model || 'claude-3-5-sonnet-20240620');
        setGeminiApiKey(data.gemini_api_key || '');
        setGeminiModel(data.gemini_model || 'gemini-1.5-pro');
        setSkyworkApiKey(data.skywork_api_key || '');
        setSkyworkGatewayUrl(data.skywork_gateway_url || 'https://office.skywork.ai/api/v1');
        setMentorPersona(data.mentor_persona || '');
        if (data.author) setAuthor(data.author);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSettingsLoading(false);
    }
  };

  // ── Active project meta ───────────────────────────────────────────────────

  const loadProjectMeta = async (folder: string) => {
    try {
      const res = await fetch(`/api/research/meta?folder=${encodeURIComponent(folder)}`);
      setActiveProjectMeta(res.ok ? await res.json() : null);
    } catch {
      setActiveProjectMeta(null);
    }
  };

  useEffect(() => {
    if (activeNote?.folder) loadProjectMeta(activeNote.folder);
    else setActiveProjectMeta(null);
  }, [activeNote]);

  const checkProjectFolders = async (paths: string[]) => {
    const results = new Set<string>();
    for (const f of paths) {
      try {
        const res = await fetch(`/api/research/index?folder=${encodeURIComponent(f)}`);
        if (res.ok) results.add(f);
      } catch { /* ignore */ }
    }
    setProjectFolders(results);
  };

  // ── Event Handlers ────────────────────────────────────────────────────────

  const pollActiveContent = async (note: Note) => {
    if (isEditing) return;
    try {
      const res = await fetch(`/api/notes/content?path=${encodeURIComponent(note.path)}`);
      const data = await res.json();
      if (res.ok) {
        if (data.content !== activeContent) setActiveContent(data.content);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectNote = async (note: Note) => {
    if (isEditing) {
      if (!confirm('You have unsaved changes. Discard?')) return;
      setIsEditing(false);
    }
    setActiveNote(note);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/notes/content?path=${encodeURIComponent(note.path)}`);
      const data = await res.json();
      if (res.ok) setActiveContent(data.content);
      else setActiveContent('Failed to load note.');
    } catch {
      setActiveContent('Failed to load note.');
    } finally {
      setContentLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!activeNote) return;
    try {
      await fetch('/api/notes/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeNote.path, content: editedContent }),
      });
      setActiveContent(editedContent);
      setIsEditing(false);
    } catch (e) {
      alert('Failed to save note.');
    }
  };

  const handleSummarizeNote = async () => {
    if (!activeNote) return;
    setIsSummaryOpen(true);
    setChatMessages((prev) => [...prev, { role: 'user', content: 'Please summarize this note and suggest the next steps for research.' }]);
    try {
      const res = await fetch('/api/notes/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeNote.path }),
      });
      const data = await res.json();
      if (res.ok) {
        setSummaryContent(data.summary);
        setChatMessages((prev) => [...prev, { role: 'assistant', content: data.summary, calendarTasks: data.calendarTasks }]);
      } else {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to generate summary: ' + data.error }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to connect to summarization service.' }]);
    }
  };

  const submitAIPlan = async () => {
    if (!planFolder || !planTimeFrame) return;
    setIsPlanLoading(true);
    try {
      const res = await fetch('/api/notes/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: planFolder, timeFrame: planTimeFrame, attachedDocsText }),
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages([{ role: 'assistant', content: data.plan }]);
        setIsSummaryOpen(true);
        setIsPlanModalOpen(false);
      } else {
        alert('Failed to generate plan: ' + data.error);
      }
    } catch {
      alert('Failed to connect to planning service.');
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handleCommitPlan = async () => {
    if (!planFolder) return;
    setIsCommittingPlan(true);
    try {
      const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === 'assistant');
      if (!lastAssistantMsg) return;

      const res = await fetch('/api/notes/commit_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: planFolder, planText: lastAssistantMsg.content }),
      });
      if (res.ok) {
        alert('Research plan committed to project files.');
        setPlanFolder('');
        fetchNotes();
      } else {
        alert('Failed to commit plan.');
      }
    } catch {
      alert('Error connecting to server.');
    } finally {
      setIsCommittingPlan(false);
    }
  };

  const handleIndexFolder = async (folder: string) => {
    setIndexingFolder(folder);
    try {
      const res = await fetch(`/api/research/index?folder=${encodeURIComponent(folder)}&force=true`, { method: 'POST' });
      if (res.ok) {
        loadProjectMeta(folder);
        alert('Folder indexed successfully.');
      } else {
        const data = await res.json();
        alert('Indexing failed: ' + data.error);
      }
    } catch {
      alert('Connection error during indexing.');
    } finally {
      setIndexingFolder(null);
    }
  };

  const handleAnalyzeLiterature = async (folder: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/research/analyze_literature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: data.analysis }]);
        setIsSummaryOpen(true);
      } else {
        alert('Literature analysis failed: ' + data.error);
      }
    } catch {
      alert('Connection error during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('files', files[i]);

    try {
      const res = await fetch('/api/notes/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        let appendText = '\n';
        data.urls.forEach((url: string, idx: number) => {
          appendText += `\n![Uploaded Image](${url})\n`;
        });
        setEditedContent((prev) => prev + appendText);
      }
    } catch (e) {
      alert('Image upload failed.');
    } finally {
      setUploadingImages(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      <Sidebar
        notes={notes}
        folders={folders}
        activeNote={activeNote}
        sidebarCollapsed={sidebarCollapsed}
        author={author}
        projectFolders={projectFolders}
        indexingFolder={indexingFolder}
        onSelectNote={handleSelectNote}
        onSidebarCollapse={setSidebarCollapsed}
        onFolderAdded={fetchFolders}
        onFolderDeleted={fetchFolders}
        onNoteCreated={fetchNotes}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onAIPlan={(f) => { setPlanFolder(f); setIsPlanModalOpen(true); }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onIndexFolder={handleIndexFolder}
        onOpenPipeline={async (folder) => {
          await loadProjectMeta(folder);
          setPipelineFolder(folder);
          setIsPipelineOpen(true);
        }}
      />

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <span style={{ fontWeight: 500 }}>{activeNote ? activeNote.relativePath : 'Select a note to begin'}</span>
            <NotificationBell />
          </div>
        </div>

        <div className={styles.contentWrapper}>
          {contentLoading && (
            <div className={styles.loading}><BookOpen size={32} /></div>
          )}

          {!contentLoading && activeNote && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.noteMeta}>
                  Author: <strong>{author || 'Lab User'}</strong> &ensp;•&ensp;
                  Created on {new Date(activeNote.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </div>

                {/* File index status bar */}
                <FileIndexStatus
                  folder={activeNote.folder}
                  projectMeta={activeProjectMeta}
                  isIndexing={indexingFolder === activeNote.folder}
                  onIndex={handleIndexFolder}
                  onAnalyzeLiterature={handleAnalyzeLiterature}
                  isAnalyzing={isAnalyzing}
                />
                <div className={styles.editorHeader}>
                  {!isEditing ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.editBtn} onClick={() => { setEditedContent(activeContent); setIsEditing(true); }}>
                        <Edit size={16} /> Edit
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={() => setIsSummaryOpen(true)}
                        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                      >
                        <MessageCircle size={16} /> Chat
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={handleSummarizeNote}
                        style={{ backgroundColor: 'var(--accent-base)', color: 'white' }}
                      >
                        <Sparkles size={16} /> Summarize
                      </button>
                      {activeProjectMeta && activeNote && (
                        <button
                          className={styles.editBtn}
                          onClick={() => { setPipelineFolder(activeNote.folder); setIsPipelineOpen(true); }}
                          style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                        >
                          <GitBranch size={16} /> Pipeline
                        </button>
                      )}
                      {activeProjectMeta && activeNote && (
                        <button
                          className={styles.editBtn}
                          onClick={() => { setPaperOrchestraFolder(activeNote.folder); setIsPaperOrchestraOpen(true); }}
                          style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: 'var(--accent-base)', border: '1px solid rgba(139,92,246,0.25)' }}
                        >
                          <Music2 size={16} /> PaperOrchestra
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.saveBtn} onClick={handleSaveNote}>
                        <Save size={16} /> Save Changes
                      </button>
                      <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
                        <XCircle size={16} /> Cancel
                      </button>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                        <label className={styles.uploadBtn}>
                          {uploadingImages ? 'Uploading...' : 'Add Figures'}
                          <input type="file" multiple accept="image/*" onChange={handleFileUpload} disabled={uploadingImages} style={{ display: 'none' }} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className={styles.editorWrapper}>
                    <textarea
                      className={styles.editor}
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      spellCheck={false}
                    />
                    {isDragging && (
                      <div className={styles.dragOverlay}>Drop image to upload and embed</div>
                    )}
                  </div>
                ) : (
                  <MarkdownRenderer content={activeContent} />
                )}
              </div>
              <TableOfContents content={isEditing ? editedContent : activeContent} />
            </div>
          )}

          {!contentLoading && !activeNote && (
            <div className={styles.emptyState}>
              <BookOpen className={styles.emptyStateIcon} />
              <h2>Research Mentor</h2>
              <p>Select a note from the sidebar or add a research folder to begin.</p>
            </div>
          )}
        </div>
      </main>

      {/* AI Panel */}
      {isSummaryOpen && (
        <MentorChatPanel
          summaryContent={summaryContent}
          chatMessages={chatMessages}
          activeNote={activeNote}
          planFolder={planFolder}
          isCommittingPlan={isCommittingPlan}
          attachedDocsText={attachedDocsText}
          attachedDocsNames={attachedDocsNames}
          projectMeta={activeProjectMeta}
          author={author}
          chatMode={chatMode}
          onDocAttached={(text, name) => {
            setAttachedDocsText((prev) => prev + text);
            setAttachedDocsNames((prev) => [...prev, name]);
          }}
          onClearAttachments={() => { setAttachedDocsText(''); setAttachedDocsNames([]); }}
          onMessagesChange={setChatMessages}
          onCommitPlan={handleCommitPlan}
          onNoteCreated={fetchNotes}
          onModeChange={setChatMode}
          onClose={() => setIsSummaryOpen(false)}
        />
      )}

      {/* Dashboard */}
      {isDashboardOpen && (
        <Dashboard
          folders={folders}
          onClose={() => setIsDashboardOpen(false)}
        />
      )}

      {/* Research Pipeline */}
      {isPipelineOpen && activeProjectMeta && pipelineFolder && (
        <ResearchPipelineView
          folder={pipelineFolder}
          meta={activeProjectMeta}
          onClose={() => setIsPipelineOpen(false)}
          onMetaChange={(updated) => setActiveProjectMeta(updated)}
          onOpenChat={(message) => {
            setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
            setIsSummaryOpen(true);
            setIsPipelineOpen(false);
          }}
          onOpenOrchestra={() => {
            setPaperOrchestraFolder(pipelineFolder);
            setIsPipelineOpen(false);
            setIsPaperOrchestraOpen(true);
          }}
        />
      )}

      {/* PaperOrchestra */}
      {isPaperOrchestraOpen && paperOrchestraFolder && (
        <PaperOrchestraPanel
          folder={paperOrchestraFolder}
          projectName={activeProjectMeta?.project?.displayName || paperOrchestraFolder.split(/[/\\]/).pop() || 'Project'}
          onClose={() => setIsPaperOrchestraOpen(false)}
          onNoteSaved={fetchNotes}
        />
      )}

      {/* AI Plan modal */}
      {isPlanModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsPlanModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Generate AI Research Plan</h3>
            <p>Select the project folder and define a timeframe to generate SMART tasks aimed at publishing a top journal paper.</p>

            <label style={{ display: 'block', margin: '15px 0 5px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Project Folder</label>
            <select
              value={planFolder}
              onChange={(e) => setPlanFolder(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="" disabled>Select a folder...</option>
              {folders.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <label style={{ display: 'block', margin: '15px 0 5px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Timeframe</label>
            <input
              type="text"
              placeholder="e.g. 2 weeks, 3 months, 1 year..."
              value={planTimeFrame}
              onChange={(e) => setPlanTimeFrame(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && planFolder) submitAIPlan(); }}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            />

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsPlanModalOpen(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={submitAIPlan} disabled={!planFolder || !planTimeFrame}>
                {isPlanLoading ? 'Generating...' : 'Generate Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {isSettingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
          <div className={styles.modal} style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={deleteUnusedFigures}
                    onChange={(e) => { setDeleteUnusedFigures(e.target.checked); updateSettings({ deleteUnusedFigures: e.target.checked }); }}
                    disabled={settingsLoading}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Delete Unused Figures</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Auto-remove figure files no longer referenced in any markdown file
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>LLM Provider</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['ollama', 'openai', 'anthropic', 'gemini'] as LLMProvider[]).map(p => (
                    <button
                      key={p}
                      onClick={() => { setLlmProvider(p); updateSettings({ llm_provider: p }); }}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
                        background: llmProvider === p ? 'rgba(139,92,246,0.15)' : 'var(--bg-elevated)',
                        color: llmProvider === p ? 'var(--accent-base)' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {llmProvider === 'ollama' && (
                <>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Ollama API URL</label>
                    <input
                      className={styles.detailInput}
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      onBlur={() => updateSettings({ ollama_url: ollamaUrl })}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Ollama Model</label>
                    <input
                      className={styles.detailInput}
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      onBlur={() => updateSettings({ ollama_model: ollamaModel })}
                      placeholder="llama3"
                    />
                  </div>
                </>
              )}

              {llmProvider === 'openai' && (
                <>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>OpenAI API Key</label>
                    <input
                      type="password"
                      className={styles.detailInput}
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      onBlur={() => updateSettings({ openai_api_key: openaiApiKey })}
                      placeholder="sk-..."
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Model Name</label>
                    <input
                      className={styles.detailInput}
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      onBlur={() => updateSettings({ openai_model: openaiModel })}
                      placeholder="gpt-4o"
                    />
                  </div>
                </>
              )}

              {llmProvider === 'anthropic' && (
                <>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Anthropic API Key</label>
                    <input
                      type="password"
                      className={styles.detailInput}
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      onBlur={() => updateSettings({ anthropic_api_key: anthropicApiKey })}
                      placeholder="sk-ant-..."
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Model Name</label>
                    <input
                      className={styles.detailInput}
                      value={anthropicModel}
                      onChange={(e) => setAnthropicModel(e.target.value)}
                      onBlur={() => updateSettings({ anthropic_model: anthropicModel })}
                      placeholder="claude-3-5-sonnet-20240620"
                    />
                  </div>
                </>
              )}

              {llmProvider === 'gemini' && (
                <>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Gemini API Key</label>
                    <input
                      type="password"
                      className={styles.detailInput}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      onBlur={() => updateSettings({ gemini_api_key: geminiApiKey })}
                      placeholder="AIza..."
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Model Name</label>
                    <input
                      className={styles.detailInput}
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      onBlur={() => updateSettings({ gemini_model: geminiModel })}
                      placeholder="gemini-1.5-pro"
                    />
                  </div>
                </>
              )}

              <div style={{ marginBottom: '1.25rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Skywork Skills (Experimental)</label>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Skywork API Key</label>
                <input
                  type="password"
                  className={styles.detailInput}
                  value={skyworkApiKey}
                  onChange={(e) => setSkyworkApiKey(e.target.value)}
                  onBlur={() => updateSettings({ skywork_api_key: skyworkApiKey })}
                  placeholder="Enter your key from skywork.ai"
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Gateway URL</label>
                <input
                  className={styles.detailInput}
                  value={skyworkGatewayUrl}
                  onChange={(e) => setSkyworkGatewayUrl(e.target.value)}
                  onBlur={() => updateSettings({ skywork_gateway_url: skyworkGatewayUrl })}
                  placeholder="https://office.skywork.ai/api/v1"
                />
              </div>

              <div style={{ marginBottom: '1.25rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Researcher Settings</label>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Author Name</label>
                <input
                  className={styles.detailInput}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  onBlur={() => updateSettings({ author })}
                  placeholder="Dr. Researcher"
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Project Persona</label>
                <input
                  className={styles.detailInput}
                  value={mentorPersona}
                  onChange={(e) => setMentorPersona(e.target.value)}
                  onBlur={() => updateSettings({ mentor_persona: mentorPersona })}
                  placeholder="e.g. PI in physics"
                />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.saveBtn} onClick={() => setIsSettingsOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
