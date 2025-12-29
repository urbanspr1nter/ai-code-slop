import { Send, Square, Paperclip, X } from 'lucide-react';
import './ChatInput.css';
import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
    onSend: (message: string, images?: string[]) => void;
    disabled?: boolean;
    onStop?: () => void;
}

export function ChatInput({ onSend, disabled, focusTrigger, onStop }: ChatInputProps & { focusTrigger?: any }) {
    const [input, setInput] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ... (rest is same) ...
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

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));

            const base64Images = await Promise.all(imageFiles.map(convertFileToBase64));
            setImages(prev => [...prev, ...base64Images]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        if (e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));

            if (imageFiles.length > 0) {
                e.preventDefault();
                const base64Images = await Promise.all(imageFiles.map(convertFileToBase64));
                setImages(prev => [...prev, ...base64Images]);
            }
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        if ((!input.trim() && images.length === 0) || disabled) return;
        onSend(input, images.length > 0 ? images : undefined);
        setInput('');
        setImages([]);
    };

    return (
        <div className="chat-input-container">
            {images.length > 0 && (
                <div className="image-preview-area">
                    {images.map((img, idx) => (
                        <div key={idx} className="image-preview-item">
                            <img src={img} alt="Preview" />
                            <button className="remove-image-btn" onClick={() => removeImage(idx)}>
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="input-wrapper">
                <button
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    title="Attach Image"
                >
                    <Paperclip size={18} />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    multiple
                    hidden
                />
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Send a message..."
                    disabled={disabled}
                />
                <button
                    className={`send-btn ${disabled && onStop ? 'stop-btn' : ''}`}
                    onClick={disabled && onStop ? onStop : handleSubmit}
                    disabled={disabled && !onStop ? true : (!input.trim() && !disabled)}
                    title={disabled && onStop ? "Stop Generation" : "Send Message"}
                >
                    {disabled && onStop ? <Square size={14} fill="currentColor" /> : <Send size={16} />}
                </button>
            </div>
            <div className="footer-text">
                AI Chat can make mistakes. Consider checking important information.
            </div>
        </div>
    );
}
