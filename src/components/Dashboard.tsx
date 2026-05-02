'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  BarChart2,
  Layers,
  Calendar,
  CheckSquare,
  Play,
  Pause,
  RotateCcw,
  Timer,
  RefreshCw,
} from 'lucide-react';
import styles from '@/app/page.module.css';

import type { DashboardTask } from '@/lib/types';

interface DashboardProps {
  folders: string[];
  onClose: () => void;
}

export default function Dashboard({ folders, onClose }: DashboardProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'gantt' | 'calendar' | 'todo'>('gantt');
  const [togglingTasks, setTogglingTasks] = useState<Record<number, boolean>>({});

  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'break'>('focus');
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [isPomodoroActive, setIsPomodoroActive] = useState(false);

  const today = new Date();

  useEffect(() => {
    loadTasks(false);
  }, []);

  useEffect(() => {
    if (!isPomodoroActive) return;
    if (pomodoroTimeLeft === 0) {
      playChime();
      setIsPomodoroActive(false);
      if (pomodoroMode === 'focus') {
        setPomodoroMode('break');
        setPomodoroTimeLeft(5 * 60);
      } else {
        setPomodoroMode('focus');
        setPomodoroTimeLeft(25 * 60);
      }
      return;
    }
    const id = setInterval(() => setPomodoroTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [isPomodoroActive, pomodoroTimeLeft, pomodoroMode]);

  const playChime = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.error('Audio error', e);
    }
  };

  const loadTasks = async (force: boolean) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notes/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders, force }),
      });
      const data = await res.json();
      if (res.ok && data.tasks) setTasks(data.tasks);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (idx: number) => {
    const task = tasks[idx];
    if (!task?.source_folder || !task?.source_file) {
      alert('Missing source reference for this task.');
      return;
    }
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    setTogglingTasks((prev) => ({ ...prev, [idx]: true }));
    try {
      const res = await fetch('/api/notes/toggle_task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_folder: task.source_folder,
          source_file: task.source_file,
          title: task.title,
          new_status: newStatus,
          smartGoalId: task.smartGoalId,
          milestoneId: task.milestoneId,
        }),
      });
      if (res.ok) {
        setTasks((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: newStatus };
          return next;
        });
      } else {
        const data = await res.json();
        alert(`Toggle failed: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingTasks((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div className={styles.dashboardOverlay}>
      <div className={styles.dashboardModal}>
        {/* Header */}
        <div className={styles.dashboardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h2><BarChart2 size={20} /> Global Task Dashboard</h2>
            <button
              onClick={() => loadTasks(true)}
              disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                padding: '6px 12px', borderRadius: '4px', color: 'var(--text-secondary)',
                cursor: isLoading ? 'wait' : 'pointer', fontSize: '0.8rem',
              }}
            >
              <RefreshCw size={14} style={{ animation: isLoading ? 'spinAi 1s linear infinite' : 'none' }} />
              Sync Tasks
            </button>
          </div>
          <button className={styles.iconBtn} onClick={onClose} title="Close Dashboard">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.dashboardBody}>
          <div className={styles.dashboardSidebar}>
            <button
              className={`${styles.dashboardFilterBtn} ${view === 'gantt' ? styles.active : ''}`}
              onClick={() => setView('gantt')}
            >
              <Layers size={16} /> Timeline (Gantt)
            </button>
            <button
              className={`${styles.dashboardFilterBtn} ${view === 'calendar' ? styles.active : ''}`}
              onClick={() => setView('calendar')}
            >
              <Calendar size={16} /> Calendar
            </button>
            <button
              className={`${styles.dashboardFilterBtn} ${view === 'todo' ? styles.active : ''}`}
              onClick={() => setView('todo')}
            >
              <CheckSquare size={16} /> Global To-Do List
            </button>
          </div>

          <div className={styles.dashboardContent}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <div className={styles.aiChatSpinner} style={{ width: 30, height: 30, borderWidth: 3, marginBottom: 15 }} />
                <p>AI is evaluating {folders.length} workspaces...</p>
              </div>
            ) : view === 'gantt' ? (
              <GanttView tasks={tasks} pct={pct} />
            ) : view === 'todo' ? (
              <TodoView
                tasks={tasks}
                togglingTasks={togglingTasks}
                onToggle={handleToggleTask}
                pomodoroMode={pomodoroMode}
                pomodoroTimeLeft={pomodoroTimeLeft}
                isPomodoroActive={isPomodoroActive}
                onSetMode={(mode) => { setIsPomodoroActive(false); setPomodoroMode(mode); setPomodoroTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60); }}
                onTogglePomodoro={() => setIsPomodoroActive((a) => !a)}
                onResetPomodoro={() => { setIsPomodoroActive(false); setPomodoroTimeLeft(pomodoroMode === 'focus' ? 25 * 60 : 5 * 60); }}
              />
            ) : (
              <CalendarView tasks={tasks} today={today} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function GanttView({ tasks, pct }: { tasks: DashboardTask[]; pct: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
          <span>Workspace Progress</span>
          <span>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-base)', transition: 'width 0.3s ease' }} />
        </div>
      </div>
      <div className={styles.ganttContainer} style={{ flex: 1, margin: 0 }}>
        <div className={styles.ganttHeader}>
          <div className={styles.ganttTaskLabel}>Task</div>
          <div className={styles.ganttTimeline}>
            <div className={styles.ganttMonthLabel}>This Month</div>
            <div className={styles.ganttMonthLabel}>Next Month</div>
            <div className={styles.ganttMonthLabel}>Month 3</div>
          </div>
        </div>
        {tasks.map((t, idx) => {
          const s = new Date(t.start || new Date());
          const e = new Date(t.end || new Date(s.getTime() + 7 * 86400000));
          const offset = Math.max(0, (s.getTime() - Date.now()) / 86400000);
          const duration = Math.max(1, (e.getTime() - s.getTime()) / 86400000);
          const left = Math.min(100, (offset / 90) * 100);
          const width = Math.min(100 - left, (duration / 90) * 100);
          const isCritical = t.importance >= 4 && t.urgency >= 4;
          const isDone = t.status === 'done';
          let bg = isCritical ? 'rgba(239,68,68,0.8)' : t.importance >= 3 ? 'rgba(245,158,11,0.8)' : 'rgba(59,130,246,0.8)';
          if (isDone) bg = 'rgba(16,185,129,0.4)';
          return (
            <div key={idx} className={styles.ganttRow}>
              <div className={styles.ganttTaskLabel} style={{ opacity: isDone ? 0.5 : 1 }}>
                <div className={styles.ganttTaskTitle} style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{t.title}</div>
                <div className={styles.ganttTaskProject}>{t.project}</div>
              </div>
              <div className={styles.ganttBarArea}>
                <div className={styles.ganttBar} style={{ left: `${left}%`, width: `${width}%`, background: bg, border: isDone ? '1px dashed rgba(255,255,255,0.5)' : 'none' }}>
                  {isDone ? '✓ Completed' : t.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TodoView({
  tasks, togglingTasks, onToggle,
  pomodoroMode, pomodoroTimeLeft, isPomodoroActive,
  onSetMode, onTogglePomodoro, onResetPomodoro,
}: {
  tasks: DashboardTask[];
  togglingTasks: Record<number, boolean>;
  onToggle: (idx: number) => void;
  pomodoroMode: 'focus' | 'break';
  pomodoroTimeLeft: number;
  isPomodoroActive: boolean;
  onSetMode: (m: 'focus' | 'break') => void;
  onTogglePomodoro: () => void;
  onResetPomodoro: () => void;
}) {
  const mm = Math.floor(pomodoroTimeLeft / 60).toString().padStart(2, '0');
  const ss = (pomodoroTimeLeft % 60).toString().padStart(2, '0');

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
      <div style={{ flex: 1, background: 'rgba(30,30,34,0.4)', borderRadius: '8px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', color: 'var(--text-primary)' }}>Global To-Do List</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
          {tasks.map((t, idx) => {
            const isCritical = t.importance >= 4 && t.urgency >= 4;
            const isDone = t.status === 'done';
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: `3px solid ${isCritical ? '#ef4444' : '#3b82f6'}`, opacity: isDone ? 0.6 : 1 }}>
                <input type="checkbox" checked={isDone} onChange={() => onToggle(idx)} disabled={togglingTasks[idx]} style={{ marginTop: '4px', transform: 'scale(1.2)', cursor: togglingTasks[idx] ? 'wait' : 'pointer' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none' }}>{t.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Project: {t.project} &nbsp;|&nbsp; File: {t.source_file}
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                  S: {t.importance} | U: {t.urgency}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pomodoro */}
      <div style={{ width: '320px', background: 'rgba(30,30,34,0.6)', borderRadius: '8px', padding: '25px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3 style={{ marginTop: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}><Timer size={20} /> Focus Timer</h3>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
          {(['focus', 'break'] as const).map((m) => (
            <button key={m} onClick={() => onSetMode(m)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: pomodoroMode === m ? 'var(--accent-base)' : 'transparent', color: pomodoroMode === m ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>
              {m === 'focus' ? 'Focus (25m)' : 'Break (5m)'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '3.5rem', fontWeight: 700, fontFamily: 'monospace', margin: '30px 0', color: pomodoroMode === 'focus' ? '#ef4444' : '#10b981' }}>
          {mm}:{ss}
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={onTogglePomodoro} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '20px', border: 'none', background: isPomodoroActive ? 'rgba(255,255,255,0.1)' : 'var(--accent-base)', color: 'white', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>
            {isPomodoroActive ? <Pause size={18} /> : <Play size={18} />}
            {isPomodoroActive ? 'Pause' : 'Start'}
          </button>
          <button onClick={onResetPomodoro} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.95rem' }}>
            <RotateCcw size={18} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ tasks, today }: { tasks: DashboardTask[]; today: Date }) {
  return (
    <div className={styles.calendarGrid}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
        <div key={d} className={styles.calendarHeaderDay}>{d}</div>
      ))}
      {Array.from({ length: 35 }).map((_, i) => {
        const cellDate = new Date(today);
        cellDate.setDate(today.getDate() - today.getDay() + i);
        const cellTasks = tasks.filter((t) => {
          const ts = new Date(t.start || today);
          return ts.getDate() === cellDate.getDate() && ts.getMonth() === cellDate.getMonth();
        });
        return (
          <div key={i} className={styles.calendarCell}>
            <div className={styles.calendarDateNum}>{cellDate.getDate()}</div>
            {cellTasks.map((t, idx) => (
              <div key={idx} className={styles.calendarEvent} style={{ background: t.importance >= 4 && t.urgency >= 4 ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)' }}>
                {t.title}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
