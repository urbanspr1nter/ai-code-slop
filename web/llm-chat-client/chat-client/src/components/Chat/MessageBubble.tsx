import ReactMarkdown from 'react-markdown';
import { copyToClipboard } from '../../lib/clipboard';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './MessageBubble.css';
import { User, Bot, Copy, Check, RefreshCw, ChevronDown, ChevronRight, ChevronLeft, FileText, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { Message } from '../../lib/db';

const CodeBlock = ({ language, children, ...props }: any) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        const text = String(Array.isArray(children) ? children.join('') : children).replace(/\n$/, '');
        const success = await copyToClipboard(text);
        if (success) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-language">{language}</span>
                <button onClick={handleCopy} className="code-copy-btn" title="Copy code">
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="code-copy-text">{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
            </div>
            <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                customStyle={{ margin: 0, borderRadius: '0 0 6px 6px' }}
                {...props}
            >
                {String(Array.isArray(children) ? children.join('') : children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        </div>
    );
};

interface MessageBubbleProps {
    role: 'user' | 'assistant' | 'system';
    content: string;
    images?: string[];
    onImageClick?: (src: string) => void;
    stats?: {
        tokensPerSecond: number;
        totalTokens: number;
        generationTime: number; // in seconds
    };
    onRegenerate?: () => void;
    isStreaming?: boolean;
    onDelete?: () => void;
    siblings?: Message[];
    siblingIndex?: number;
    onVersionChange?: (index: number) => void;
}

export function MessageBubble({ role, content, images, onImageClick, stats, onRegenerate, isStreaming, onDelete, siblings, siblingIndex, onVersionChange }: MessageBubbleProps) {
    const [isCopied, setIsCopied] = useState(false);
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
    const [showRaw, setShowRaw] = useState(false);

    const handleCopy = async () => {
        const success = await copyToClipboard(content);
        if (success) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const markdownComponents = useMemo(() => ({
        // Override pre to strip the outer container since we handle it in code
        pre: ({ children }: any) => <>{children}</>,
        code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (match) {
                return (
                    <CodeBlock language={language} {...props}>
                        {children}
                    </CodeBlock>
                );
            }

            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        }
    }), []);

    return (
        <div className={`message-row ${role} ${isStreaming ? 'streaming' : ''}`}>
            <div className="message-container">
                <div className="avatar">
                    {role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="message-content">
                    {images && images.length > 0 && (
                        <div className="message-images-grid">
                            {images.map((img, idx) => (
                                <img
                                    key={idx}
                                    src={img}
                                    alt="Uploaded content"
                                    className="message-uploaded-image"
                                    onClick={() => onImageClick?.(img)}
                                    style={onImageClick ? { cursor: 'pointer' } : undefined}
                                />
                            ))}
                        </div>
                    )}
                    <div className="message-header-actions">
                        {/* Optional alignment wrapper if needed, but absolute positioning is easier */}
                    </div>

                    <div className="markdown-body">
                        {showRaw ? (
                            <pre className="raw-content">{content}</pre>
                        ) : (
                            (() => {
                                // Normalize math delimiters for KaTeX
                                // Replace \[ ... \] with $$ ... $$ and \( ... \) with $ ... $
                                const displayContent = content
                                    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
                                    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

                                // Robust parsing for <think> blocks with case-insensitivity:
                                const openMatch = /<think>/i.exec(displayContent);
                                const closeMatch = /<\/think>/i.exec(displayContent);

                                const openIdx = openMatch ? openMatch.index : -1;
                                const closeIdx = closeMatch ? closeMatch.index : -1;

                                let thought: string | null = null;
                                let answer: string | null = null;

                                if (closeIdx !== -1) {
                                    // Completed thought block (or at least the first one)
                                    if (openIdx !== -1 && openIdx < closeIdx) {
                                        // Standard case: <think>... </think>
                                        const before = displayContent.slice(0, openIdx);
                                        if (before.trim()) answer = before; // Preamble (rare but possible)

                                        thought = displayContent.slice(openIdx + openMatch![0].length, closeIdx).trim();

                                        const after = displayContent.slice(closeIdx + closeMatch![0].length);
                                        if (answer) answer += after;
                                        else answer = after;
                                    } else {
                                        // Implicit start: ... </think>
                                        thought = displayContent.slice(0, closeIdx).replace(/<think>/i, '').trim();
                                        answer = displayContent.slice(closeIdx + closeMatch![0].length);
                                    }
                                } else if (openIdx !== -1) {
                                    // Streaming thought: <think>...
                                    const before = displayContent.slice(0, openIdx);
                                    if (before.trim()) answer = before;

                                    thought = displayContent.slice(openIdx + openMatch![0].length);
                                } else {
                                    // No thinking tags found yet
                                    answer = displayContent;
                                }

                                const showPlaceholder = thought !== null && thought.trim().length === 0;

                                return (
                                    <>
                                        {thought !== null && (
                                            <div className="thinking-block">
                                                <div
                                                    className="thinking-header clickable"
                                                    onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                                                    title={isThinkingExpanded ? "Collapse Thought" : "Expand Thought"}
                                                >
                                                    <div className="thinking-title-group">
                                                        <span className="thinking-icon">💭</span>
                                                        <span className="thinking-label">Thinking Process</span>
                                                    </div>
                                                    <div className="thinking-chevron">
                                                        {isThinkingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </div>
                                                </div>
                                                {isThinkingExpanded && (
                                                    <div className="thinking-content">
                                                        {!showPlaceholder ? (
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                                                                rehypePlugins={[rehypeKatex]}
                                                                components={markdownComponents}
                                                            >
                                                                {thought}
                                                            </ReactMarkdown>
                                                        ) : (
                                                            <span className="thinking-placeholder">Thinking...</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {(answer !== null) && (
                                            <div className="answer-content">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                                                    rehypePlugins={[rehypeKatex]}
                                                    components={markdownComponents}
                                                >
                                                    {answer}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                        )}
                    </div>

                    <div className="message-footer">
                        {stats && (
                            <div className="message-stats">
                                <span>{stats.totalTokens} tokens</span>
                                <span className="separator">•</span>
                                <span>{stats.generationTime.toFixed(2)}s</span>
                                <span className="separator">•</span>
                                <span>{stats.tokensPerSecond.toFixed(1)} t/s</span>
                            </div>
                        )}
                        {siblings && siblings.length > 1 && siblingIndex !== undefined && onVersionChange && (
                            <div className="version-controls">
                                <button
                                    onClick={() => onVersionChange(siblingIndex - 1)}
                                    disabled={siblingIndex === 0}
                                    className="version-arrow"
                                    title="Previous Version"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="version-count">
                                    {siblingIndex + 1} / {siblings.length}
                                </span>
                                <button
                                    onClick={() => onVersionChange(siblingIndex + 1)}
                                    disabled={siblingIndex === siblings.length - 1}
                                    className="version-arrow"
                                    title="Next Version"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                        <div className="message-actions" style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="copy-btn"
                                onClick={() => setShowRaw(!showRaw)}
                                title={showRaw ? "Show Rendered" : "Show Raw"}
                            >
                                <FileText size={14} />
                                <span className="copy-text">{showRaw ? 'Rendered' : 'Raw'}</span>
                            </button>
                            <button
                                className="copy-btn"
                                onClick={handleCopy}
                                title="Copy as Markdown"
                            >
                                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                <span className="copy-text">{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                            {onRegenerate && (
                                <button
                                    className="copy-btn"
                                    onClick={onRegenerate}
                                    title="Regenerate Response"
                                >
                                    <RefreshCw size={14} />
                                    <span className="copy-text">Regenerate</span>
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    className="copy-btn"
                                    onClick={onDelete}
                                    title="Delete Message"
                                    style={{ color: '#ef4444' }}
                                >
                                    <Trash2 size={14} />
                                    <span className="copy-text">Delete</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
