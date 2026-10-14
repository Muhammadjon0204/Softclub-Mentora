/** aria-invalid/aria-describedby для control внутри `FormField` — id должен совпадать с `htmlFor`. */
export function fieldA11yProps(id: string, error?: string, hint?: string): { 'aria-invalid'?: boolean; 'aria-describedby'?: string } {
  if (error !== undefined) return { 'aria-invalid': true, 'aria-describedby': `${id}-error` };
  if (hint !== undefined) return { 'aria-describedby': `${id}-hint` };
  return {};
}
