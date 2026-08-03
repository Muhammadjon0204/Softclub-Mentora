import logoMarkUrl from '../../icons/LogoMark.png';
import logoFullUrl from '../../icons/Logo.optimized.png';

export interface BrandLogoProps {
  /** `full` — знак + название «Mentora» одной картинкой; `mark` — только знак (collapsed sidebar). */
  variant?: 'full' | 'mark';
  className?: string;
  /**
   * По умолчанию `alt="Mentora"`. Передайте `alt=""`, если логотип уже обёрнут
   * в ссылку/кнопку с собственным доступным именем — иначе скринридер
   * озвучит «Mentora» дважды.
   */
  alt?: string;
}

const VARIANT_CLASSES: Record<NonNullable<BrandLogoProps['variant']>, string> = {
  full: 'h-11 w-[180px] object-contain object-left',
  mark: 'h-10 w-10 object-contain object-center',
};

const VARIANT_SRC: Record<NonNullable<BrandLogoProps['variant']>, string> = {
  full: logoFullUrl,
  mark: logoMarkUrl,
};

/**
 * Единственное место, где растеризованный логотип Mentora превращается в
 * `<img>` (раздел 9 задачи ребрендинга) — размеры и `object-fit` не
 * дублируются по потребителям компонента.
 */
export function BrandLogo({ variant = 'full', className = '', alt = 'Mentora' }: BrandLogoProps): JSX.Element {
  return (
    <img
      src={VARIANT_SRC[variant]}
      alt={alt}
      draggable={false}
      className={`${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
