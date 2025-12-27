import { Send } from 'lucide-react';
import './ChatInput.css';
import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled, focusTrigger }: ChatInputProps & { focusTrigger?: any }) {
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Focus on trigger change (e.g. chat switch)
    useEffect(() => {
        if (!disabled && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [focusTrigger, disabled]); // Also focus when re-enabled

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        autoResize();
    };

    const autoResize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset to calculate
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    // Reset height when input clears
    useEffect(() => {
        if (input === '') {
            if (textareaRef.current) textareaRef.current.style.height = '24px'; // Default single line
        }
    }, [input]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        if (!input.trim() || disabled) return;
        onSend(input);
        setInput('');
    };

    return (
        <div className="chat-input-container">
            <div className="input-wrapper">
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Send a message..."
                    disabled={disabled}
                />
                <button
                    className="send-btn"
                    onClick={handleSubmit}
                    disabled={!input.trim() || disabled}
                >
                    <Send size={16} />
                </button>
            </div>
            <div className="footer-text">
                AI Chat can make mistakes. Consider checking important information.
            </div>
        </div>
    );
}
