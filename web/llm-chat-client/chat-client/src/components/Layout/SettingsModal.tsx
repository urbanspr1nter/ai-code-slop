import { X, Save, Trash2, Plus } from 'lucide-react';
import './SettingsModal.css';
import { useState, useEffect } from 'react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentApiUrl: string;
    currentModel: string;
    currentSystemPrompt: string;
    currentTemperature: number;
    currentReasoningEffort?: 'low' | 'medium' | 'high';
    currentStreamingEnabled?: boolean;
    savedServers?: string[];
    onSave: (apiUrl: string, model: string, systemPrompt: string, temperature: number, reasoningEffort: 'low' | 'medium' | 'high' | undefined, servers: string[], streamingEnabled: boolean) => void;
}

export function SettingsModal({
    isOpen,
    onClose,
    currentApiUrl,
    currentModel,
    currentSystemPrompt,
    currentTemperature,
    currentReasoningEffort,
    currentStreamingEnabled = true,
    savedServers = [],
    onSave
}: SettingsModalProps) {
    const [apiUrl, setApiUrl] = useState(currentApiUrl);
    const [model, setModel] = useState(currentModel);
    const [systemPrompt, setSystemPrompt] = useState(currentSystemPrompt);
    const [temperature, setTemperature] = useState(currentTemperature);
    const [reasoningEffort, setReasoningEffort] = useState(currentReasoningEffort);
    const [streamingEnabled, setStreamingEnabled] = useState(currentStreamingEnabled);
    const [servers, setServers] = useState<string[]>(savedServers);

    // Reset local state when modal opens with new props
    useEffect(() => {
        setApiUrl(currentApiUrl);
        setModel(currentModel);
        setSystemPrompt(currentSystemPrompt);
        setTemperature(currentTemperature);
        setReasoningEffort(currentReasoningEffort);
        setStreamingEnabled(currentStreamingEnabled);
        setServers(savedServers);
    }, [isOpen, currentApiUrl, currentModel, currentSystemPrompt, currentTemperature, currentReasoningEffort, currentStreamingEnabled, savedServers]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(apiUrl, model, systemPrompt, temperature, reasoningEffort, servers, streamingEnabled);
        onClose();
    };

    const handleAddServer = () => {
        if (apiUrl && !servers.includes(apiUrl)) {
            setServers([...servers, apiUrl]);
        }
    };

    const handleRemoveServer = (server: string) => {
        setServers(servers.filter(s => s !== server));
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>API Endpoint (Base URL)</label>
                        <div className="url-input-group" style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={apiUrl}
                                onChange={(e) => setApiUrl(e.target.value)}
                                placeholder="http://localhost:8000/v1"
                                style={{ flex: 1 }}
                            />
                            <button
                                className="icon-btn"
                                onClick={handleAddServer}
                                title="Save this server to list"
                                style={{ padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        {servers.length > 0 && (
                            <div className="saved-servers" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saved Servers:</label>
                                {servers.map(server => (
                                    <div key={server} className="server-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.9rem' }}>
                                        <span
                                            onClick={() => setApiUrl(server)}
                                            style={{ cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            title="Click to use this server"
                                        >
                                            {server}
                                        </span>
                                        <button
                                            onClick={() => handleRemoveServer(server)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            title="Remove server"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="help-text">
                            The full URL to the completions endpoint will be constructed from this.
                        </p>
                    </div>


                    <div className="form-group">
                        <label>Default System Prompt (for new chats)</label>
                        <textarea
                            rows={3}
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="Enter default system instructions..."
                            className="settings-textarea"
                        />
                    </div>

                    <div className="form-group">
                        <label>Default Temperature: {temperature} (for new chats)</label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        />
                        <div className="slider-labels">
                            <span>Precise (0)</span>
                            <span>Creative (2)</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Default Reasoning Effort (for new chats)</label>
                        <div className="effort-group">
                            <button
                                className={`effort-btn ${!reasoningEffort ? 'active' : ''}`}
                                onClick={() => setReasoningEffort(undefined)}
                                title="Default"
                            >
                                Default
                            </button>
                            {(['low', 'medium', 'high'] as const).map((level) => (
                                <button
                                    key={level}
                                    className={`effort-btn ${reasoningEffort === level ? 'active' : ''}`}
                                    onClick={() => setReasoningEffort(level)}
                                    title={level.charAt(0).toUpperCase() + level.slice(1)}
                                >
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={streamingEnabled}
                                onChange={(e) => setStreamingEnabled(e.target.checked)}
                            />
                            <span>Enable Streaming Responses</span>
                        </label>
                        <p className="help-text">
                            When disabled, responses are returned all at once instead of streaming token by token. Useful for servers that don't support streaming.
                        </p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="save-btn" onClick={handleSave}>
                        <Save size={16} />
                        <span>Save Changes</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
