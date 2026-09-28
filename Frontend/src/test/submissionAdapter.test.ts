import { describe, expect, it } from 'vitest';

import type { SubmissionDto } from '../api/lead/submissions';
import { toSubmissionRecord } from '../features/lead/assignments/assignmentAdapter';

const base = {
  id: 'sub-1',
  assignmentId: 'a-1',
  versionNumber: 1,
  isLate: false,
  submittedById: 'm-1',
  submittedAt: '2026-09-28T10:00:00+00:00',
  hasPreview: false,
};

describe('toSubmissionRecord', () => {
  // The API drops null properties from the body (WhenWritingNull), so a comment-only submission
  // arrives with the file fields missing, not null — this is the exact shape that blanked the page.
  it('comment-only submission with file fields omitted from the JSON does not throw', () => {
    const dto = { ...base, comment: 'Позвонил родителям' } as unknown as SubmissionDto;

    const record = toSubmissionRecord(dto, null);

    expect(record.files).toEqual([]);
    expect(record.comment).toBe('Позвонил родителям');
  });

  it('comment-only submission with explicit null file fields', () => {
    const dto: SubmissionDto = {
      ...base,
      originalFileName: null,
      contentType: null,
      fileExtension: null,
      fileSizeBytes: null,
      sha256Hash: null,
      comment: 'Позвонил родителям',
    };

    expect(toSubmissionRecord(dto, null).files).toEqual([]);
  });

  it('file submission with no comment normalizes the missing comment to null', () => {
    const dto = {
      ...base,
      originalFileName: 'report.pdf',
      contentType: 'application/pdf',
      fileExtension: 'Pdf',
      fileSizeBytes: 2 * 1024 * 1024,
      sha256Hash: 'a'.repeat(64),
      hasPreview: true,
    } as unknown as SubmissionDto;

    const record = toSubmissionRecord(dto, null);

    expect(record.comment).toBeNull();
    expect(record.files).toEqual([{ id: 'sub-1', name: 'report.pdf', extension: 'pdf', sizeLabel: '2.0 МБ' }]);
  });
});
