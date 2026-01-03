import { Plus, MessageSquare, Settings, PanelLeftClose, Trash2, Edit2, Star, Download, Upload } from 'lucide-react';
import './Sidebar.css';
import { useState, useEffect } from 'react';

interface ChatSession {
    id: string;
    title: string;
    date: Date;
    isFavorite?: boolean;
}

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onOpenSettings: () => void;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
    onRenameChat: (id: string, newTitle: string) => void;
    onToggleFavorite: (id: string) => void;
    onExportChat: (id: string) => void;
    onImportChat: () => void;
    onExportAllChats: () => void;
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
    onRenameChat,
    onToggleFavorite,
    onExportChat,
    onImportChat,
    onExportAllChats,
    selectedChatId,
    chatHistory,
    isLoading
}: SidebarProps) {
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    // Handler for delete to prevent selecting the chat
    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this chat?")) {
            onDeleteChat(id);
        }
    };

    const startEdit = (e: React.MouseEvent, chat: ChatSession) => {
        e.stopPropagation();
        setEditingChatId(chat.id);
        setEditTitle(chat.title);
    };

    const saveEdit = (id: string) => {
        if (editTitle.trim()) {
            onRenameChat(id, editTitle.trim());
        }
        setEditingChatId(null);
    };

    const cancelEdit = () => {
        setEditingChatId(null);
    };

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('sidebarWidth');
        return saved ? parseInt(saved, 10) : 260;
    });
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 200) newWidth = 200;
            if (newWidth > 600) newWidth = 600;
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                localStorage.setItem('sidebarWidth', sidebarWidth.toString());
            }
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; // Prevent selection while dragging
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, sidebarWidth]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    return (
        <aside
            className={`sidebar ${isOpen ? 'open' : 'closed'} ${isLoading ? 'generating' : ''} ${isResizing ? 'resizing' : ''}`}
            style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
        >
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
                                {editingChatId === chat.id ? (
                                    <div className={`history-item editing ${selectedChatId === chat.id ? 'active' : ''}`}>
                                        <MessageSquare size={16} />
                                        <input
                                            type="text"
                                            className="edit-title-input"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={() => saveEdit(chat.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit(chat.id);
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                ) : (
                                    <button
                                        className={`history-item ${selectedChatId === chat.id ? 'active' : ''}`}
                                        onClick={() => !isLoading && onSelectChat(chat.id)}
                                        disabled={isLoading}
                                        style={{ opacity: isLoading && selectedChatId !== chat.id ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                                    >
                                        {chat.isFavorite ? (
                                            <Star size={16} fill="currentColor" style={{ flexShrink: 0, color: '#fbbf24' }} />
                                        ) : (
                                            <MessageSquare size={16} style={{ flexShrink: 0 }} />
                                        )}
                                        <span className="text-truncate">{chat.title}</span>

                                        {!isLoading && (
                                            <div className="item-actions">
                                                <div
                                                    className="action-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleFavorite(chat.id);
                                                    }}
                                                    title={chat.isFavorite ? "Unfavorite" : "Favorite"}
                                                    style={{ color: chat.isFavorite ? '#fbbf24' : 'inherit' }}
                                                >
                                                    <Star size={14} fill={chat.isFavorite ? "currentColor" : "none"} />
                                                </div>
                                                <div
                                                    className="action-btn edit-btn"
                                                    onClick={(e) => startEdit(e, chat)}
                                                    title="Rename Chat"
                                                >
                                                    <Edit2 size={14} />
                                                </div>
                                                <div
                                                    className="action-btn export-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onExportChat(chat.id);
                                                    }}
                                                    title="Export Chat"
                                                >
                                                    <Download size={14} />
                                                </div>
                                                <div
                                                    className="action-btn delete-btn"
                                                    onClick={(e) => handleDelete(e, chat.id)}
                                                    title="Delete Chat"
                                                >
                                                    <Trash2 size={14} />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                )}
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
                <button className="footer-item" onClick={onImportChat} title="Import Chat">
                    <Upload size={16} />
                    <span>Import</span>
                </button>
                <button className="footer-item" onClick={onExportAllChats} title="Export All Chats">
                    <Download size={16} />
                    <span>Export All</span>
                </button>
            </div>

            {/* Resizer Handle */}
            <div className="sidebar-resizer" onMouseDown={startResizing} />
        </aside>
    );
}
