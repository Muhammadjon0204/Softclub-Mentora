import { describe, expect, it } from 'vitest';

import { getGenericErrorMessage, getValidationErrors, toProblemDetails } from '../api/problemDetails';

const base = {
  type: 'https://mentortaskflow/errors/category-change-blocked',
  title: 'Conflict',
  status: 409,
  code: 'CATEGORY_CHANGE_BLOCKED',
  detail: 'У пользователя есть незавершённые задачи.',
  instance: '/api/v1/users/1/change-category',
  traceId: 't-1',
};

describe('problem details', () => {
  it('keeps the server message for business errors that carry no field errors', () => {
    expect(toProblemDetails(base)?.code).toBe('CATEGORY_CHANGE_BLOCKED');
    expect(getGenericErrorMessage(base)).toBe('У пользователя есть незавершённые задачи.');
    expect(getValidationErrors(base)).toEqual({});
  });

  it('still reads field errors of a validation failure', () => {
    const validation = { ...base, status: 400, code: 'VALIDATION_FAILED', detail: 'Запрос не прошёл валидацию.', errors: { reason: ['Слишком коротко'] } };
    expect(getValidationErrors(validation)).toEqual({ reason: ['Слишком коротко'] });
  });
});
