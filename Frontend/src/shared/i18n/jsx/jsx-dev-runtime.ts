/** Dev-вариант `jsx-runtime.ts` — то же самое поверх `react/jsx-dev-runtime`. */
import type { ElementType, Key, ReactElement } from 'react';
import { Fragment, jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime';

import { localizeProps } from '../catalog';

export { Fragment };

type Source = Parameters<typeof reactJsxDEV>[4];

export function jsxDEV(
  type: ElementType,
  props: unknown,
  key: Key | undefined,
  isStatic: boolean,
  source?: Source,
  self?: unknown,
): ReactElement {
  return reactJsxDEV(type, localizeProps(type, props), key, isStatic, source, self);
}
