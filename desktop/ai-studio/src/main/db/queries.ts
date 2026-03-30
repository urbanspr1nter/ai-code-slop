import { randomUUID } from 'crypto';
import { safeStorage } from 'electron';
import { getDb } from './schema.js';

function encryptKey(key: string | undefined): string | null {
  if (!key) return null;
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(key).toString('base64');
  }
  return key;
}

function decryptKey(stored: string | null): string | undefined {
  if (!stored) return undefined;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'));
    }
  } catch {
    // Fallback: might be a plaintext key from before encryption was enabled
  }
  return stored;
}
import type {
  Conversation,
  Endpoint,
  ExportedConversation,
  Folder,
  Message,
  SamplingPreset,
  SystemPrompt,
} from '@shared/types.js';

// ---- Folders ----

export function listFolders(): Folder[] {
  return getDb()
    .prepare('SELECT * FROM folders ORDER BY name ASC')
    .all()
    .map(mapFolder);
}

export function createFolder(name: string): Folder {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(id, name, now, now);
  return { id, name, createdAt: now, updatedAt: now };
}

export function updateFolder(id: string, name: string): void {
  getDb()
    .prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
    .run(name, Date.now(), id);
}

export function deleteFolder(id: string): void {
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(id);
}

export function exportFolderConversations(folderId: string): ExportedConversation[] {
  const convs = getDb()
    .prepare('SELECT * FROM conversations WHERE folder_id = ? ORDER BY created_at ASC')
    .all(folderId)
    .map(mapConversation);

  return convs.map((conv) => {
    const msgs = listMessages(conv.id);
    // Include system prompt as first message if present
    const systemPrompt = conv.systemPromptId
      ? getDb().prepare('SELECT content FROM system_prompts WHERE id = ?').get(conv.systemPromptId) as { content: string } | undefined
      : undefined;
    const messages: ExportedConversation['messages'] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt.content });
    }
    for (const msg of msgs) {
      if (msg.attachments && msg.attachments.length > 0) {
        // Multimodal message — OpenAI vision format
        const parts: { type: string; text?: string; image_url?: { url: string } }[] = [];
        for (const att of msg.attachments) {
          if (att.type === 'image') {
            parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.base64}` } });
          }
        }
        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }
        messages.push({ role: msg.role, content: parts });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    return { conversationTitle: conv.title, messages };
  });
}

// ---- Endpoints ----

export function listEndpoints(): Endpoint[] {
  return getDb()
    .prepare('SELECT * FROM endpoints ORDER BY created_at DESC')
    .all()
    .map(mapEndpoint);
}

export function createEndpoint(name: string, url: string, apiKey?: string): Endpoint {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare('INSERT INTO endpoints (id, name, url, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, url, encryptKey(apiKey), now, now);
  return { id, name, url, apiKey, createdAt: now, updatedAt: now };
}

export function updateEndpoint(id: string, name: string, url: string, apiKey?: string): void {
  getDb()
    .prepare('UPDATE endpoints SET name = ?, url = ?, api_key = ?, updated_at = ? WHERE id = ?')
    .run(name, url, encryptKey(apiKey), Date.now(), id);
}

export function deleteEndpoint(id: string): void {
  getDb().prepare('DELETE FROM endpoints WHERE id = ?').run(id);
}

// ---- System Prompts ----

export function listSystemPrompts(): SystemPrompt[] {
  return getDb()
    .prepare('SELECT * FROM system_prompts ORDER BY created_at DESC')
    .all()
    .map(mapSystemPrompt);
}

export function createSystemPrompt(name: string, content: string): SystemPrompt {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare('INSERT INTO system_prompts (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, content, now, now);
  return { id, name, content, createdAt: now, updatedAt: now };
}

export function updateSystemPrompt(id: string, name: string, content: string): void {
  getDb()
    .prepare('UPDATE system_prompts SET name = ?, content = ?, updated_at = ? WHERE id = ?')
    .run(name, content, Date.now(), id);
}

export function deleteSystemPrompt(id: string): void {
  getDb().prepare('DELETE FROM system_prompts WHERE id = ?').run(id);
}

// ---- Sampling Presets ----

export function listSamplingPresets(): SamplingPreset[] {
  return getDb()
    .prepare('SELECT * FROM sampling_presets ORDER BY created_at DESC')
    .all()
    .map(mapSamplingPreset);
}

export function createSamplingPreset(preset: Omit<SamplingPreset, 'id' | 'createdAt' | 'updatedAt'>): SamplingPreset {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      'INSERT INTO sampling_presets (id, name, temperature, top_p, top_k, max_tokens, repeat_penalty, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(id, preset.name, preset.temperature, preset.topP, preset.topK, preset.maxTokens, preset.repeatPenalty, now, now);
  return { id, ...preset, createdAt: now, updatedAt: now };
}

export function updateSamplingPreset(id: string, preset: Omit<SamplingPreset, 'id' | 'createdAt' | 'updatedAt'>): void {
  getDb()
    .prepare(
      'UPDATE sampling_presets SET name = ?, temperature = ?, top_p = ?, top_k = ?, max_tokens = ?, repeat_penalty = ?, updated_at = ? WHERE id = ?'
    )
    .run(preset.name, preset.temperature, preset.topP, preset.topK, preset.maxTokens, preset.repeatPenalty, Date.now(), id);
}

export function deleteSamplingPreset(id: string): void {
  getDb().prepare('DELETE FROM sampling_presets WHERE id = ?').run(id);
}

// ---- Conversations ----

export function listConversations(): Conversation[] {
  return getDb()
    .prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
    .all()
    .map(mapConversation);
}

export function getConversation(id: string): Conversation | undefined {
  const row = getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  return row ? mapConversation(row) : undefined;
}

export function createConversation(
  title: string,
  endpointId: string,
  modelId: string,
  systemPromptId?: string,
  samplingPresetId?: string,
  folderId?: string
): Conversation {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      'INSERT INTO conversations (id, title, endpoint_id, model_id, system_prompt_id, sampling_preset_id, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(id, title, endpointId, modelId, systemPromptId ?? null, samplingPresetId ?? null, folderId ?? null, now, now);
  return { id, title, endpointId, modelId, systemPromptId, samplingPresetId, folderId, createdAt: now, updatedAt: now };
}

export function updateConversation(id: string, updates: Partial<Pick<Conversation, 'title' | 'endpointId' | 'systemPromptId' | 'samplingPresetId' | 'modelId' | 'folderId'>>): void {
  const conv = getConversation(id);
  if (!conv) return;
  const title = updates.title ?? conv.title;
  const endpointId = updates.endpointId ?? conv.endpointId;
  const modelId = updates.modelId ?? conv.modelId;
  const systemPromptId = updates.systemPromptId !== undefined ? updates.systemPromptId : conv.systemPromptId;
  const samplingPresetId = updates.samplingPresetId !== undefined ? updates.samplingPresetId : conv.samplingPresetId;
  const folderId = updates.folderId !== undefined ? updates.folderId : conv.folderId;
  getDb()
    .prepare('UPDATE conversations SET title = ?, endpoint_id = ?, model_id = ?, system_prompt_id = ?, sampling_preset_id = ?, folder_id = ?, updated_at = ? WHERE id = ?')
    .run(title, endpointId, modelId, systemPromptId ?? null, samplingPresetId ?? null, folderId ?? null, Date.now(), id);
}

export function saveConversationStats(id: string, stats: any, toolActivity?: any): void {
  getDb()
    .prepare('UPDATE conversations SET last_stats = ?, last_tool_activity = ? WHERE id = ?')
    .run(JSON.stringify(stats), toolActivity ? JSON.stringify(toolActivity) : null, id);
}

export function deleteConversation(id: string): void {
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

// ---- Messages ----

export function listMessages(conversationId: string): Message[] {
  return getDb()
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId)
    .map(mapMessage);
}

export function createMessage(conversationId: string, role: string, content: string, attachments?: string, toolCallId?: string, toolCallName?: string): Message {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare('INSERT INTO messages (id, conversation_id, role, content, attachments, tool_call_id, tool_call_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, conversationId, role, content, attachments ?? null, toolCallId ?? null, toolCallName ?? null, now);
  getDb().prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
  return { id, conversationId, role: role as Message['role'], content, attachments: attachments ? JSON.parse(attachments) : undefined, toolCallId, toolCallName, createdAt: now };
}

export function updateMessage(id: string, content: string): void {
  getDb().prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, id);
}

export function deleteMessage(id: string): void {
  getDb().prepare('DELETE FROM messages WHERE id = ?').run(id);
}

export function deleteMessagesAfter(conversationId: string, afterCreatedAt: number): void {
  getDb()
    .prepare('DELETE FROM messages WHERE conversation_id = ? AND created_at > ?')
    .run(conversationId, afterCreatedAt);
}

// ---- Export / Import ----

export function exportDatabase(): Buffer {
  return getDb().serialize();
}

export function importDatabase(data: Buffer): void {
  const newDb = new (require('better-sqlite3'))(data);
  // Validate it has our tables
  const tables = newDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
  const required = ['endpoints', 'conversations', 'messages', 'system_prompts', 'sampling_presets'];
  for (const t of required) {
    if (!tables.includes(t)) {
      newDb.close();
      throw new Error(`Invalid database: missing table "${t}"`);
    }
  }
  newDb.close();
  // Overwrite current db file
  const fs = require('fs');
  const dbPath = getDb().name;
  getDb().close();
  fs.writeFileSync(dbPath, data);
  // Force re-open on next getDb() call
  (globalThis as any).__db = undefined;
}

// ---- Row mappers ----

function mapEndpoint(row: any): Endpoint {
  return { id: row.id, name: row.name, url: row.url, apiKey: decryptKey(row.api_key), createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapSystemPrompt(row: any): SystemPrompt {
  return { id: row.id, name: row.name, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapSamplingPreset(row: any): SamplingPreset {
  return {
    id: row.id, name: row.name, temperature: row.temperature, topP: row.top_p, topK: row.top_k,
    maxTokens: row.max_tokens, repeatPenalty: row.repeat_penalty, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapFolder(row: any): Folder {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapConversation(row: any): Conversation {
  let lastStats, lastToolActivity;
  try { lastStats = row.last_stats ? JSON.parse(row.last_stats) : undefined; } catch { lastStats = undefined; }
  try { lastToolActivity = row.last_tool_activity ? JSON.parse(row.last_tool_activity) : undefined; } catch { lastToolActivity = undefined; }
  return {
    id: row.id, title: row.title, endpointId: row.endpoint_id, modelId: row.model_id,
    systemPromptId: row.system_prompt_id, samplingPresetId: row.sampling_preset_id,
    folderId: row.folder_id ?? undefined,
    lastStats, lastToolActivity,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapMessage(row: any): Message {
  return {
    id: row.id, conversationId: row.conversation_id, role: row.role, content: row.content,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
    toolCallId: row.tool_call_id, toolCallName: row.tool_call_name,
    createdAt: row.created_at,
  };
}
