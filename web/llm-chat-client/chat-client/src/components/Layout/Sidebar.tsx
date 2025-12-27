import { Plus, MessageSquare, Settings, PanelLeftClose, Trash2 } from 'lucide-react';
import './Sidebar.css';

interface ChatSession {
    id: string;
    title: string;
    date: Date;
}

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onOpenSettings: () => void;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
    selectedChatId: string | null;
    chatHistory: ChatSession[];
    isLoading?: boolean;
}

export function Sidebar({
    isOpen,
    onToggle,
    onOpenSettings,
    onNewChat,
    onSelectChat,
    onDeleteChat,
    selectedChatId,
    chatHistory,
    isLoading
}: SidebarProps) {

    // Handler for delete to prevent selecting the chat
    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this chat?")) {
            onDeleteChat(id);
        }
    };

    return (
        <aside className={`sidebar ${isOpen ? 'open' : 'closed'} ${isLoading ? 'generating' : ''}`}>
            <div className="sidebar-header">
                <button
                    className="new-chat-btn"
                    onClick={onNewChat}
                    disabled={isLoading}
                    title={isLoading ? "Please wait for generation to finish" : "New Chat"}
                >
                    <Plus size={16} />
                    <span>New chat</span>
                </button>
                <button className="toggle-btn" onClick={onToggle}>
                    <PanelLeftClose size={20} />
                </button>
            </div>

            <div className="sidebar-content">
                {chatHistory.length > 0 && (
                    <div className="history-group">
                        <div className="history-label">Previous Chats</div>
                        {chatHistory.map(chat => (
                            <div className="history-item-wrapper" key={chat.id}>
                                <button
                                    className={`history-item ${selectedChatId === chat.id ? 'active' : ''}`}
                                    onClick={() => !isLoading && onSelectChat(chat.id)}
                                    disabled={isLoading}
                                    style={{ opacity: isLoading && selectedChatId !== chat.id ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                                >
                                    <MessageSquare size={16} />
                                    <span className="text-truncate">{chat.title}</span>

                                    {!isLoading && (
                                        <div
                                            className="delete-btn"
                                            onClick={(e) => handleDelete(e, chat.id)}
                                            title="Delete Chat"
                                        >
                                            <Trash2 size={14} />
                                        </div>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="sidebar-footer">
                <button className="footer-item" onClick={onOpenSettings}>
                    <Settings size={16} />
                    <span>Settings</span>
                </button>
            </div>
        </aside>
    );
}
