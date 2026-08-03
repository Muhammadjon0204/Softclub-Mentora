import type { FieldValues, Path, UseFormSetError, UseFormSetFocus } from 'react-hook-form';

import { getValidationErrors } from '../../api/problemDetails';

/**
 * Раскладывает `ProblemDetails.errors` по полям формы и переводит фокус
 * на первое поле с ошибкой (WCAG 3.3.1 / 3.3.3).
 *
 * Возвращает `true`, если хоть одна ошибка была привязана к полю — тогда
 * общий блок под формой показывать не нужно.
 */
export function applyServerValidation<TValues extends FieldValues>(
  error: unknown,
  fields: readonly Path<TValues>[],
  setError: UseFormSetError<TValues>,
  setFocus: UseFormSetFocus<TValues>,
): boolean {
  const serverErrors = getValidationErrors(error);
  let firstInvalidField: Path<TValues> | null = null;

  for (const field of fields) {
    const messages = serverErrors[field];
    if (messages === undefined || messages.length === 0) continue;

    setError(field, { type: 'server', message: messages[0] });
    firstInvalidField ??= field;
  }

  if (firstInvalidField !== null) setFocus(firstInvalidField);
  return firstInvalidField !== null;
}
