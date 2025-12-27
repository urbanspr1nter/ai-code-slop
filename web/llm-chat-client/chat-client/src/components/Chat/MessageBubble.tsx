import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MessageBubble.css';
import { User, Bot, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    stats?: {
        tokensPerSecond: number;
        totalTokens: number;
        generationTime: number; // in seconds
    };
}

export function MessageBubble({ role, content, stats }: MessageBubbleProps) {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
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
                            // Simple parsing for <think> blocks
                            // Note: This relies on the model outputting <think>...</think>
                            // DeepSeek-R1 / Qwen-Thinking models usually do this.
                            const parts = content.split(/(<think>[\s\S]*?<\/think>)/g);

                            return parts.map((part, index) => {
                                if (part.startsWith('<think>') && part.endsWith('</think>')) {
                                    const thinkingContent = part.replace(/<\/?think>/g, '').trim();
                                    return (
                                        <div key={index} className="thinking-block">
                                            <div className="thinking-header">
                                                <span className="thinking-icon">💭</span>
                                                <span className="thinking-label">Thinking Process</span>
                                            </div>
                                            <div className="thinking-content">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinkingContent}</ReactMarkdown>
                                            </div>
                                        </div>
                                    );
                                }
                                // Render regular markdown
                                if (!part.trim()) return null;
                                return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>;
                            });
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
                        <button
                            className="copy-btn"
                            onClick={handleCopy}
                            title="Copy as Markdown"
                        >
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            <span className="copy-text">{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
