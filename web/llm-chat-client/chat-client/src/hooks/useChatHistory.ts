import { useState, useEffect, useCallback } from 'react';
import { getSessions, saveSession, deleteSession, toggleFavorite, type ChatSession } from '../lib/db';

export function useChatHistory() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadSessions = useCallback(async () => {
        setIsLoading(true);
        try {
            const loaded = await getSessions();
            setSessions(loaded);
        } catch (e) {
            console.error("Failed to load sessions", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const addSession = async (session: ChatSession) => {
        await saveSession(session);
        setSessions(prev => [session, ...prev]);
    };

    const updateSession = async (session: ChatSession) => {
        // Optimistic update
        setSessions(prev => prev.map(s => s.id === session.id ? session : s));
        await saveSession(session);
    };

    const removeSession = async (id: string) => {
        await deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
    };

    const renameSession = async (id: string, newTitle: string) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
        // We need to fetch the full object to save it properly if we don't have it fully in memory? 
        // Actually sessions list usually has full objects in this app structure. 
        // But let's be safe and assume we just update the title on the existing object in state.
        const session = sessions.find(s => s.id === id);
        if (session) {
            await saveSession({ ...session, title: newTitle });
        } else {
            // Fallback if not in state?
            const s = await import('../lib/db').then(m => m.getSession(id));
            if (s) await saveSession({ ...s, title: newTitle });
        }
    };

    const toggleSessionFavorite = async (id: string) => {
        setSessions(prev => {
            const next = prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
            return next.sort((a, b) => {
                if (!!a.isFavorite === !!b.isFavorite) {
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                }
                return a.isFavorite ? -1 : 1;
            });
        });
        await toggleFavorite(id);
    };

    const bulkDeleteSessions = async (ids: string[]) => {
        await Promise.all(ids.map(id => deleteSession(id)));
        setSessions(prev => prev.filter(s => !ids.includes(s.id)));
    };

    const importSessions = async (newSessions: ChatSession[]) => {
        for (const s of newSessions) {
            await saveSession(s);
        }
        // Reload or merge? separate reload is safer to ensure sort order
        await loadSessions();
    };

    return {
        sessions,
        isLoadingHistory: isLoading,
        addSession,
        updateSession,
        removeSession,
        renameSession,
        toggleSessionFavorite,
        bulkDeleteSessions,
        importSessions,
        reloadSessions: loadSessions,
        setSessions // Expose for direct manipulation if strictly needed (e.g. optimistic sort), but prefer methods
    };
}
