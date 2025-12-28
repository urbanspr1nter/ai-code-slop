import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './MessageBubble.css';
import { User, Bot, Copy, Check, RefreshCw, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';

const CodeBlock = ({ language, children, ...props }: any) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        const text = String(children).replace(/\n$/, '');
        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
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
                {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        </div>
    );
};

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
    const [showRaw, setShowRaw] = useState(false);

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
                    <CodeBlock language={language} {...props}>
                        {children}
                    </CodeBlock>
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
                        {showRaw ? (
                            <pre className="raw-content">{content}</pre>
                        ) : (
                            (() => {
                                // Robust parsing for <think> blocks with case-insensitivity:
                                const openMatch = /<think>/i.exec(content);
                                const closeMatch = /<\/think>/i.exec(content);

                                const openIdx = openMatch ? openMatch.index : -1;
                                const closeIdx = closeMatch ? closeMatch.index : -1;

                                let thought: string | null = null;
                                let answer: string | null = null;

                                if (closeIdx !== -1) {
                                    // Completed thought block (or at least the first one)
                                    if (openIdx !== -1 && openIdx < closeIdx) {
                                        // Standard case: <think>... </think>
                                        const before = content.slice(0, openIdx);
                                        if (before.trim()) answer = before; // Preamble (rare but possible)

                                        thought = content.slice(openIdx + openMatch![0].length, closeIdx).trim();

                                        const after = content.slice(closeIdx + closeMatch![0].length);
                                        if (answer) answer += after;
                                        else answer = after;
                                    } else {
                                        // Implicit start: ... </think>
                                        thought = content.slice(0, closeIdx).replace(/<think>/i, '').trim();
                                        answer = content.slice(closeIdx + closeMatch![0].length);
                                    }
                                } else if (openIdx !== -1) {
                                    // Streaming thought: <think>...
                                    const before = content.slice(0, openIdx);
                                    if (before.trim()) answer = before;

                                    thought = content.slice(openIdx + openMatch![0].length);
                                } else {
                                    // No thinking tags found yet
                                    answer = content;
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
                                                                remarkPlugins={[remarkGfm]}
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
                                                    remarkPlugins={[remarkGfm]}
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
