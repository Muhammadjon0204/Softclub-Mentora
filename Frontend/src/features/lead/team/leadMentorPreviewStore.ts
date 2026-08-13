import { useSyncExternalStore } from 'react';

import { MENTOR_DIRECTORY } from '../scope/leadWorkspace';
import type { MentorDirectoryEntry } from '../scope/leadWorkspace';

/**
 * Тот же приём module-level store + `useSyncExternalStore`, что у Assignment
 * (см. `leadAssignmentPreviewStore.ts`) — применённый к справочнику менторов,
 * чтобы «Добавить ментора» (USER-002/USER-032) отражался в UI немедленно.
 */
let mentors: MentorDirectoryEntry[] = MENTOR_DIRECTORY.map((m) => ({ ...m }));
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): MentorDirectoryEntry[] {
  return mentors;
}

export function useLeadMentorsPreview(): MentorDirectoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Не-реактивный доступ к текущему снимку — для scope-boundary функций вне React-рендера (`leadScopedData.ts`). */
export function getMentorDirectorySnapshot(): MentorDirectoryEntry[] {
  return mentors;
}

export class LeadMentorPreviewError extends Error {}

let nextSeq = mentors.length + 1;

export interface CreateMentorInput {
  categoryId: string;
  branchId: string;
  fullName: string;
  email: string;
}

/**
 * USER-002/USER-032: Lead создаёт Mentor только в своей категории — `role`,
 * `organizationId`, `branchId`, `categoryId` определяются сервером (здесь —
 * фиксированным scope Lead), а не телом формы. Email глобально уникален
 * (`TEN-028`).
 */
export function createMentorPreview(input: CreateMentorInput): MentorDirectoryEntry {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (mentors.some((m) => m.email.toLowerCase() === normalizedEmail)) {
    throw new LeadMentorPreviewError('Пользователь с таким email уже существует');
  }
  const created: MentorDirectoryEntry = {
    id: `usr-lead-new-${String(nextSeq)}`,
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    categoryId: input.categoryId,
    branchId: input.branchId,
    status: 'Invited',
    lastActiveOffsetHours: null,
    createdOffsetDays: 0,
  };
  nextSeq += 1;
  mentors = [created, ...mentors];
  emit();
  return created;
}
