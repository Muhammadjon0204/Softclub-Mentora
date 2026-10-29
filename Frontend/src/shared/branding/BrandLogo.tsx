import logoFullDarkUrl from '../../icons/Logo.dark.png';
import logoFullLightUrl from '../../icons/Logo.optimized.png';
import logoMarkUrl from '../../icons/LogoMark.png';
import { useTheme } from '../theme/useTheme';

export interface BrandLogoProps {
  /** `full` — знак + название «RAVAND» одной картинкой; `mark` — только знак (collapsed sidebar). */
  variant?: 'full' | 'mark';
  className?: string;
  /**
   * По умолчанию `alt="RAVAND"`. Передайте `alt=""`, если логотип уже обёрнут
   * в ссылку/кнопку с собственным доступным именем — иначе скринридер
   * озвучит «RAVAND» дважды.
   */
  alt?: string;
}

const VARIANT_CLASSES: Record<NonNullable<BrandLogoProps['variant']>, string> = {
  full: 'h-11 w-[180px] object-contain object-left',
  mark: 'h-10 w-10 object-contain object-center',
};

/**
 * Единственное место, где растеризованный логотип RAVAND превращается в
 * `<img>` — размеры и `object-fit` не дублируются по потребителям компонента.
 *
 * `full` переключает картинку по теме: словесный знак перекрашивается в
 * исходном арте (brand kit, `logo-light.svg`/`logo-dark.svg`) — тёмно-синий
 * на светлом фоне становится почти белым на тёмном, иначе на `data-theme=
 * 'dark'` текст сливался бы с фоном. Сама эмблема (градиентные столбики с
 * галочкой) в обеих версиях одна и та же, поэтому у `mark` второго варианта
 * нет вообще — один файл на обе темы (см. `README.md` бренд-кита).
 */
export function BrandLogo({ variant = 'full', className = '', alt = 'RAVAND' }: BrandLogoProps): JSX.Element {
  const { theme } = useTheme();
  const src = variant === 'mark' ? logoMarkUrl : theme === 'dark' ? logoFullDarkUrl : logoFullLightUrl;

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
