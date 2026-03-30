import { Marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

const marked = new Marked({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(text, { language }).value;
      return `<div class="code-block"><div class="code-header"><span class="code-lang">${language}</span><button class="copy-btn" data-copy>Copy</button></div><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
    },
  },
  gfm: true,
  breaks: true,
});

export function renderMarkdown(content: string): string {
  const raw = marked.parse(content) as string;
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['data-copy'] });
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
