import type { Endpoint, Conversation, Folder, ExportedConversation, Message, SystemPrompt, SamplingPreset, StreamChunk, McpServerStatus, McpToolInfo } from '../shared/types';

declare global {
  interface Window {
    api: {
      listEndpoints(): Promise<Endpoint[]>;
      createEndpoint(name: string, url: string, apiKey?: string): Promise<Endpoint>;
      updateEndpoint(id: string, name: string, url: string, apiKey?: string): Promise<void>;
      deleteEndpoint(id: string): Promise<void>;
      fetchModels(endpointId: string): Promise<{ id: string; name: string }[]>;

      listSystemPrompts(): Promise<SystemPrompt[]>;
      createSystemPrompt(name: string, content: string): Promise<SystemPrompt>;
      updateSystemPrompt(id: string, name: string, content: string): Promise<void>;
      deleteSystemPrompt(id: string): Promise<void>;

      listSamplingPresets(): Promise<SamplingPreset[]>;
      createSamplingPreset(preset: any): Promise<SamplingPreset>;
      updateSamplingPreset(id: string, preset: any): Promise<void>;
      deleteSamplingPreset(id: string): Promise<void>;

      listFolders(): Promise<Folder[]>;
      createFolder(name: string): Promise<Folder>;
      updateFolder(id: string, name: string): Promise<void>;
      deleteFolder(id: string): Promise<void>;
      exportFolderToFile(folderId: string): Promise<boolean>;

      listConversations(): Promise<Conversation[]>;
      getConversation(id: string): Promise<Conversation | undefined>;
      createConversation(title: string, endpointId: string, modelId: string, systemPromptId?: string, samplingPresetId?: string, folderId?: string): Promise<Conversation>;
      updateConversation(id: string, updates: any): Promise<void>;
      deleteConversation(id: string): Promise<void>;
      saveConversationStats(id: string, stats: any): Promise<void>;

      listMessages(conversationId: string): Promise<Message[]>;
      createMessage(conversationId: string, role: string, content: string, attachments?: string, toolCallId?: string, toolCallName?: string): Promise<Message>;
      updateMessage(id: string, content: string): Promise<void>;
      deleteMessage(id: string): Promise<void>;
      deleteMessagesAfter(conversationId: string, afterCreatedAt: number): Promise<void>;

      sendChat(conversationId: string, channelId: string, options?: { agentAddendum?: string; continuePrompt?: string }): Promise<void>;
      getEffectiveSystemPrompt(conversationId: string): Promise<string | null>;
      abortChat(channelId: string): Promise<boolean>;
      onStreamChunk(channelId: string, callback: (chunk: StreamChunk) => void): () => void;

      mcpGetConfig(): Promise<string>;
      mcpSaveConfig(configJson: string): Promise<McpServerStatus[]>;
      mcpGetStatus(): Promise<McpServerStatus[]>;
      mcpGetTools(): Promise<McpToolInfo[]>;
      mcpReconnect(): Promise<McpServerStatus[]>;

      getDefaults(): Promise<{ endpointId?: string; modelId?: string; systemPromptId?: string; samplingPresetId?: string }>;
      saveDefaults(defaults: { endpointId?: string; modelId?: string; systemPromptId?: string; samplingPresetId?: string }): Promise<boolean>;

      exportDb(): Promise<boolean>;
      exportZip(): Promise<boolean>;
      importDb(): Promise<boolean>;
    };
  }
}

export {};
