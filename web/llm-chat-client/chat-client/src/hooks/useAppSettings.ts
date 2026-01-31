import { useState, useEffect, useCallback, useRef } from 'react';
import { getSettings, saveSettings } from '../lib/db';

export interface AppSettings {
    apiUrl: string;
    modelName: string;
    defaultSystemPrompt: string;
    defaultTemperature: number;
    defaultReasoningEffort: 'low' | 'medium' | 'high' | undefined;
    serverEndpoints?: string[];
    streamingEnabled?: boolean;
}

export function useAppSettings() {
    const [apiUrl, setApiUrl] = useState('http://192.168.1.29:8000/v1');
    const [modelName, setModelName] = useState('Qwen3-4B-Thinking-2507');
    const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('');
    const [defaultTemperature, setDefaultTemperature] = useState(0.7);
    const [defaultReasoningEffort, setDefaultReasoningEffort] = useState<'low' | 'medium' | 'high' | undefined>(undefined);
    const [serverEndpoints, setServerEndpoints] = useState<string[]>([]);
    const [streamingEnabled, setStreamingEnabled] = useState(true);
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    const fetchIdRef = useRef(0);

    const fetchModels = useCallback(async (urlOverride?: string) => {
        const currentFetchId = ++fetchIdRef.current;
        const currentUrl = urlOverride || apiUrl;

        // Immediately clear models to indicate loading/change, avoiding stale definition
        setAvailableModels([]);

        try {
            const url = currentUrl.replace(/\/$/, '') + '/models';
            const res = await fetch(url);

            // If we have started a new fetch since this one, ignore the result
            if (currentFetchId !== fetchIdRef.current) return [];

            if (res.ok) {
                const data = await res.json();
                if (data.data && Array.isArray(data.data)) {
                    const loadedModels = data.data.map((m: { id: string }) => m.id);
                    setAvailableModels(loadedModels);
                    return loadedModels;
                }
            } else {
                console.warn(`Failed to fetch models: ${res.status}`);
            }
        } catch (err) {
            if (currentFetchId !== fetchIdRef.current) return [];
            console.warn('Failed to fetch models:', err);
            setAvailableModels([]);
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

                // Initialize server endpoints. Use loaded, or default to current API URL if empty/undefined
                const endpoints = loadedSettings.serverEndpoints || [];
                if (endpoints.length === 0 && loadedSettings.apiUrl) {
                    endpoints.push(loadedSettings.apiUrl);
                }
                setServerEndpoints(endpoints);

                // Load streaming preference (default true if not set)
                setStreamingEnabled(loadedSettings.streamingEnabled ?? true);
            } else {
                // If no settings yet, init with default API URL
                setServerEndpoints(['http://192.168.1.29:8000/v1']);
            }
        });
    }, []);

    // Refresh models when API URL changes
    useEffect(() => {
        if (apiUrl) fetchModels();
    }, [apiUrl, fetchModels]);

    // Auto-select first model if current is invalid
    useEffect(() => {
        if (availableModels.length > 0 && !availableModels.includes(modelName)) {
            const newModel = availableModels[0];
            setModelName(newModel);
        }
    }, [availableModels, modelName]);

    const updateSettings = async (newSettings: Partial<AppSettings>) => {
        // Update local state
        if (newSettings.apiUrl !== undefined) setApiUrl(newSettings.apiUrl);
        if (newSettings.modelName !== undefined) setModelName(newSettings.modelName);
        if (newSettings.defaultSystemPrompt !== undefined) setDefaultSystemPrompt(newSettings.defaultSystemPrompt);
        if (newSettings.defaultTemperature !== undefined) setDefaultTemperature(newSettings.defaultTemperature);
        if (newSettings.defaultReasoningEffort !== undefined) setDefaultReasoningEffort(newSettings.defaultReasoningEffort);
        if (newSettings.serverEndpoints !== undefined) setServerEndpoints(newSettings.serverEndpoints);
        if (newSettings.streamingEnabled !== undefined) setStreamingEnabled(newSettings.streamingEnabled);

        // Persist
        await saveSettings({
            apiUrl: newSettings.apiUrl ?? apiUrl,
            modelName: newSettings.modelName ?? modelName,
            systemPrompt: newSettings.defaultSystemPrompt ?? defaultSystemPrompt,
            temperature: newSettings.defaultTemperature ?? defaultTemperature,
            reasoningEffort: newSettings.defaultReasoningEffort ?? defaultReasoningEffort,
            serverEndpoints: newSettings.serverEndpoints ?? serverEndpoints,
            streamingEnabled: newSettings.streamingEnabled ?? streamingEnabled
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
        serverEndpoints,
        streamingEnabled,
        availableModels,
        updateSettings,
        fetchModels,
        setApiUrl,
        setModelName, // Expose direct setters if needed for granular UI binding, or use updateSettings
        setDefaultSystemPrompt,
        setDefaultTemperature,
        setDefaultReasoningEffort,
        setServerEndpoints,
        setStreamingEnabled
    };
}
