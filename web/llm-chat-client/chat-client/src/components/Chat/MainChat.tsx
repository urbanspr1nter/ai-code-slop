import { useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
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
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [atBottom, setAtBottom] = useState(true);

    const scrollToBottom = () => {
        virtuosoRef.current?.scrollToIndex({ index: messages.length, align: 'end', behavior: 'smooth' });
    };

    return (
        <main className="main-chat">
            {contextTokens !== undefined && contextTokens > 0 && (
                <div className="context-token-badge">
                    Ctx: {contextTokens.toLocaleString()}
                </div>
            )}

            {messages.length === 0 ? (
                <div className="messages-scroll-area">
                    <div className="empty-state">
                        <h1>AI Chat</h1>
                        <p>Ask anything. I am ready.</p>
                    </div>
                </div>
            ) : (
                <Virtuoso
                    className="messages-scroll-area"
                    ref={virtuosoRef}
                    data={messages}
                    atBottomStateChange={(isAtBottom) => {
                        setAtBottom(isAtBottom);
                        setShowScrollButton(!isAtBottom);
                    }}
                    followOutput={atBottom ? 'smooth' : false}
                    itemContent={(index, msg) => (
                        <MessageBubble
                            key={index}
                            role={msg.role}
                            content={msg.content}
                            stats={msg.stats}
                            isStreaming={isLoading && index === messages.length - 1 && msg.role === 'assistant'}
                            onRegenerate={
                                !isLoading &&
                                    onRegenerate &&
                                    index === messages.length - 1 &&
                                    msg.role === 'assistant'
                                    ? onRegenerate
                                    : undefined
                            }
                            onDelete={
                                !isLoading &&
                                    onDeleteMessage &&
                                    msg.role === 'user' &&
                                    index === messages.length - 1
                                    ? () => onDeleteMessage(index)
                                    : undefined
                            }
                        />
                    )}
                    components={{
                        Footer: () => isLoading ? (
                            <div className="loading-indicator">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        ) : <div style={{ height: 20 }} />
                    }}
                />
            )}

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

