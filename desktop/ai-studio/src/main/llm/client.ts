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
  const generationTimeMs = Date.now() - generationStartTime;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? completionTokensFallback;
  const totalTokens = usage?.total_tokens ?? (promptTokens + completionTokens);
  const tokensPerSecond = generationTimeMs > 0 ? (completionTokens / generationTimeMs) * 1000 : 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
    generationTimeMs,
  };
}

const MAX_TOOL_ROUNDS = 10;

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

  // Mutable messages array for tool call loop
  const messages = [...req.messages];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const body: any = {
        model: req.model,
        messages,
        stream: false,  // Use non-streaming for tool call rounds, stream only final
        temperature: req.sampling.temperature ?? 0.7,
        top_p: req.sampling.topP ?? 0.9,
        max_tokens: req.sampling.maxTokens ?? 4096,
      };

      if (req.sampling.topK !== undefined) body.top_k = req.sampling.topK;
      if (req.sampling.repeatPenalty !== undefined) body.repeat_penalty = req.sampling.repeatPenalty;
      if (req.tools && req.tools.length > 0) body.tools = req.tools;

      const isLastRound = round === MAX_TOOL_ROUNDS - 1;

      // Stream on the last possible round or when we expect a text response
      const shouldStream = req.stream && (round > 0 || !req.tools?.length);
      if (shouldStream || isLastRound) {
        body.stream = req.stream;
        if (req.stream) body.stream_options = { include_usage: true };
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: abortController.signal });
      if (!res.ok) {
        const text = await res.text();
        window.webContents.send(channelId, { type: 'error', error: `${res.status}: ${text}` } satisfies StreamChunk);
        return;
      }

      if (body.stream) {
        // Stream the final response
        await streamResponse(res, window, channelId, abortController, generationStartTime, totalTokenCount);
        return;
      }

      // Non-streaming: check for tool calls
      const json = await res.json();
      if (json.usage) lastUsage = json.usage;

      const choice = json.choices?.[0];
      if (!choice) {
        window.webContents.send(channelId, { type: 'error', error: 'No response from model' } satisfies StreamChunk);
        return;
      }

      const toolCalls = choice.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Add assistant message with tool calls
        messages.push(choice.message);

        // Execute each tool call
        for (const tc of toolCalls) {
          const fnName = tc.function?.name;
          let fnArgs: any = {};
          try { fnArgs = JSON.parse(tc.function?.arguments ?? '{}'); } catch {}

          window.webContents.send(channelId, {
            type: 'tool_call',
            toolCall: { id: tc.id, name: fnName, arguments: tc.function?.arguments ?? '{}' },
          } satisfies StreamChunk);

          let result: string;
          try {
            result = await callTool(fnName, fnArgs);
          } catch (err: any) {
            result = `Error: ${err.message}`;
          }

          window.webContents.send(channelId, {
            type: 'tool_result',
            toolResult: { id: tc.id, name: fnName, result },
          } satisfies StreamChunk);

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          });
        }

        // Continue the loop to get the next response
        continue;
      }

      // No tool calls — return the text response
      const content = choice.message?.content ?? '';
      totalTokenCount += content.split(/\s+/).length;
      const stats = buildStats(lastUsage, generationStartTime, totalTokenCount);
      window.webContents.send(channelId, { type: 'delta', content } satisfies StreamChunk);
      window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
      return;
    }

    // Exceeded max rounds
    window.webContents.send(channelId, { type: 'error', error: `Tool call loop exceeded ${MAX_TOOL_ROUNDS} rounds` } satisfies StreamChunk);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const stats = buildStats(lastUsage, generationStartTime, totalTokenCount);
      window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
    } else {
      window.webContents.send(channelId, { type: 'error', error: err.message } satisfies StreamChunk);
    }
  } finally {
    activeStreams.delete(channelId);
  }
}

async function streamResponse(
  res: Response,
  window: BrowserWindow,
  channelId: string,
  abortController: AbortController,
  generationStartTime: number,
  existingTokenCount: number,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) {
    window.webContents.send(channelId, { type: 'error', error: 'No response body' } satisfies StreamChunk);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let tokenCount = existingTokenCount;
  let lastUsage: any = null;

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
          const stats = buildStats(lastUsage, generationStartTime, tokenCount);
          window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.usage) lastUsage = parsed.usage;
          if (parsed.timings) {
            lastUsage = lastUsage ?? {};
            lastUsage.prompt_tokens = lastUsage.prompt_tokens ?? parsed.timings.prompt_n;
            lastUsage.completion_tokens = lastUsage.completion_tokens ?? parsed.timings.predicted_n;
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            tokenCount++;
            window.webContents.send(channelId, { type: 'delta', content: delta } satisfies StreamChunk);
          }
        } catch {
          // skip
        }
      }
    }
    const stats = buildStats(lastUsage, generationStartTime, tokenCount);
    window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const stats = buildStats(lastUsage, generationStartTime, tokenCount);
      window.webContents.send(channelId, { type: 'done', stats } satisfies StreamChunk);
    } else {
      window.webContents.send(channelId, { type: 'error', error: err.message } satisfies StreamChunk);
    }
  }
}
