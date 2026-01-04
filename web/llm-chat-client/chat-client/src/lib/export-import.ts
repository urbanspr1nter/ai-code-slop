import type { ChatSession } from './db';

// Format for the exported file
interface ExportSession extends Omit<ChatSession, 'messages'> {
    messages: OpenAIMessage[];
}

interface ExportFile {
    version: number;
    type: 'ai-chat-export';
    data: ExportSession | ExportSession[];
}

const EXPORT_VERSION = 1;

// OpenAI Format Interfaces
interface OpenAIMessageContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
}

interface OpenAIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | OpenAIMessageContentPart[];
    name?: string;
    // We allow extra fields (stats, etc) to pass through
    [key: string]: any;
}

// Helper to convert internal Message to OpenAI-compatible format
function toOpenAIFormat(session: ChatSession): ExportSession {
    const messages = session.messages.map(msg => {
        // If no images, return as is (but cast to compatible type)
        if (!msg.images || msg.images.length === 0) {
            const { images, ...rest } = msg;
            return rest as OpenAIMessage;
        }

        // If images exist, convert content to array format
        return {
            role: msg.role,
            content: [
                { type: 'text', text: msg.content },
                ...msg.images.map(img => ({
                    type: 'image_url' as const,
                    image_url: { url: img }
                }))
            ],
            // Preserve stats if needed, or remove
            stats: msg.stats
        } as OpenAIMessage;
    });

    return {
        ...session,
        messages
    };
}

// Helper to convert OpenAI-compatible format back to internal Message
function fromOpenAIFormat(session: any): ChatSession {
    const messages = session.messages.map((msg: OpenAIMessage) => {
        // If content is string, it's standard or legacy internal
        if (typeof msg.content === 'string') {
            return msg;
        }

        // If content is array (OpenAI Multimodal format)
        if (Array.isArray(msg.content)) {
            let textContent = '';
            const images: string[] = [];

            msg.content.forEach((part: OpenAIMessageContentPart) => {
                if (part.type === 'text' && part.text) {
                    textContent += part.text;
                } else if (part.type === 'image_url' && part.image_url) {
                    images.push(part.image_url.url);
                }
            });

            return {
                ...msg,
                content: textContent,
                images: images.length > 0 ? images : undefined
            };
        }

        return msg;
    });

    return {
        ...session,
        messages
    };
}

export function exportChat(session: ChatSession) {
    const exportData: ExportFile = {
        version: EXPORT_VERSION,
        type: 'ai-chat-export',
        data: toOpenAIFormat(session)
    };

    downloadFile(JSON.stringify(exportData, null, 2), `chat-export-${sanitizeFilename(session.title)}.json`);
}

export function exportChats(sessions: ChatSession[]) {
    const exportData: ExportFile = {
        version: EXPORT_VERSION,
        type: 'ai-chat-export',
        data: sessions.map(s => toOpenAIFormat(s))
    };

    downloadFile(JSON.stringify(exportData, null, 2), `bulk-chat-export-${new Date().toISOString().slice(0, 10)}.json`);
}

function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
}

export async function importChats(file: File): Promise<ChatSession[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsed = JSON.parse(content);

                // Basic validation
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('Invalid JSON file');
                }

                let sessions: any[] = [];

                // Check for new wrap format
                if (parsed.type === 'ai-chat-export' && parsed.data) {
                    if (Array.isArray(parsed.data)) {
                        sessions = parsed.data;
                    } else {
                        sessions = [parsed.data];
                    }
                } else if (parsed.messages && Array.isArray(parsed.messages)) {
                    // Raw session dump (legacy)
                    sessions = [parsed];
                } else {
                    throw new Error('Unknown file format');
                }

                // Validate, normalize (from OpenAI format), and hydrate dates
                const validatedSessions = sessions.map(s => {
                    validateSession(s);
                    const internalSession = fromOpenAIFormat(s);
                    internalSession.date = new Date(internalSession.date);
                    return internalSession;
                });

                resolve(validatedSessions);

            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function validateSession(data: any) {
    if (!data.id || !data.title || !data.messages || !Array.isArray(data.messages)) {
        throw new Error('Invalid session structure: missing required fields');
    }
}
