import { X, Save } from 'lucide-react';
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
    onSave: (apiUrl: string, model: string, systemPrompt: string, temperature: number, reasoningEffort?: 'low' | 'medium' | 'high') => void;
}

export function SettingsModal({
    isOpen,
    onClose,
    currentApiUrl,
    currentModel,
    currentSystemPrompt,
    currentTemperature,
    currentReasoningEffort,
    onSave
}: SettingsModalProps) {
    const [apiUrl, setApiUrl] = useState(currentApiUrl);
    const [model, setModel] = useState(currentModel);
    const [systemPrompt, setSystemPrompt] = useState(currentSystemPrompt);
    const [temperature, setTemperature] = useState(currentTemperature);
    const [reasoningEffort, setReasoningEffort] = useState(currentReasoningEffort);

    // Reset local state when modal opens with new props
    useEffect(() => {
        setApiUrl(currentApiUrl);
        setModel(currentModel);
        setSystemPrompt(currentSystemPrompt);
        setTemperature(currentTemperature);
        setReasoningEffort(currentReasoningEffort);
    }, [isOpen, currentApiUrl, currentModel, currentSystemPrompt, currentTemperature, currentReasoningEffort]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(apiUrl, model, systemPrompt, temperature, reasoningEffort);
        onClose();
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
                        <input
                            type="text"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            placeholder="http://localhost:8000/v1"
                        />
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
