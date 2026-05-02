'use client';

import React, { useState, useCallback } from 'react';
import { X, Wand2, Loader, CheckCheck, Clock, AlertCircle, Circle, Plus } from 'lucide-react';
import styles from '@/app/page.module.css';
import MilestoneDetailPanel from './MilestoneDetailPanel';
import GoalOutputManager from './GoalOutputManager';
import type {
  ProjectMeta, ResearchStage, ResearchMilestone, SMARTGoal, PublicationTarget, MilestoneStatus,
} from '@/lib/types';
import { RESEARCH_STAGES, STAGE_LABELS } from '@/lib/types';

interface ResearchPipelineViewProps {
  folder: string;
  meta: ProjectMeta;
  onClose: () => void;
  onMetaChange: (meta: ProjectMeta) => void;
  onOpenChat: (message: string) => void;
}

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  pending: 'rgba(255,255,255,0.25)',
  in_progress: '#f59e0b',
  completed: '#10b981',
  blocked: '#ef4444',
};

const STATUS_ICON: Record<MilestoneStatus, React.ReactNode> = {
  pending: <Circle size={11} />,
  in_progress: <Clock size={11} />,
  completed: <CheckCheck size={11} />,
  blocked: <AlertCircle size={11} />,
};

function stageIndex(stage: ResearchStage) {
  return RESEARCH_STAGES.indexOf(stage);
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

export default function ResearchPipelineView({
  folder,
  meta,
  onClose,
  onMetaChange,
  onOpenChat,
}: ResearchPipelineViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<ResearchMilestone | null>(null);
  const [filterStage, setFilterStage] = useState<ResearchStage | null>(null);

  const currentStageIdx = stageIndex(meta.project.stage);

  const milestonesForStage = (stage: ResearchStage) =>
    meta.milestones.filter((m) => m.stage === stage);

  const visibleMilestones = filterStage
    ? meta.milestones.filter((m) => m.stage === filterStage)
    : meta.milestones;

  const goalForMilestone = (id: string) =>
    meta.smartGoals.find((g) => g.milestoneId === id);

  // ── Pipeline generation ───────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/research/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
      const data = await res.json();
      if (res.ok && data.meta) {
        onMetaChange(data.meta);
      } else {
        alert(`Pipeline generation failed: ${data.error}`);
      }
    } catch {
      alert('Failed to connect to server');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── PATCH helpers ─────────────────────────────────────────────────────────

  const patchItem = useCallback(
    async (type: string, id: string, updates: Record<string, unknown>) => {
      const res = await fetch('/api/research/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, type, id, updates }),
      });
      const data = await res.json();
      if (res.ok && data.meta) onMetaChange(data.meta);
    },
    [folder, onMetaChange]
  );

  const deleteItem = useCallback(
    async (type: string, id: string) => {
      const res = await fetch('/api/research/pipeline', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, type, id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Re-fetch meta
        const metaRes = await fetch(`/api/research/meta?folder=${encodeURIComponent(folder)}`);
        if (metaRes.ok) onMetaChange(await metaRes.json());
      }
    },
    [folder, onMetaChange]
  );

  const handleSaveMilestone = async (
    milestoneUpdates: Partial<ResearchMilestone>,
    goalUpdates?: Partial<SMARTGoal>
  ) => {
    if (!selectedMilestone) return;
    await patchItem('milestone', selectedMilestone.id, milestoneUpdates);
    const g = goalForMilestone(selectedMilestone.id);
    if (goalUpdates && g) {
      await patchItem('goal', g.id, goalUpdates);
    }
    // Update selection state
    setSelectedMilestone((prev) => prev ? { ...prev, ...milestoneUpdates } : prev);
  };

  const handleAddTarget = async (target: Omit<PublicationTarget, 'projectId'>) => {
    const res = await fetch('/api/research/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder,
        type: 'target',
        id: target.id,
        updates: { ...target, projectId: meta.project.id },
      }),
    });
    const data = await res.json();
    if (res.ok && data.meta) onMetaChange(data.meta);
  };

  const handleAddMilestone = async () => {
    const stage = filterStage || meta.project.stage;
    const newId = generateId();
    const newMilestone: Partial<ResearchMilestone> = {
      id: newId,
      stage,
      title: 'New Milestone',
      description: 'Describe what needs to be done.',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      dependsOn: [],
      linkedFiles: [],
    };

    const res = await fetch('/api/research/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder,
        type: 'milestone',
        id: newId,
        updates: newMilestone,
      }),
    });
    const data = await res.json();
    if (res.ok && data.meta) {
      onMetaChange(data.meta);
      const created = data.meta.milestones.find((m: any) => m.id === newId);
      if (created) setSelectedMilestone(created);
    }
  };

  const handleAskMentor = (msg: string) => {
    onOpenChat(msg);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.pipelineOverlay}>
      <div className={styles.pipelineModal}>

        {/* Header */}
        <div className={styles.pipelineHeader}>
          <div className={styles.pipelineTitle}>Research Pipeline</div>
          <span className={styles.pipelineProjectName}>
            {meta.project.displayName || folder.split('/').pop()}
          </span>
          <button
            className={styles.pipelineGenerateBtn}
            onClick={handleGenerate}
            disabled={isGenerating}
            title="Generate / refresh pipeline with AI"
          >
            {isGenerating
              ? <Loader size={14} style={{ animation: 'spinAi 1s linear infinite' }} />
              : <Wand2 size={14} />}
            {isGenerating ? 'Generating…' : 'Generate Pipeline'}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.pipelineBody}>

          {/* Main area */}
          <div className={styles.pipelineMain}>

            {/* Stage track */}
            <div>
              <div className={styles.milestonesSectionTitle}>Stages</div>
              <div className={styles.stageTrack}>
                {RESEARCH_STAGES.map((stage, idx) => {
                  const isDone = idx < currentStageIdx;
                  const isCurrent = stage === meta.project.stage;
                  const isActive = filterStage === stage;
                  const count = milestonesForStage(stage).length;
                  return (
                    <div
                      key={stage}
                      className={`${styles.stageNode} ${isActive ? styles.stageNodeActive : ''} ${isCurrent ? styles.stageNodeCurrent : ''} ${isDone ? styles.stageNodeDone : ''}`}
                      onClick={() => setFilterStage(isActive ? null : stage)}
                      title={`${STAGE_LABELS[stage]}${count > 0 ? ` — ${count} milestone${count !== 1 ? 's' : ''}` : ''}`}
                    >
                      <div className={`${styles.stageDot} ${isDone ? styles.stageDotDone : isCurrent ? styles.stageDotCurrent : styles.stageDotPending}`}>
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div className={`${styles.stageLabel} ${isDone ? styles.stageLabelDone : isCurrent ? styles.stageLabelCurrent : ''}`}>
                        {STAGE_LABELS[stage]}
                      </div>
                      {count > 0 && (
                        <div className={styles.stageMilestoneCount}>{count}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filterStage && (
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Showing stage: <strong style={{ color: 'var(--accent-base)' }}>{STAGE_LABELS[filterStage]}</strong>
                  <button onClick={() => setFilterStage(null)} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.73rem' }}>
                    Clear filter ×
                  </button>
                </div>
              )}
            </div>

            {/* Milestones */}
            <div className={styles.milestonesSection}>
              <div className={styles.milestonesSectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Milestones {visibleMilestones.length > 0 ? `(${visibleMilestones.length})` : ''}</span>
                <button
                  onClick={handleAddMilestone}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--accent-base)', fontSize: '0.7rem', fontWeight: 600
                  }}
                >
                  <Plus size={12} /> Add Milestone
                </button>
              </div>

              {visibleMilestones.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                  {isGenerating
                    ? 'Generating milestones…'
                    : 'No milestones yet. Click "Generate Pipeline" to let the AI create a full milestone roadmap.'}
                </div>
              )}

              {visibleMilestones.map((m) => {
                const goal = goalForMilestone(m.id);
                const isSelected = selectedMilestone?.id === m.id;
                return (
                  <div
                    key={m.id}
                    className={`${styles.milestoneCard} ${isSelected ? styles.milestoneCardSelected : ''}`}
                    onClick={() => setSelectedMilestone(isSelected ? null : m)}
                  >
                    <div className={styles.milestoneCardHeader}>
                      <div
                        className={styles.milestoneStatusDot}
                        style={{ background: STATUS_COLOR[m.status] }}
                        title={m.status}
                      />
                      <div className={styles.milestoneCardTitle}>{m.title}</div>
                      <div className={styles.milestoneCardDue}>{m.dueDate}</div>
                    </div>
                    <div className={styles.milestoneCardDesc}>{m.description}</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className={styles.milestoneStageBadge}>{STAGE_LABELS[m.stage]}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: STATUS_COLOR[m.status] }}>
                        {STATUS_ICON[m.status]} {m.status.replace('_', ' ')}
                      </span>
                      {goal && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          SMART goal attached
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Right sidebar: detail or goals manager */}
          <div className={styles.pipelineSidebar}>
            {selectedMilestone ? (
              <MilestoneDetailPanel
                key={selectedMilestone.id}
                milestone={selectedMilestone}
                goal={goalForMilestone(selectedMilestone.id)}
                folder={folder}
                onClose={() => setSelectedMilestone(null)}
                onSave={handleSaveMilestone}
                onAskMentor={handleAskMentor}
              />
            ) : (
              <div style={{ padding: '14px 16px', flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Select a milestone to view and edit details, or use the panel below to manage publication targets.
                </div>
                {meta.smartGoals.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div className={styles.milestonesSectionTitle}>SMART Goals Summary</div>
                    {meta.smartGoals.map((g) => (
                      <div key={g.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 8px', marginBottom: '4px',
                        background: g.status === 'done' ? 'rgba(16,185,129,0.06)' : 'var(--bg-elevated)',
                        borderRadius: '5px', border: '1px solid var(--border-color)',
                      }}>
                        <input
                          type="checkbox"
                          checked={g.status === 'done'}
                          onChange={(e) => patchItem('goal', g.id, { status: e.target.checked ? 'done' : 'pending' })}
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{
                          fontSize: '0.78rem',
                          color: g.status === 'done' ? 'var(--text-muted)' : 'var(--text-secondary)',
                          textDecoration: g.status === 'done' ? 'line-through' : 'none',
                          flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {g.title}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          P{g.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Publication targets always visible at bottom */}
            <GoalOutputManager
              targets={meta.publicationTargets}
              folder={folder}
              onUpdate={(id, updates) => patchItem('target', id, updates)}
              onDelete={(id) => deleteItem('target', id)}
              onAdd={handleAddTarget}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
