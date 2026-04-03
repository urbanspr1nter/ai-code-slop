import type { SamplingPreset, StreamChunk, StreamStats } from '@shared/types.js';
import { BrowserWindow } from 'electron';
import { callTool } from '../mcp/manager.js';

export interface ChatRequest {
  endpointUrl: string;
  apiKey?: string;
  model: string;
  messages: { role: string; content: string | any[]; tool_calls?: any[]; tool_call_id?: string }[];
  sampling: Partial<SamplingPreset>;
  stream: boolean;
  tools?: any[];
}

// Active abort controllers keyed by channelId
const activeStreams = new Map<string, AbortController>();

export function abortStream(channelId: string): boolean {
  const controller = activeStreams.get(channelId);
  if (controller) {
    controller.abort();
    activeStreams.delete(channelId);
    return true;
  }
  return false;
}

export async function fetchModels(endpointUrl: string, apiKey?: string): Promise<{ id: string; name: string }[]> {
  const url = `${endpointUrl.replace(/\/+$/, '')}/models`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return (json.data || []).map((m: any) => ({ id: m.id, name: m.id }));
}

function buildStats(usage: any, generationStartTime: number, completionTokensFallback: number): StreamStats {
  const generationTimeMs = Math.max(0, Date.now() - generationStartTime);
  const promptTokens = Math.max(0, usage?.prompt_tokens ?? 0);
  const completionTokens = Math.max(0, usage?.completion_tokens ?? completionTokensFallback);
  const totalTokens = Math.max(0, usage?.total_tokens ?? (promptTokens + completionTokens));
  const tokensPerSecond = generationTimeMs > 0 ? (completionTokens / generationTimeMs) * 1000 : 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSecond: Math.round(Math.max(0, tokensPerSecond) * 10) / 10,
    generationTimeMs,
  };
}

export async function chatCompletion(
  req: ChatRequest,
  window: BrowserWindow,
  channelId: string
): Promise<void> {
  const url = `${req.endpointUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (req.apiKey) headers['Authorization'] = `Bearer ${req.apiKey}`;

  const abortController = new AbortController();
  activeStreams.set(channelId, abortController);

  const generationStartTime = Date.now();
  let totalTokenCount = 0;
  let lastUsage: any = null;

  const messages = [...req.messages];
  const hasTools = req.tools && req.tools.length > 0;

  try {
    let round = 0;
    while (true) {
      const body: any = {
        model: req.model,
        messages,
        stream: true,
        temperature: req.sampling.temperature ?? 1.0,
        top_p: req.sampling.topP ?? 0.9,
        max_tokens: req.sampling.maxTokens ?? 65536,
      };
      if (req.sampling.topK !== undefined) body.top_k = req.sampling.topK;
      if (req.sampling.repeatPenalty !== undefined) body.repeat_penalty = req.sampling.repeatPenalty;
      if (hasTools) body.tools = req.tools;

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: abortController.signal });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[chat] error ${res.status}: ${text.slice(0, 200)}`);
        window.webContents.send(channelId, { type: 'error', error: `${res.status}: ${text}` } satisfies StreamChunk);
        return;
      }

      const result = await readStream(res, window, channelId, abortController, generationStartTime, totalTokenCount);
      if (result.aborted) {
        const stats = buildStats(lastUsage, generationStartTime, totalTokenCount + result.tokenCount);
        window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
        return;
      }
      if (result.usage) lastUsage = result.usage;
      totalTokenCount += result.tokenCount;

      // Filter to only valid tool calls (must have a function name)
      const validToolCalls = result.toolCalls.filter((tc: any) => tc.function?.name);

      if (validToolCalls.length > 0) {
        const cleanedToolCalls = validToolCalls.map((tc: any, i: number) => ({
          id: tc.id || `call_${Date.now()}_${i}`,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function?.arguments ?? '{}',
          },
        }));

        // If the model generated text before/alongside tool calls, send it as a
        // separate "interim" message so it renders between tool traces in the chat
        if (result.content.trim()) {
          window.webContents.send(channelId, { type: 'interim_assistant', content: result.content } satisfies StreamChunk);
        }

        messages.push({ role: 'assistant', content: result.content || null, tool_calls: cleanedToolCalls });

        for (const tc of cleanedToolCalls) {
          const fnName = tc.function.name;
          let fnArgs: any = {};
          try { fnArgs = JSON.parse(tc.function.arguments); } catch {}

          window.webContents.send(channelId, {
            type: 'tool_call',
            toolCall: { id: tc.id, name: fnName, arguments: tc.function.arguments },
          } satisfies StreamChunk);

          let toolResult: string;
          try {
            toolResult = await callTool(fnName, fnArgs);
          } catch (err: any) {
            toolResult = `Error: ${err.message}`;
          }

          window.webContents.send(channelId, {
            type: 'tool_result',
            toolResult: { id: tc.id, name: fnName, result: toolResult },
          } satisfies StreamChunk);

          messages.push({ role: 'tool', content: toolResult, tool_call_id: tc.id });
        }

        // Continue to next round
        round++;
        continue;
      }

      // No tool calls — we're done. Content was already streamed.
      const stats = buildStats(lastUsage, generationStartTime, totalTokenCount);
      window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
      return;
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message === 'terminated' || err.message === 'The operation was aborted') {
      const stats = buildStats(lastUsage, generationStartTime, totalTokenCount);
      window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
    } else {
      window.webContents.send(channelId, { type: 'error', error: err.message } satisfies StreamChunk);
    }
  } finally {
    activeStreams.delete(channelId);
  }
}

interface StreamResult {
  content: string;
  toolCalls: any[];
  tokenCount: number;
  usage: any;
  aborted: boolean;
}

async function readStream(
  res: Response,
  window: BrowserWindow,
  channelId: string,
  abortController: AbortController,
  generationStartTime: number,
  existingTokenCount: number,
): Promise<StreamResult> {
  const reader = res.body?.getReader();
  if (!reader) {
    window.webContents.send(channelId, { type: 'error', error: 'No response body' } satisfies StreamChunk);
    return { content: '', toolCalls: [], tokenCount: 0, usage: null, aborted: false };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let tokenCount = 0;
  let content = '';
  let usage: any = null;
  const toolCalls: Map<number, { id: string; function: { name: string; arguments: string } }> = new Map();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          return { content, toolCalls: [...toolCalls.values()], tokenCount, usage, aborted: false };
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.usage) usage = parsed.usage;
          if (parsed.timings) {
            usage = usage ?? {};
            usage.prompt_tokens = usage.prompt_tokens ?? parsed.timings.prompt_n;
            usage.completion_tokens = usage.completion_tokens ?? parsed.timings.predicted_n;
          }

          const choice = parsed.choices?.[0];
          if (!choice) continue;

          // Content delta
          const delta = choice.delta?.content;
          if (delta) {
            content += delta;
            tokenCount++;
            window.webContents.send(channelId, { type: 'delta', content: delta } satisfies StreamChunk);
          }

          // Tool call deltas (streamed incrementally)
          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id ?? '', function: { name: '', arguments: '' } });
              }
              const existing = toolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
    return { content, toolCalls: [...toolCalls.values()], tokenCount, usage, aborted: false };
  } catch (err: any) {
    console.error(`[readStream] error: name=${err.name} message=${err.message} contentSoFar=${content.length}chars tokensSoFar=${tokenCount}`);
    if (err.name === 'AbortError' || err.message === 'terminated' || err.message === 'The operation was aborted') {
      return { content, toolCalls: [], tokenCount, usage, aborted: true };
    }
    throw err;
  }
}
