import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './MessageBubble.css';
import { User, Bot, Copy, Check, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    stats?: {
        tokensPerSecond: number;
        totalTokens: number;
        generationTime: number; // in seconds
    };
    onRegenerate?: () => void;
}

export function MessageBubble({ role, content, stats, onRegenerate }: MessageBubbleProps) {
    const [isCopied, setIsCopied] = useState(false);
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const markdownComponents = {
        // Override pre to strip the outer container since we handle it in code
        pre: ({ children }: any) => <>{children}</>,
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (!inline && match) {
                return (
                    <div className="code-block-wrapper">
                        <div className="code-block-header">
                            <span className="code-language">{language}</span>
                        </div>
                        <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={language}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0 0 6px 6px' }}
                            {...props}
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    </div>
                );
            } else if (!inline) {
                // Regular code block without language
                return (
                    <pre className="code-block">
                        <code className={className} {...props}>
                            {children}
                        </code>
                    </pre>
                );
            } else {
                // Inline code
                return (
                    <code className={className} {...props}>
                        {children}
                    </code>
                );
            }
        }
    };

    return (
        <div className={`message-row ${role}`}>
            <div className="message-container">
                <div className="avatar">
                    {role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="message-content">
                    <div className="message-header-actions">
                        {/* Optional alignment wrapper if needed, but absolute positioning is easier */}
                    </div>

                    <div className="markdown-body">
                        {(() => {
                            // Robust parsing for <think> blocks:
                            // 1. Explicit </think>: content before is thought (implicit start), content after is answer.
                            // 2. Explicit <think>: content after is thought (streaming).
                            // 3. No tags: content is answer.

                            const closeIdx = content.indexOf('</think>');
                            const openIdx = content.indexOf('<think>');

                            let thought: string | null = null;
                            let answer: string | null = null;

                            if (closeIdx !== -1) {
                                // Found closing tag. Everything before is thought.
                                let rawThought = content.slice(0, closeIdx);
                                // Clean optional start tag if present
                                rawThought = rawThought.replace(/<think>/i, '');
                                thought = rawThought.trim();
                                answer = content.slice(closeIdx + 8); // length of </think>
                            } else if (openIdx !== -1) {
                                // Found open tag, no close. Streaming thought.
                                // Content before <think> is treated as answer (preamble)
                                const before = content.slice(0, openIdx);
                                if (before.trim()) answer = before;

                                thought = content.slice(openIdx + 7).trim(); // length of <think>
                            } else {
                                // No tags. Pure answer.
                                answer = content;
                            }

                            return (
                                <>
                                    {thought && (
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
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={markdownComponents}
                                                    >
                                                        {thought}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {(answer !== null) && (
                                        <div className="answer-content">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={markdownComponents}
                                            >
                                                {answer}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
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
                        <div className="message-actions" style={{ display: 'flex', gap: '8px' }}>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
