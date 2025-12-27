import { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import './MainChat.css';

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
}

export function MainChat({ messages, onSendMessage, isLoading, chatId }: MainChatProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    return (
        <main className="main-chat">
            <div className="messages-scroll-area">
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
                            />
                        ))}
                        {isLoading && (
                            <div className="loading-indicator">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </>
                )}

            </div>
            <div className="input-area-wrapper">
                <ChatInput onSend={onSendMessage} disabled={isLoading} focusTrigger={chatId} />
            </div>
        </main>
    );
}
