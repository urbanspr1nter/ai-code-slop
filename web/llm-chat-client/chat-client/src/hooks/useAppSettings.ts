import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '../lib/db';

export interface AppSettings {
    apiUrl: string;
    modelName: string;
    defaultSystemPrompt: string;
    defaultTemperature: number;
    defaultReasoningEffort: 'low' | 'medium' | 'high' | undefined;
}

export function useAppSettings() {
    const [apiUrl, setApiUrl] = useState('http://192.168.1.29:8000/v1');
    const [modelName, setModelName] = useState('Qwen3-4B-Thinking-2507');
    const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('');
    const [defaultTemperature, setDefaultTemperature] = useState(0.7);
    const [defaultReasoningEffort, setDefaultReasoningEffort] = useState<'low' | 'medium' | 'high' | undefined>(undefined);

    const [availableModels, setAvailableModels] = useState<string[]>([]);

    const fetchModels = useCallback(async (urlOverride?: string) => {
        try {
            const currentUrl = urlOverride || apiUrl;
            const url = currentUrl.replace(/\/$/, '') + '/models';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.data && Array.isArray(data.data)) {
                    const loadedModels = data.data.map((m: { id: string }) => m.id);
                    setAvailableModels(loadedModels);

                    // If current model is not in the new list, return the new default to be handled by caller or update state
                    // Note: We won't auto-update modelName here to avoid side-effects during render cycles
                    // unless we do it carefully.
                    return loadedModels;
                }
            }
        } catch (err) {
            console.warn('Failed to fetch models:', err);
        }
        return [];
    }, [apiUrl]);

    // Load settings on mount
    useEffect(() => {
        getSettings().then(loadedSettings => {
            if (loadedSettings) {
                setApiUrl(loadedSettings.apiUrl);
                setModelName(loadedSettings.modelName);

                // Migration: If user has the old default string, clear it
                if (loadedSettings.systemPrompt === "You are a helpful assistant." || loadedSettings.systemPrompt === "You are a helpful assistant") {
                    setDefaultSystemPrompt("");
                } else {
                    setDefaultSystemPrompt(loadedSettings.systemPrompt);
                }

                setDefaultTemperature(loadedSettings.temperature);
                setDefaultReasoningEffort(loadedSettings.reasoningEffort);
            }
        });
    }, []);

    // Refresh models when API URL changes
    useEffect(() => {
        if (apiUrl) fetchModels();
    }, [apiUrl, fetchModels]);

    const updateSettings = async (newSettings: Partial<AppSettings>) => {
        // Update local state
        if (newSettings.apiUrl !== undefined) setApiUrl(newSettings.apiUrl);
        if (newSettings.modelName !== undefined) setModelName(newSettings.modelName);
        if (newSettings.defaultSystemPrompt !== undefined) setDefaultSystemPrompt(newSettings.defaultSystemPrompt);
        if (newSettings.defaultTemperature !== undefined) setDefaultTemperature(newSettings.defaultTemperature);
        if (newSettings.defaultReasoningEffort !== undefined) setDefaultReasoningEffort(newSettings.defaultReasoningEffort);

        // Persist
        await saveSettings({
            apiUrl: newSettings.apiUrl ?? apiUrl,
            modelName: newSettings.modelName ?? modelName,
            systemPrompt: newSettings.defaultSystemPrompt ?? defaultSystemPrompt,
            temperature: newSettings.defaultTemperature ?? defaultTemperature,
            reasoningEffort: newSettings.defaultReasoningEffort ?? defaultReasoningEffort
        });

        // Special handling if API URL changed, refresh models immediately
        if (newSettings.apiUrl && newSettings.apiUrl !== apiUrl) {
            fetchModels(newSettings.apiUrl);
        }
    };

    return {
        apiUrl,
        modelName,
        defaultSystemPrompt,
        defaultTemperature,
        defaultReasoningEffort,
        availableModels,
        updateSettings,
        fetchModels,
        setApiUrl,
        setModelName, // Expose direct setters if needed for granular UI binding, or use updateSettings
        setDefaultSystemPrompt,
        setDefaultTemperature,
        setDefaultReasoningEffort
    };
}
