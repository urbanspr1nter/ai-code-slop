// ---- Endpoints ----
export interface Endpoint {
  id: string;
  name: string;
  url: string;       // e.g. http://192.168.1.100:8080/v1
  apiKey?: string;    // optional, some providers need it
  createdAt: number;
  updatedAt: number;
}

// ---- Models ----
export interface Model {
  id: string;
  name: string;
  endpointId: string;
}

// ---- Folders ----
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

// ---- Conversations ----
export interface Conversation {
  id: string;
  title: string;
  endpointId: string;
  modelId: string;
  systemPromptId?: string;
  samplingPresetId?: string;
  folderId?: string;
  lastStats?: StreamStats;
  lastToolActivity?: { name: string; status: string; arguments?: string; result?: string }[];
  createdAt: number;
  updatedAt: number;
}

// ---- Export Format ----
export interface ExportedMessage {
  role: string;
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
}

export interface ExportedConversation {
  conversationTitle: string;
  messages: ExportedMessage[];
}

// ---- Messages ----
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'tool_call';

export interface MessageAttachment {
  type: 'image';
  mimeType: string;
  base64: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  attachments?: MessageAttachment[];
  toolCallId?: string;
  toolCallName?: string;
  createdAt: number;
}

// ---- System Prompts ----
export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// ---- Sampling Presets ----
export interface SamplingPreset {
  id: string;
  name: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  repeatPenalty: number;
  createdAt: number;
  updatedAt: number;
}

// ---- IPC Channel Types ----
export interface StreamStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokensPerSecond: number;
  generationTimeMs: number;
  ttftMs?: number;
}

export interface StreamChunk {
  type: 'delta' | 'done' | 'error' | 'tool_call' | 'tool_result';
  content?: string;
  error?: string;
  stats?: StreamStats;
  toolCall?: { id: string; name: string; arguments: string };
  toolResult?: { id: string; name: string; result: string };
}

// ---- MCP ----
export interface McpServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
}

export interface McpToolInfo {
  serverName: string;
  name: string;
  description: string;
}
