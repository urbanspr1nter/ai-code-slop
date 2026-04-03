import { Marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import katex from 'katex';

// Pre-process LaTeX before markdown parsing
// Handles: $...$, $$...$$, \(...\), \[...\]
function renderLatex(content: string): string {
  // Display math: $$...$$ or \[...\]
  content = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch { return `<span class="katex-error">$$${tex}$$</span>`; }
  });
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch { return `<span class="katex-error">\\[${tex}\\]</span>`; }
  });

  // Inline math: $...$ (not $$) or \(...\)
  content = content.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch { return `<span class="katex-error">$${tex}$</span>`; }
  });
  content = content.replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch { return `<span class="katex-error">\\(${tex}\\)</span>`; }
  });

  return content;
}

const marked = new Marked({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      // Render LaTeX code blocks
      if (lang === 'math' || lang === 'latex' || lang === 'tex') {
        try {
          return katex.renderToString(text.trim(), { displayMode: true, throwOnError: false });
        } catch { /* fall through to normal code block */ }
      }
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(text, { language }).value;
      return `<div class="code-block"><div class="code-header"><span class="code-lang">${language}</span><button class="copy-btn" data-copy>Copy</button></div><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
    },
  },
  gfm: true,
  breaks: true,
});

export function renderMarkdown(content: string): string {
  // Process LaTeX first, before markdown parsing
  const withLatex = renderLatex(content);
  const raw = marked.parse(withLatex) as string;
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['data-copy'], ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mover', 'munder', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'mtext', 'annotation'] });
}

// Global click delegation for copy buttons
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-copy]') as HTMLButtonElement | null;
    if (!btn) return;
    const block = btn.closest('.code-block');
    const code = block?.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent ?? '').then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
  });
}
