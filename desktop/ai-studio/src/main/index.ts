import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { getDb, closeDb } from './db/schema.js';
import * as queries from './db/queries.js';
import { chatCompletion, fetchModels, abortStream } from './llm/client.js';
import * as mcp from './mcp/manager.js';

let mainWindow: BrowserWindow | null = null;

// ---- Defaults ----
interface AppDefaults {
  endpointId?: string;
  systemPromptId?: string;
  samplingPresetId?: string;
}

function getDefaultsPath(): string {
  return path.join(app.getPath('userData'), 'defaults.json');
}

function loadDefaults(): AppDefaults {
  const p = getDefaultsPath();
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}

function saveDefaults(defaults: AppDefaults): void {
  fs.writeFileSync(getDefaultsPath(), JSON.stringify(defaults, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AI Studio',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Security: prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devServer = process.env.VITE_DEV_SERVER_URL;
    if (devServer && url.startsWith(devServer)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
    // Open external URLs in the system browser
    import('electron').then(({ shell }) => shell.openExternal(url));
  });

  // Security: deny new window creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  getDb();

  // Connect MCP servers before window loads so tools are ready
  try {
    await mcp.connectAll();
  } catch (err: any) {
    console.error('MCP startup error:', err.message);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await mcp.disconnectAll();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC Handlers ----

// Endpoints
ipcMain.handle('endpoints:list', () => queries.listEndpoints());
ipcMain.handle('endpoints:create', (_, name, url, apiKey) => queries.createEndpoint(name, url, apiKey));
ipcMain.handle('endpoints:update', (_, id, name, url, apiKey) => queries.updateEndpoint(id, name, url, apiKey));
ipcMain.handle('endpoints:delete', (_, id) => queries.deleteEndpoint(id));
ipcMain.handle('endpoints:models', async (_, endpointId) => {
  const endpoint = queries.listEndpoints().find((e) => e.id === endpointId);
  if (!endpoint) throw new Error('Endpoint not found');
  return fetchModels(endpoint.url, endpoint.apiKey);
});

// System Prompts
ipcMain.handle('system-prompts:list', () => queries.listSystemPrompts());
ipcMain.handle('system-prompts:create', (_, name, content) => queries.createSystemPrompt(name, content));
ipcMain.handle('system-prompts:update', (_, id, name, content) => queries.updateSystemPrompt(id, name, content));
ipcMain.handle('system-prompts:delete', (_, id) => queries.deleteSystemPrompt(id));

// Sampling Presets
ipcMain.handle('sampling-presets:list', () => queries.listSamplingPresets());
ipcMain.handle('sampling-presets:create', (_, preset) => queries.createSamplingPreset(preset));
ipcMain.handle('sampling-presets:update', (_, id, preset) => queries.updateSamplingPreset(id, preset));
ipcMain.handle('sampling-presets:delete', (_, id) => queries.deleteSamplingPreset(id));

// Conversations
ipcMain.handle('conversations:list', () => queries.listConversations());
ipcMain.handle('conversations:get', (_, id) => queries.getConversation(id));
ipcMain.handle('conversations:create', (_, title, endpointId, modelId, systemPromptId, samplingPresetId, folderId) =>
  queries.createConversation(title, endpointId, modelId, systemPromptId, samplingPresetId, folderId)
);
ipcMain.handle('conversations:update', (_, id, updates) => queries.updateConversation(id, updates));
ipcMain.handle('conversations:delete', (_, id) => queries.deleteConversation(id));

// Folders
ipcMain.handle('folders:list', () => queries.listFolders());
ipcMain.handle('folders:create', (_, name) => queries.createFolder(name));
ipcMain.handle('folders:update', (_, id, name) => queries.updateFolder(id, name));
ipcMain.handle('folders:delete', (_, id) => queries.deleteFolder(id));
ipcMain.handle('folders:export', (_, folderId) => queries.exportFolderConversations(folderId));
ipcMain.handle('folders:export-file', async (_, folderId) => {
  const data = queries.exportFolderConversations(folderId);
  const folder = queries.listFolders().find((f) => f.id === folderId);
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Folder Conversations',
    defaultPath: `${folder?.name ?? 'folder'}-export-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
  return true;
});

// Messages
ipcMain.handle('messages:list', (_, conversationId) => queries.listMessages(conversationId));
ipcMain.handle('messages:create', (_, conversationId, role, content, attachments) =>
  queries.createMessage(conversationId, role, content, attachments)
);
ipcMain.handle('messages:update', (_, id, content) => queries.updateMessage(id, content));
ipcMain.handle('messages:delete', (_, id) => queries.deleteMessage(id));
ipcMain.handle('messages:delete-after', (_, conversationId, afterCreatedAt) =>
  queries.deleteMessagesAfter(conversationId, afterCreatedAt)
);

// Chat completion (with MCP tool support)
ipcMain.handle('chat:send', async (_, conversationId: string, channelId: string) => {
  if (!mainWindow) throw new Error('No window');

  const conv = queries.getConversation(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const endpoint = queries.listEndpoints().find((e) => e.id === conv.endpointId);
  if (!endpoint) throw new Error('Endpoint not found');

  const messages = queries.listMessages(conversationId);
  const systemPrompt = conv.systemPromptId
    ? queries.listSystemPrompts().find((s) => s.id === conv.systemPromptId)
    : undefined;

  const preset = conv.samplingPresetId
    ? queries.listSamplingPresets().find((p) => p.id === conv.samplingPresetId)
    : undefined;

  const apiMessages: { role: string; content: string | any[] }[] = [];

  // Build system prompt: user's system prompt + MCP tool descriptions
  const toolsPrompt = mcp.buildToolsSystemPrompt();
  const systemParts = [systemPrompt?.content, toolsPrompt].filter(Boolean).join('\n\n');
  if (systemParts) {
    apiMessages.push({ role: 'system', content: systemParts });
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    if (msg.attachments && msg.attachments.length > 0) {
      const parts: any[] = [];
      for (const att of msg.attachments) {
        if (att.type === 'image') {
          parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.base64}` } });
        }
      }
      parts.push({ type: 'text', text: msg.content });
      apiMessages.push({ role: msg.role, content: parts });
    } else {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // Get OpenAI-format tools if any MCP servers are connected
  const tools = mcp.toolsToOpenAIFormat();

  await chatCompletion(
    {
      endpointUrl: endpoint.url,
      apiKey: endpoint.apiKey,
      model: conv.modelId,
      messages: apiMessages,
      sampling: preset ?? {},
      stream: true,
      tools: tools.length > 0 ? tools : undefined,
    },
    mainWindow,
    channelId
  );
});

