/**
 * JSX-рантайм приложения: тот же `react/jsx-runtime`, только каждый элемент перед созданием
 * проходит через `localizeProps()` (см. `../catalog.ts`). Подключён в `vite.config.ts`
 * (`jsxImportSource`), поэтому касается только исходников приложения, не `node_modules`.
 */
import type { ElementType, Key, ReactElement } from 'react';
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime';

import { localizeProps } from '../catalog';

export { Fragment };

export function jsx(type: ElementType, props: unknown, key?: Key): ReactElement {
  return reactJsx(type, localizeProps(type, props), key);
}

export function jsxs(type: ElementType, props: unknown, key?: Key): ReactElement {
  return reactJsxs(type, localizeProps(type, props), key);
}
