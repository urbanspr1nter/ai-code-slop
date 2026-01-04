import type { Message } from './db';

interface StreamOptions {
    apiUrl: string;
    modelName: string;
    messages: Message[];
    systemPrompt?: string;
    temperature?: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
    signal?: AbortSignal;
    onUpdate: (content: string, stats: { tokenCount: number, duration: number, tps: number }) => void;
    onFinish: (content: string, stats: { tokenCount: number, duration: number, tps: number }) => void;
    onError: (error: Error) => void;
}

export async function streamCompletion({
    apiUrl,
    modelName,
    messages,
    systemPrompt,
    temperature,
    reasoningEffort,
    signal,
    onUpdate,
    onFinish,
    onError
}: StreamOptions) {
    try {
        const endpoint = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer none'
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt } as Message] : []),
                    ...messages
                ].map((msg) => {
                    if (msg.role === 'user' && msg.images && msg.images.length > 0) {
                        return {
                            role: 'user',
                            content: [
                                { type: 'text', text: msg.content },
                                ...msg.images.map(img => ({
                                    type: 'image_url',
                                    image_url: { url: img }
                                }))
                            ]
                        };
                    }
                    return { role: msg.role, content: msg.content };
                }),
                temperature: temperature,
                reasoning_effort: reasoningEffort,
                stream: true
            }),
            signal: signal
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body is null");

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        const startTime = Date.now();
        let lastUiUpdate = 0;
        let tokenCount = 0;
        let hasStartedReasoning = false;
        let hasEndedReasoning = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine.startsWith('data: ')) continue;

                const dataStr = trimmedLine.slice(6);
                if (dataStr === '[DONE]') continue;

                try {
                    const data = JSON.parse(dataStr);

                    const deltaContent = data.choices[0]?.delta?.content || '';
                    const deltaReasoning = data.choices[0]?.delta?.reasoning_content || data.choices[0]?.delta?.reasoning || '';

                    if (deltaReasoning) {
                        if (!hasStartedReasoning) {
                            accumulatedContent += "<think>";
                            hasStartedReasoning = true;
                        }
                        accumulatedContent += deltaReasoning;
                    }

                    if (deltaContent) {
                        if (hasStartedReasoning && !hasEndedReasoning) {
                            accumulatedContent += "</think>";
                            hasEndedReasoning = true;
                        }
                        accumulatedContent += deltaContent;
                    }

                    if (deltaContent || deltaReasoning) {
                        tokenCount++;

                        const currentTime = Date.now();
                        // Throttle updates to ~30fps (every 33ms)
                        if (currentTime - lastUiUpdate > 33) {
                            const duration = (currentTime - startTime) / 1000;
                            const tps = duration > 0 ? tokenCount / duration : 0;
                            onUpdate(accumulatedContent, { tokenCount, duration, tps });
                            lastUiUpdate = currentTime;
                        }
                    }
                } catch (e) {
                    console.error("Error parsing stream chunk:", e);
                }
            }
        }

        // Handle case where stream ended inside thought field without explicit end
        if (hasStartedReasoning && !hasEndedReasoning) {
            accumulatedContent += "</think>";
        }

        const finalDuration = (Date.now() - startTime) / 1000;
        const finalTps = finalDuration > 0 ? tokenCount / finalDuration : 0;

        onFinish(accumulatedContent, { tokenCount, duration: finalDuration, tps: finalTps });

    } catch (error) {
        onError(error as Error);
    }
}
