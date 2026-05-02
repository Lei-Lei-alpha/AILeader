import fs from 'fs/promises';
import path from 'path';
import { readProjectMeta } from './projectMeta';
import type { ProgressNotification, ProjectMeta, NotificationType } from './types';

export async function getSystemWideNotifications(folders: string[]): Promise<ProgressNotification[]> {
  const notifications: ProgressNotification[] = [];
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  for (const folder of folders) {
    try {
      const meta = await readProjectMeta(folder);
      if (!meta) continue;

      const projectId = meta.project.id;
      const projectName = meta.project.displayName || path.basename(folder);

      // Check Milestones
      for (const m of meta.milestones) {
        if (m.status === 'completed') continue;
        const dueDate = new Date(m.dueDate);
        if (dueDate <= sevenDaysFromNow) {
          const isOverdue = dueDate < now;
          notifications.push({
            id: `milestone-${m.id}`,
            projectId,
            message: `${isOverdue ? 'OVERDUE' : 'DUE SOON'}: Milestone "${m.title}" in project ${projectName} is due ${m.dueDate}`,
            type: 'milestone_due',
            createdAt: Date.now(),
            read: false,
          });
        }
      }

      // Check SMART Goals
      for (const g of meta.smartGoals) {
        if (g.status === 'done') continue;
        const dueDate = new Date(g.timeBound);
        if (dueDate <= sevenDaysFromNow) {
          const isOverdue = dueDate < now;
          notifications.push({
            id: `goal-${g.id}`,
            projectId,
            message: `${isOverdue ? 'OVERDUE' : 'DUE SOON'}: Goal "${g.title}" in project ${projectName} is due ${g.timeBound}`,
            type: 'goal_completed', // repurposed for deadline
            createdAt: Date.now(),
            read: false,
          });
        }
      }

      // Check Publication Targets
      for (const t of meta.publicationTargets) {
        if (!t.deadline) continue;
        if (['accepted', 'published', 'rejected'].includes(t.status)) continue;
        const dueDate = new Date(t.deadline);
        if (dueDate <= sevenDaysFromNow) {
          const isOverdue = dueDate < now;
          notifications.push({
            id: `target-${t.id}`,
            projectId,
            message: `${isOverdue ? 'OVERDUE' : 'DUE SOON'}: Deadline for ${t.targetVenue} (${t.title}) is ${t.deadline}`,
            type: 'stage_advance', // repurposed for target deadline
            createdAt: Date.now(),
            read: false,
          });
        }
      }
    } catch (e) {
      console.error(`Error scanning notifications for ${folder}:`, e);
    }
  }

  // Sort by date (overdue first)
  return notifications.sort((a, b) => a.message.includes('OVERDUE') ? -1 : 1);
}
