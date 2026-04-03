import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export interface McpTool {
  serverName: string;
  name: string;
  description: string;
  inputSchema: any;
}

interface ActiveServer {
  client: Client;
  transport: StdioClientTransport;
  tools: McpTool[];
}

const activeServers = new Map<string, ActiveServer>();

export function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'mcp.json');
}

export function loadConfig(): McpConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    const defaultConfig: McpConfig = { mcpServers: {} };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export function validateConfig(config: any): McpConfig {
  if (!config || typeof config !== 'object') throw new Error('Invalid MCP config: must be an object');
  if (!config.mcpServers || typeof config.mcpServers !== 'object') throw new Error('Invalid MCP config: missing mcpServers');
  for (const [name, server] of Object.entries(config.mcpServers)) {
    const s = server as McpServerConfig;
    if (!s.command || typeof s.command !== 'string') throw new Error(`Invalid MCP server "${name}": command must be a non-empty string`);
    if (s.args !== undefined && !Array.isArray(s.args)) throw new Error(`Invalid MCP server "${name}": args must be an array`);
    if (s.env !== undefined && typeof s.env !== 'object') throw new Error(`Invalid MCP server "${name}": env must be an object`);
  }
  return config as McpConfig;
}

export function saveConfig(config: McpConfig): void {
  validateConfig(config);
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

export async function connectServer(name: string, config: McpServerConfig): Promise<McpTool[]> {
  // Disconnect existing if any
  await disconnectServer(name);

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      USERPROFILE: process.env.USERPROFILE ?? '',
      TEMP: process.env.TEMP ?? process.env.TMPDIR ?? '/tmp',
      LANG: process.env.LANG ?? '',
      ...(config.env ?? {}),
    } as Record<string, string>,
  });

  const client = new Client({ name: 'ai-studio', version: '0.1.0' }, { capabilities: {} });

  await client.connect(transport);

  const { tools: rawTools } = await client.listTools();
  const tools: McpTool[] = (rawTools ?? []).map((t) => ({
    serverName: name,
    name: t.name,
    description: t.description ?? '',
    inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
  }));

  activeServers.set(name, { client, transport, tools });
  return tools;
}

export async function disconnectServer(name: string): Promise<void> {
  const server = activeServers.get(name);
  if (server) {
    try {
      await server.transport.close();
    } catch {
      // ignore cleanup errors
    }
    activeServers.delete(name);
  }
}

export async function disconnectAll(): Promise<void> {
  for (const name of activeServers.keys()) {
    await disconnectServer(name);
  }
}

export async function connectAll(): Promise<McpTool[]> {
  const config = loadConfig();
  const allTools: McpTool[] = [];

  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const tools = await connectServer(name, serverConfig);
      allTools.push(...tools);
    } catch (err: any) {
      console.error(`Failed to connect MCP server "${name}":`, err.message);
    }
  }

  return allTools;
}

export function getAllTools(): McpTool[] {
  const tools: McpTool[] = [];
  for (const server of activeServers.values()) {
    tools.push(...server.tools);
  }
  return tools;
}

export function getServerStatus(): { name: string; connected: boolean; toolCount: number }[] {
  const config = loadConfig();
  return Object.keys(config.mcpServers).map((name) => {
    const server = activeServers.get(name);
    return {
      name,
      connected: !!server,
      toolCount: server?.tools.length ?? 0,
    };
  });
}

export async function callTool(toolName: string, args: any): Promise<any> {
  // Find which server has this tool
  for (const server of activeServers.values()) {
    const tool = server.tools.find((t) => t.name === toolName);
    if (tool) {
      const result = await server.client.callTool({ name: toolName, arguments: args });
      // Extract text content from MCP response
      if (result.content && Array.isArray(result.content)) {
        return result.content
          .map((c: any) => {
            if (c.type === 'text') return c.text;
            if (c.type === 'image') return `[image: ${c.mimeType}]`;
            return JSON.stringify(c);
          })
          .join('\n');
      }
      return JSON.stringify(result);
    }
  }
  throw new Error(`Tool "${toolName}" not found in any connected MCP server`);
}

export function toolsToOpenAIFormat(): any[] {
  return getAllTools().map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}
