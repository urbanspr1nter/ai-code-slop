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
    onSave: (apiUrl: string, model: string, systemPrompt: string, temperature: number) => void;
}

export function SettingsModal({
    isOpen,
    onClose,
    currentApiUrl,
    currentModel,
    currentSystemPrompt,
    currentTemperature,
    onSave
}: SettingsModalProps) {
    const [apiUrl, setApiUrl] = useState(currentApiUrl);
    const [model, setModel] = useState(currentModel);
    const [systemPrompt, setSystemPrompt] = useState(currentSystemPrompt);
    const [temperature, setTemperature] = useState(currentTemperature);

    // Reset local state when modal opens with new props
    useEffect(() => {
        setApiUrl(currentApiUrl);
        setModel(currentModel);
        setSystemPrompt(currentSystemPrompt);
        setTemperature(currentTemperature);
    }, [isOpen, currentApiUrl, currentModel, currentSystemPrompt, currentTemperature]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(apiUrl, model, systemPrompt, temperature);
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
                        <label>Model Name</label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="gpt-3.5-turbo"
                        />
                    </div>

                    <div className="form-group">
                        <label>System Prompt</label>
                        <textarea
                            rows={3}
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="You are a helpful assistant."
                            className="settings-textarea"
                        />
                    </div>

                    <div className="form-group">
                        <label>Temperature: {temperature}</label>
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
