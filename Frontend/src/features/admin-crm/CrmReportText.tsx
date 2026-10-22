import { Fragment } from 'react';

/** `**жирный**` внутри строки — единственная разметка, которую понимает отчёт. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>);
}

/**
 * Выводы отчёта: заголовки «### …», абзацы, списки «- …» / «1. …» и **жирный**. Своя крошечная разметка вместо Markdown-библиотеки —
 * текст пишут ИИ и ментор, и HTML из него не должен попасть на страницу никак.
 */
export function CrmReportText({ text }: { text: string }): JSX.Element {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = (): void => {
    if (list.length > 0) {
      blocks.push(
        <ul key={`l${String(blocks.length)}`} className="ml-4 list-disc space-y-0.5 marker:text-ink-muted">
          {list.map((item, index) => <li key={index}>{inline(item)}</li>)}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[2] ?? '');
      continue;
    }

    flush();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(<h4 key={`h${String(blocks.length)}`} className="pt-1 text-[13.5px] font-semibold text-ink first:pt-0">{inline(heading[1] ?? '')}</h4>);
    } else if (line.length > 0) {
      blocks.push(<p key={`p${String(blocks.length)}`}>{inline(line)}</p>);
    }
  }

  flush();
  return <div className="space-y-2 text-[13.5px] leading-6 text-ink-secondary">{blocks}</div>;
}
