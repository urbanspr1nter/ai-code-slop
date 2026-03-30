import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Endpoints
  listEndpoints: () => ipcRenderer.invoke('endpoints:list'),
  createEndpoint: (name: string, url: string, apiKey?: string) => ipcRenderer.invoke('endpoints:create', name, url, apiKey),
  updateEndpoint: (id: string, name: string, url: string, apiKey?: string) => ipcRenderer.invoke('endpoints:update', id, name, url, apiKey),
  deleteEndpoint: (id: string) => ipcRenderer.invoke('endpoints:delete', id),
  fetchModels: (endpointId: string) => ipcRenderer.invoke('endpoints:models', endpointId),

  // System Prompts
  listSystemPrompts: () => ipcRenderer.invoke('system-prompts:list'),
  createSystemPrompt: (name: string, content: string) => ipcRenderer.invoke('system-prompts:create', name, content),
  updateSystemPrompt: (id: string, name: string, content: string) => ipcRenderer.invoke('system-prompts:update', id, name, content),
  deleteSystemPrompt: (id: string) => ipcRenderer.invoke('system-prompts:delete', id),

  // Sampling Presets
  listSamplingPresets: () => ipcRenderer.invoke('sampling-presets:list'),
  createSamplingPreset: (preset: any) => ipcRenderer.invoke('sampling-presets:create', preset),
  updateSamplingPreset: (id: string, preset: any) => ipcRenderer.invoke('sampling-presets:update', id, preset),
  deleteSamplingPreset: (id: string) => ipcRenderer.invoke('sampling-presets:delete', id),

  // Folders
  listFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (name: string) => ipcRenderer.invoke('folders:create', name),
  updateFolder: (id: string, name: string) => ipcRenderer.invoke('folders:update', id, name),
  deleteFolder: (id: string) => ipcRenderer.invoke('folders:delete', id),
  exportFolderToFile: (folderId: string) => ipcRenderer.invoke('folders:export-file', folderId),

  // Conversations
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  getConversation: (id: string) => ipcRenderer.invoke('conversations:get', id),
  createConversation: (title: string, endpointId: string, modelId: string, systemPromptId?: string, samplingPresetId?: string, folderId?: string) =>
    ipcRenderer.invoke('conversations:create', title, endpointId, modelId, systemPromptId, samplingPresetId, folderId),
  updateConversation: (id: string, updates: any) => ipcRenderer.invoke('conversations:update', id, updates),
  deleteConversation: (id: string) => ipcRenderer.invoke('conversations:delete', id),

  // Messages
  listMessages: (conversationId: string) => ipcRenderer.invoke('messages:list', conversationId),
  createMessage: (conversationId: string, role: string, content: string, attachments?: string) =>
    ipcRenderer.invoke('messages:create', conversationId, role, content, attachments),
  updateMessage: (id: string, content: string) => ipcRenderer.invoke('messages:update', id, content),
  deleteMessage: (id: string) => ipcRenderer.invoke('messages:delete', id),
  deleteMessagesAfter: (conversationId: string, afterCreatedAt: number) =>
    ipcRenderer.invoke('messages:delete-after', conversationId, afterCreatedAt),

  // Chat
  sendChat: (conversationId: string, channelId: string) => ipcRenderer.invoke('chat:send', conversationId, channelId),
  getEffectiveSystemPrompt: (conversationId: string) => ipcRenderer.invoke('chat:system-prompt', conversationId),
  abortChat: (channelId: string) => ipcRenderer.invoke('chat:abort', channelId),
  onStreamChunk: (channelId: string, callback: (chunk: any) => void) => {
    const handler = (_event: any, chunk: any) => callback(chunk);
    ipcRenderer.on(channelId, handler);
    return () => ipcRenderer.removeListener(channelId, handler);
  },

  // MCP
  mcpGetConfig: () => ipcRenderer.invoke('mcp:get-config'),
  mcpSaveConfig: (configJson: string) => ipcRenderer.invoke('mcp:save-config', configJson),
  mcpGetStatus: () => ipcRenderer.invoke('mcp:get-status'),
  mcpGetTools: () => ipcRenderer.invoke('mcp:get-tools'),
  mcpReconnect: () => ipcRenderer.invoke('mcp:reconnect'),

  // Defaults
  getDefaults: () => ipcRenderer.invoke('defaults:get'),
  saveDefaults: (defaults: any) => ipcRenderer.invoke('defaults:save', defaults),

  // Export / Import
  exportDb: () => ipcRenderer.invoke('db:export'),
  exportZip: () => ipcRenderer.invoke('db:export-zip'),
  importDb: () => ipcRenderer.invoke('db:import'),
});
