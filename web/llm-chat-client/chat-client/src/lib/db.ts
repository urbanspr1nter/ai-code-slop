import { openDB } from 'idb';
import type { DBSchema } from 'idb';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    images?: string[];
    stats?: {
        tokensPerSecond: number;
        totalTokens: number;
        generationTime: number;
    };
    siblings?: Message[];
    siblingIndex?: number;
}

interface ChatSession {
    id: string;
    title: string;
    date: Date;
    messages: Message[];
    isFavorite?: boolean;
    systemPrompt?: string;
    temperature?: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
}

const DB_VERSION = 3;

interface ChatDB extends DBSchema {
    sessions: {
        key: string;
        value: ChatSession;
        indexes: { 'by-date': Date };
    };
    settings: {
        key: string;
        value: AppSettings;
    };
}

export interface AppSettings {
    apiUrl: string;
    modelName: string;
    systemPrompt: string;
    temperature: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
    serverEndpoints?: string[]; // List of saved API URLs
    streamingEnabled?: boolean; // Whether to use streaming responses (default true)
}

const DB_NAME = 'ai-chat-db';

export const dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
        // Upgrade logic based on versions
        if (oldVersion < 1) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            store.createIndex('by-date', 'date');
        }
        if (oldVersion < 2) {
            db.createObjectStore('settings');
        }
    },
});

export async function getSession(id: string): Promise<ChatSession | undefined> {
    const db = await dbPromise;
    return db.get('sessions', id);
}

export async function saveSession(session: ChatSession) {
    const db = await dbPromise;
    await db.put('sessions', session);
}

export async function getSessions(): Promise<ChatSession[]> {
    const db = await dbPromise;
    const sessions = await db.getAllFromIndex('sessions', 'by-date');

    // Sort: Favorites first, then Date DESC
    return sessions.sort((a, b) => {
        if (!!a.isFavorite === !!b.isFavorite) {
            // Both fav or both not fav -> sort by date DESC
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        // One is fav -> Fav comes first
        return a.isFavorite ? -1 : 1;
    });
}

export async function toggleFavorite(id: string): Promise<ChatSession | undefined> {
    const db = await dbPromise;
    const session = await db.get('sessions', id);
    if (session) {
        session.isFavorite = !session.isFavorite;
        await db.put('sessions', session);
        return session;
    }
}

export async function deleteSession(id: string) {
    const db = await dbPromise;
    await db.delete('sessions', id);
}

export async function saveSettings(settings: AppSettings) {
    const db = await dbPromise;
    await db.put('settings', settings, 'global');
}

export async function getSettings(): Promise<AppSettings | undefined> {
    const db = await dbPromise;
    return db.get('settings', 'global');
}

export type { ChatSession, Message };
