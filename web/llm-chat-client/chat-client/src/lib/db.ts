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

interface ChatDB extends DBSchema {
    sessions: {
        key: string;
        value: ChatSession;
        indexes: { 'by-date': Date };
    };
}

const DB_NAME = 'ai-chat-db';
const DB_VERSION = 1;

export const dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('by-date', 'date');
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

export type { ChatSession, Message };
