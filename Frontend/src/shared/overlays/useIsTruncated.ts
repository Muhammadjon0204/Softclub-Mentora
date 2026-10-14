import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** Показывать tooltip только когда текст реально обрезан (`scrollWidth > clientWidth`). */
export function useIsTruncated(ref: RefObject<HTMLElement>, deps: unknown[] = []): boolean {
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      setIsTruncated(false);
      return;
    }
    setIsTruncated(element.scrollWidth > element.clientWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчитываем по внешним deps вызывающего компонента
  }, deps);

  return isTruncated;
}
