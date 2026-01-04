import { X } from 'lucide-react';
import './ChatControls.css';
import { useEffect, useRef } from 'react';

interface ChatControlsProps {
    isOpen: boolean;
    onClose: () => void;
    systemPrompt: string;
    onSystemPromptChange: (val: string) => void;
    temperature: number;
    onTemperatureChange: (val: number) => void;
    reasoningEffort?: 'low' | 'medium' | 'high';
    onReasoningEffortChange?: (val: 'low' | 'medium' | 'high' | undefined) => void;
    onSave?: () => void;
}

export function ChatControls({
    isOpen,
    onClose,
    systemPrompt,
    onSystemPromptChange,
    temperature,
    onTemperatureChange,
    reasoningEffort,
    onReasoningEffortChange
}: ChatControlsProps) {
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="chat-controls-popup" ref={popupRef}>
            <div className="controls-header">
                <h3>Chat Parameters</h3>
                <button className="close-btn" onClick={onClose}><X size={16} /></button>
            </div>
            <div className="controls-content">
                <div className="control-group">
                    <label>System Prompt</label>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => onSystemPromptChange(e.target.value)}
                        placeholder="Enter system instructions..."
                        rows={4}
                    />
                </div>
                <div className="control-group">
                    <label>Temperature: {temperature}</label>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                    />
                    <div className="temp-labels">
                        <span>Precise</span>
                        <span>Creative</span>
                    </div>
                </div>
                {onReasoningEffortChange && (
                    <div className="control-group">
                        <label>Reasoning Effort</label>
                        <div className="effort-group">
                            <button
                                className={`effort-btn ${!reasoningEffort ? 'active' : ''}`}
                                onClick={() => onReasoningEffortChange(undefined)}
                                title="Default"
                            >
                                Default
                            </button>
                            {(['low', 'medium', 'high'] as const).map((level) => (
                                <button
                                    key={level}
                                    className={`effort-btn ${reasoningEffort === level ? 'active' : ''}`}
                                    onClick={() => onReasoningEffortChange(level)}
                                    title={level.charAt(0).toUpperCase() + level.slice(1)}
                                >
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
