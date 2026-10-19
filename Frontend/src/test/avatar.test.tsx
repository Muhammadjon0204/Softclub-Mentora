import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MAX_ZOOM, clampCrop, displayScale } from '../features/profile/avatarCrop';
import { Avatar } from '../shared/ui/Avatar';

describe('Avatar', () => {
  it('без фото показывает инициалы', () => {
    const { container } = render(<Avatar name="Фарзона Каримова" />);
    expect(container.textContent).toBe('ФК');
    expect(container.querySelector('img')).toBeNull();
  });

  it('с фото кладёт картинку поверх инициалов и проявляет её после загрузки', () => {
    const { container } = render(<Avatar name="Фарзона Каримова" src="/api/v1/avatars/abc.webp" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/api/v1/avatars/abc.webp');
    expect(img?.className).toContain('opacity-0');

    fireEvent.load(img!);
    expect(container.querySelector('img')?.className).toContain('opacity-100');
  });

  it('если фото не открылось — остаются инициалы, без сломанной картинки', () => {
    const { container } = render(<Avatar name="Фарзона Каримова" src="/api/v1/avatars/gone.webp" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('ФК');
  });
});

describe('кадрирование фото', () => {
  const landscape = { width: 1200, height: 800 };
  const viewport = 288;

  it('при масштабе 1 короткая сторона ровно закрывает окно', () => {
    expect(landscape.height * displayScale(landscape, viewport, 1)).toBe(viewport);
  });

  it('не даёт сдвинуть картинку так, чтобы в круге появилась пустота', () => {
    const crop = clampCrop({ x: 10_000, y: -10_000, zoom: 1 }, landscape, viewport);
    const width = landscape.width * displayScale(landscape, viewport, 1);
    expect(crop.x).toBe((width - viewport) / 2);
    // По короткой стороне сдвигать некуда.
    expect(Math.abs(crop.y)).toBe(0);
  });

  it('держит масштаб в пределах', () => {
    expect(clampCrop({ x: 0, y: 0, zoom: 99 }, landscape, viewport).zoom).toBe(MAX_ZOOM);
    expect(clampCrop({ x: 0, y: 0, zoom: 0.1 }, landscape, viewport).zoom).toBe(1);
  });
});
