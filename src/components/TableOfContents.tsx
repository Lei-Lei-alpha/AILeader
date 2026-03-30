import React, { useMemo } from 'react';
import GithubSlugger from 'github-slugger';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import styles from './TableOfContents.module.css';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents({ content }: { content: string }) {
  const headings = useMemo(() => {
    const slugger = new GithubSlugger();
    const regex = /^(#{1,3})\s+(.+)$/gm;
    const items: TOCItem[] = [];
    let match;
    
    // Ignore code blocks briefly to prevent matching `# comments`
    const textWithoutCode = content.replace(/```[\s\S]*?```/g, '');

    while ((match = regex.exec(textWithoutCode)) !== null) {
      const level = match[1].length;
      // We keep the raw matched markdown text so ReactMarkdown can process the math correctly
      const text = match[2].trim(); 
      // Replace markdown links entirely for the ID slug, but keep raw text for render
      const textForSlug = text.replace(/[\[\]]/g, '').replace(/\([^)]+\)/g, '');
      const id = slugger.slug(textForSlug);
      items.push({ id, text, level });
    }
    return items;
  }, [content]);

  if (headings.length === 0) return null;

  return (
    <nav className={styles.toc}>
      <h4>On this page</h4>
      <ul>
        {headings.map((heading, i) => (
          <li 
            key={`${heading.id}-${i}`} 
            style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}
          >
            <a href={`#${heading.id}`}>
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={{ p: ({ children }) => <span style={{display: 'inline'}}>{children}</span> }}
              >
                {heading.text}
              </ReactMarkdown>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
