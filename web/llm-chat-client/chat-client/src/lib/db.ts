import { openDB } from 'idb';
import type { DBSchema } from 'idb';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    stats?: {
        tokensPerSecond: number;
        totalTokens: number;
        generationTime: number;
    };
}

interface ChatSession {
    id: string;
    title: string;
    date: Date;
    messages: Message[];
}

const DB_VERSION = 2;

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
    // Get all sessions and sort by date descending
    const sessions = await db.getAllFromIndex('sessions', 'by-date');
    return sessions.reverse();
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
