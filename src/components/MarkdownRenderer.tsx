import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import 'highlight.js/styles/atom-one-dark.css';
import 'katex/dist/katex.min.css';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex, rehypeSlug]}
        components={{
          h1: ({node, ...props}) => <h1 style={{ ...styles.h1, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3em' }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ ...styles.h2, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3em' }} {...props} />,
          a: ({node, ...props}) => <a style={{ color: 'var(--accent-base)', textDecoration: 'none' }} {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote style={styles.blockquote} {...props} />
          ),
          table: ({node, ...props}) => (
            <table style={styles.table} {...props} />
          ),
          th: ({node, ...props}) => (
            <th style={styles.th} {...props} />
          ),
          td: ({node, ...props}) => (
            <td style={styles.td} {...props} />
          ),
          img: ({node, ...props}: any) => (
            <img 
              style={styles.img} 
              {...props}
              loading="lazy"
            />
          ),
          code: ({node, inline, className, children, ...props}: any) => {
            return (
              <code style={inline ? styles.inlineCode : undefined} className={className} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const styles = {
  h1: { marginTop: '24px', marginBottom: '16px', fontWeight: 600, fontSize: '2.25em' },
  h2: { marginTop: '24px', marginBottom: '16px', fontWeight: 600, fontSize: '1.75em' },
  blockquote: {
    margin: '1em 0',
    padding: '0 1em',
    color: 'var(--text-secondary)',
    borderLeft: '4px solid var(--accent-base)',
    background: 'rgba(139, 92, 246, 0.05)'
  },
  img: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '4px',
    marginTop: '12px',
    marginBottom: '12px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    display: 'block'
  } as React.CSSProperties,
  inlineCode: {
    background: 'var(--bg-card)',
    padding: '0.2em 0.4em',
    margin: 0,
    fontSize: '85%',
    borderRadius: '3px',
    color: '#cf8a8a',
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
  },
  table: {
    display: 'block',
    width: '100%',
    overflow: 'auto',
    borderSpacing: 0,
    borderCollapse: 'collapse' as const,
    marginBottom: '16px'
  },
  th: {
    padding: '6px 13px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-hover)',
    fontWeight: 600
  },
  td: {
    padding: '6px 13px',
    border: '1px solid var(--border-color)',
  }
};
