import { Fragment, type ReactNode } from 'react';

const tokenPattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|<u>[\s\S]+?<\/u>|<small>[\s\S]+?<\/small>|<big>[\s\S]+?<\/big>)/g;

const renderInline = (value: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(value.slice(cursor, start));

    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith('***')) {
      nodes.push(<strong key={key}><em>{renderInline(token.slice(3, -3), key)}</em></strong>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith('<u>')) {
      nodes.push(<span className="feature-text-underline" key={key}>{renderInline(token.slice(3, -4), key)}</span>);
    } else if (token.startsWith('<small>')) {
      nodes.push(<span className="feature-text-small" key={key}>{renderInline(token.slice(7, -8), key)}</span>);
    } else {
      nodes.push(<span className="feature-text-large" key={key}>{renderInline(token.slice(5, -6), key)}</span>);
    }

    cursor = start + token.length;
    index += 1;
  }

  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
};

export function FeatureRichText({ value, className = '' }: { value: string; className?: string }) {
  const paragraphs = value.trim().split(/\n\s*\n/);
  return (
    <div className={`feature-rich-text ${className}`.trim()}>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={`${paragraphIndex}-${paragraph.slice(0, 24)}`}>
          {paragraph.split('\n').map((line, lineIndex) => (
            <Fragment key={`${lineIndex}-${line.slice(0, 16)}`}>
              {lineIndex > 0 && <br />}
              {renderInline(line, `${paragraphIndex}-${lineIndex}`)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
