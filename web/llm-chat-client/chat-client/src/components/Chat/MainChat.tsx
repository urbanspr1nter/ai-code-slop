import { useRef, useState, useEffect } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import './MainChat.css';
import { ArrowDown, ChevronDown, Check, RefreshCw, PanelLeft, SlidersHorizontal } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { ChatControls } from './ChatControls';
import type { Message } from '../../lib/db';

interface MainChatProps {
    messages: Message[];
    onSendMessage: (content: string, images?: string[]) => void;
    isLoading?: boolean;
    chatId?: string | null;
    onStop?: () => void;
    onRegenerate?: () => void;
    contextTokens?: number;
    onDeleteMessage?: (index: number) => void;
    selectedModel?: string;
    onModelSelect?: (model: string) => void;
    availableModels?: string[];
    onRefreshModels?: () => void;
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    systemPrompt?: string;
    onSystemPromptChange?: (val: string) => void;
    temperature?: number;
    onTemperatureChange?: (val: number) => void;
    reasoningEffort?: 'low' | 'medium' | 'high';
    onReasoningEffortChange?: (val: 'low' | 'medium' | 'high' | undefined) => void;
    onVersionChange?: (messageIndex: number, newVersionIndex: number) => void;
}

export function MainChat({
    messages,
    onSendMessage,
    isLoading,
    chatId,
    onStop,
    onRegenerate,
    contextTokens,
    onDeleteMessage,
    selectedModel,
    onModelSelect,
    availableModels,
    onRefreshModels,
    isSidebarOpen,
    onToggleSidebar,
    systemPrompt = '',
    onSystemPromptChange,
    temperature = 0.7,
    onTemperatureChange,
    reasoningEffort,
    onReasoningEffortChange,
    onVersionChange
}: MainChatProps) {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [atBottom, setAtBottom] = useState(true);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isControlsOpen, setIsControlsOpen] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
                setIsModelMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const scrollToBottom = () => {
        virtuosoRef.current?.scrollToIndex({ index: messages.length, align: 'end', behavior: 'smooth' });
    };

    return (
        <main className="main-chat">
            <header className="chat-header">
                <div className="header-left">
                    {!isSidebarOpen && onToggleSidebar && (
                        <button
                            className="sidebar-toggle-btn"
                            onClick={onToggleSidebar}
                            title="Open Sidebar"
                        >
                            <PanelLeft size={20} />
                        </button>
                    )}
                    <div className="model-selector-wrapper" ref={modelMenuRef}>
                        {availableModels && availableModels.length > 0 ? (
                            <div className="custom-select-container">
                                <button
                                    className={`model-trigger ${isModelMenuOpen ? 'active' : ''}`}
                                    onClick={() => !isLoading && setIsModelMenuOpen(!isModelMenuOpen)}
                                    disabled={isLoading}
                                    title="Select LLM Model"
                                >
                                    <span className="current-model-name">{selectedModel}</span>
                                    <ChevronDown className="select-icon" size={14} />
                                </button>

                                {isModelMenuOpen && (
                                    <div className="model-dropdown-menu">
                                        {availableModels.map(m => (
                                            <button
                                                key={m}
                                                className={`model-option ${m === selectedModel ? 'selected' : ''}`}
                                                onClick={() => {
                                                    onModelSelect?.(m);
                                                    setIsModelMenuOpen(false);
                                                }}
                                            >
                                                {m}
                                                {m === selectedModel && <Check size={14} className="check-icon" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="model-name-static">{selectedModel || 'AI Chat'}</div>
                        )}
                        {onRefreshModels && (
                            <button
                                className="refresh-models-btn"
                                onClick={onRefreshModels}
                                title="Refresh Models"
                                disabled={isLoading}
                            >
                                <RefreshCw size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        className={`chat-controls-toggle ${isControlsOpen ? 'active' : ''}`}
                        onClick={() => setIsControlsOpen(!isControlsOpen)}
                        title="Chat Parameters"
                    >
                        <SlidersHorizontal size={18} />
                    </button>
                </div>


                <div className="header-info-group">
                    <div className="info-pill" title="Temperature">
                        T: {temperature}
                    </div>
                    {reasoningEffort && (
                        <div className="info-pill" title="Reasoning Effort">
                            R: {reasoningEffort}
                        </div>
                    )}
                    {contextTokens !== undefined && contextTokens > 0 && (
                        <div className="info-pill" title="Context Tokens">
                            Ctx: {contextTokens.toLocaleString()}
                        </div>
                    )}
                </div>
            </header>

            <ChatControls
                isOpen={isControlsOpen}
                onClose={() => setIsControlsOpen(false)}
                systemPrompt={systemPrompt}
                onSystemPromptChange={onSystemPromptChange || (() => { })}
                temperature={temperature}
                onTemperatureChange={onTemperatureChange || (() => { })}
                reasoningEffort={reasoningEffort}
                onReasoningEffortChange={onReasoningEffortChange}
            />

            {
                messages.length === 0 ? (
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
                            <div style={{ marginBottom: 24, paddingBottom: 12 }}>
                                <MessageBubble
                                    role={msg.role}
                                    content={msg.content}
                                    images={msg.images}
                                    stats={msg.stats}
                                    onImageClick={(src) => setLightboxImage(src)}
                                    onRegenerate={msg.role === 'assistant' && index === messages.length - 1 && !isLoading ? onRegenerate : undefined}
                                    isStreaming={msg.role === 'assistant' && index === messages.length - 1 && isLoading}
                                    onDelete={onDeleteMessage ? () => onDeleteMessage(index) : undefined}
                                    siblings={msg.siblings}
                                    siblingIndex={msg.siblingIndex}
                                    onVersionChange={onVersionChange ? (idx) => onVersionChange(index, idx) : undefined}
                                />
                            </div>
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
                )
            }

            {
                showScrollButton && (
                    <button
                        className="scroll-bottom-btn"
                        onClick={scrollToBottom}
                        aria-label="Scroll to bottom"
                    >
                        <ArrowDown size={20} />
                    </button>
                )
            }
            <div className="input-area-wrapper">
                <ChatInput
                    onSend={onSendMessage}
                    disabled={isLoading}
                    focusTrigger={chatId}
                    onStop={onStop}
                />
            </div>

            {
                lightboxImage && (
                    <ImageLightbox
                        src={lightboxImage}
                        onClose={() => setLightboxImage(null)}
                    />
                )
            }
        </main >
    );
}

