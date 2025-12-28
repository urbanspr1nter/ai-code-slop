import { useRef, useEffect, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import './MainChat.css';
import { ArrowDown } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    stats?: {
        tokensPerSecond: number;
        totalTokens: number;
        generationTime: number;
    };
}

interface MainChatProps {
    messages: Message[];
    onSendMessage: (content: string) => void;
    isLoading?: boolean;
    chatId?: string | null;
    onStop?: () => void;
    onRegenerate?: () => void;
    contextTokens?: number;
    onDeleteMessage?: (index: number) => void;
}

export function MainChat({ messages, onSendMessage, isLoading, chatId, onStop, onRegenerate, contextTokens, onDeleteMessage }: MainChatProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        shouldAutoScrollRef.current = isAtBottom;

        if (!isAtBottom !== showScrollButton) {
            setShowScrollButton(!isAtBottom);
        }
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            shouldAutoScrollRef.current = true;
            setShowScrollButton(false);
        }
    };

    useEffect(() => {
        // Force scroll to bottom when a new message is added or loading starts
        shouldAutoScrollRef.current = true;
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length, isLoading]);

    useEffect(() => {
        // Keep scrolling if lock is active during streaming
        if (shouldAutoScrollRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <main className="main-chat">
            {contextTokens !== undefined && contextTokens > 0 && (
                <div className="context-token-badge">
                    Ctx: {contextTokens.toLocaleString()}
                </div>
            )}
            <div
                className="messages-scroll-area"
                ref={scrollRef}
                onScroll={handleScroll}
            >
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <h1>AI Chat</h1>
                        <p>Ask anything. I am ready.</p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, idx) => (
                            <MessageBubble
                                key={idx}
                                role={msg.role}
                                content={msg.content}
                                stats={msg.stats}
                                isStreaming={isLoading && idx === messages.length - 1 && msg.role === 'assistant'}
                                onRegenerate={
                                    !isLoading &&
                                        onRegenerate &&
                                        idx === messages.length - 1 &&
                                        msg.role === 'assistant'
                                        ? onRegenerate
                                        : undefined
                                }
                                onDelete={
                                    !isLoading &&
                                        onDeleteMessage &&
                                        msg.role === 'user' &&
                                        idx === messages.length - 1
                                        ? () => onDeleteMessage(idx)
                                        : undefined
                                }
                            />
                        ))}
                        {isLoading && (
                            <div className="loading-indicator">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        )}
                    </>
                )}

            </div>
            {showScrollButton && (
                <button
                    className="scroll-bottom-btn"
                    onClick={scrollToBottom}
                    aria-label="Scroll to bottom"
                >
                    <ArrowDown size={20} />
                </button>
            )}
            <div className="input-area-wrapper">
                <ChatInput
                    onSend={onSendMessage}
                    disabled={isLoading}
                    focusTrigger={chatId}
                    onStop={onStop}
                />
            </div>
        </main>
    );
}
