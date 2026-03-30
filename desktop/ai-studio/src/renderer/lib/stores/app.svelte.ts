import type { Conversation, Endpoint, Folder, Message, SamplingPreset, StreamStats, SystemPrompt } from '../../../shared/types';

// Reactive state using Svelte 5 runes
export const appState = $state({
  // Data
  endpoints: [] as Endpoint[],
  conversations: [] as Conversation[],
  messages: [] as Message[],
  systemPrompts: [] as SystemPrompt[],
  samplingPresets: [] as SamplingPreset[],
  folders: [] as Folder[],
  models: [] as { id: string; name: string }[],

  // UI state
  activeConversationId: null as string | null,
  isStreaming: false,
  streamingContent: '',
  streamingConversationId: null as string | null,
  sidebarOpen: true,
  settingsOpen: false,
  rightSidebarOpen: false,
  lastStats: null as StreamStats | null,
  promptProcessing: false,
  promptProcessingStartTime: 0,
  systemPromptVersion: 0,
  mcpToolCount: 0,
  defaults: { endpointId: undefined, systemPromptId: undefined, samplingPresetId: undefined } as { endpointId?: string; systemPromptId?: string; samplingPresetId?: string },
  toasts: [] as { id: number; message: string; type: 'success' | 'error' }[],
});

let toastId = 0;
export function showToast(message: string, type: 'success' | 'error' = 'success') {
  const id = ++toastId;
  appState.toasts = [...appState.toasts, { id, message, type }];
  setTimeout(() => {
    appState.toasts = appState.toasts.filter((t) => t.id !== id);
  }, 2000);
}

export async function loadFolders() {
  appState.folders = await window.api.listFolders();
}

export async function loadMcpToolCount() {
  try {
    const tools = await window.api.mcpGetTools();
    appState.mcpToolCount = tools.length;
  } catch { appState.mcpToolCount = 0; }
}

export async function loadDefaults() {
  appState.defaults = await window.api.getDefaults();
}

export async function loadEndpoints() {
  appState.endpoints = await window.api.listEndpoints();
}

export async function loadConversations() {
  appState.conversations = await window.api.listConversations();
}

export async function loadMessages(conversationId: string) {
  appState.messages = await window.api.listMessages(conversationId);
}

export async function loadSystemPrompts() {
  appState.systemPrompts = await window.api.listSystemPrompts();
}

export async function loadSamplingPresets() {
  appState.samplingPresets = await window.api.listSamplingPresets();
}

export async function loadModels(endpointId: string) {
  try {
    appState.models = await window.api.fetchModels(endpointId);
  } catch (e) {
    console.error('Failed to fetch models:', e);
    appState.models = [];
  }
}

export async function selectConversation(id: string) {
  appState.activeConversationId = id;
  await loadMessages(id);
}

export async function initApp() {
  await Promise.all([
    loadDefaults(),
    loadFolders(),
    loadEndpoints(),
    loadConversations(),
    loadSystemPrompts(),
    loadSamplingPresets(),
    loadMcpToolCount(),
  ]);
}