// Get effective system prompt (user prompt + MCP tools)
ipcMain.handle('chat:system-prompt', (_, conversationId: string) => {
  const conv = queries.getConversation(conversationId);
  if (!conv) return null;
  const systemPrompt = conv.systemPromptId
    ? queries.listSystemPrompts().find((s) => s.id === conv.systemPromptId)
    : undefined;
  const toolsPrompt = mcp.buildToolsSystemPrompt();
  const parts = [systemPrompt?.content, toolsPrompt].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : null;
});

// Abort stream
ipcMain.handle('chat:abort', (_, channelId: string) => {
  return abortStream(channelId);
});

// ---- MCP ----
ipcMain.handle('mcp:get-config', () => {
  return JSON.stringify(mcp.loadConfig(), null, 2);
});

ipcMain.handle('mcp:save-config', async (_, configJson: string) => {
  const config = JSON.parse(configJson);
  mcp.saveConfig(config);
  // Reconnect all servers with new config
  await mcp.disconnectAll();
  await mcp.connectAll();
  return mcp.getServerStatus();
});

ipcMain.handle('mcp:get-status', () => {
  return mcp.getServerStatus();
});

ipcMain.handle('mcp:get-tools', () => {
  return mcp.getAllTools().map((t) => ({
    serverName: t.serverName,
    name: t.name,
    description: t.description,
  }));
});

ipcMain.handle('mcp:reconnect', async () => {
  await mcp.disconnectAll();
  await mcp.connectAll();
  return mcp.getServerStatus();
});

// Defaults
ipcMain.handle('defaults:get', () => loadDefaults());
ipcMain.handle('defaults:save', (_, defaults: AppDefaults) => {
  saveDefaults(defaults);
  return true;
});

// Export / Import
ipcMain.handle('db:export', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Database',
    defaultPath: 'ai-studio-backup.db',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });
  if (result.canceled || !result.filePath) return false;
  const data = queries.exportDatabase();
  fs.writeFileSync(result.filePath, data);
  return true;
});

ipcMain.handle('db:export-zip', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export All User Data',
    defaultPath: `ai-studio-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePath) return false;

  const userDataPath = app.getPath('userData');

  return new Promise<boolean>((resolve) => {
    const output = fs.createWriteStream(result.filePath!);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(true));
    archive.on('error', () => resolve(false));

    archive.pipe(output);

    // Add all files in userData directory
    const entries = fs.readdirSync(userDataPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(userDataPath, entry.name);
      if (entry.isFile()) {
        archive.file(fullPath, { name: entry.name });
      } else if (entry.isDirectory() && !['Cache', 'CachedData', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache'].includes(entry.name)) {
        archive.directory(fullPath, entry.name);
      }
    }

    archive.finalize();
  });
});

ipcMain.handle('db:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Database',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return false;
  const data = fs.readFileSync(result.filePaths[0]);
  queries.importDatabase(data);
  return true;
});
