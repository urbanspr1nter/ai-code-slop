<script lang="ts">
  import { appState, loadConversations, loadSystemPrompts, loadSamplingPresets, loadMcpToolCount, showToast } from '../stores/app.svelte';
  import { onMount } from 'svelte';
  import type { McpServerStatus, McpToolInfo } from '../../../shared/types';

  const activeConv = $derived(
    appState.conversations.find((c) => c.id === appState.activeConversationId)
  );

  const activePrompt = $derived(
    appState.systemPrompts.find((s) => s.id === activeConv?.systemPromptId)
  );

  const activePreset = $derived(
    appState.samplingPresets.find((p) => p.id === activeConv?.samplingPresetId)
  );

  // Local state for editing
  let promptContent = $state('');
  let promptName = $state('');
  let temp = $state(1.0);
  let topP = $state(0.9);
  let topK = $state(20);
  let maxTokens = $state(65536);
  let repeatPenalty = $state(1.1);

  let promptSection = $state(true);
  let samplingSection = $state(true);

  $effect(() => {
    if (activePrompt) {
      promptContent = activePrompt.content;
      promptName = activePrompt.name;
    } else {
      promptContent = '';
      promptName = '';
    }
  });

  $effect(() => {
    if (activePreset) {
      temp = activePreset.temperature;
      topP = activePreset.topP;
      topK = activePreset.topK;
      maxTokens = activePreset.maxTokens;
      repeatPenalty = activePreset.repeatPenalty;
    } else {
      temp = 1.0;
      topP = 0.9;
      topK = 20;
      maxTokens = 65536;
      repeatPenalty = 1.1;
    }
  });

  async function savePrompt() {
    if (!activeConv || !promptContent.trim()) return;
    if (activePrompt) {
      // Update existing prompt
      await window.api.updateSystemPrompt(activePrompt.id, promptName || activePrompt.name, promptContent);
      await loadSystemPrompts();
    } else {
      // Create new — require a name
      const name = promptName.trim() || 'Untitled';
      const sp = await window.api.createSystemPrompt(name, promptContent.trim());
      await loadSystemPrompts();
      await window.api.updateConversation(activeConv.id, { systemPromptId: sp.id });
      await loadConversations();
    }
    appState.systemPromptVersion++;
    showToast('System prompt saved');
  }

  async function selectPrompt(e: Event) {
    if (!activeConv) return;
    const val = (e.target as HTMLSelectElement).value;
    await window.api.updateConversation(activeConv.id, { systemPromptId: val || undefined });
    await loadConversations();
    appState.systemPromptVersion++;
    showToast(val ? 'System prompt applied' : 'System prompt cleared');
  }

  async function clearPrompt() {
    if (!activeConv) return;
    await window.api.updateConversation(activeConv.id, { systemPromptId: undefined });
    await loadConversations();
    promptContent = '';
    promptName = '';
    appState.systemPromptVersion++;
    showToast('System prompt cleared');
  }

  async function saveSampling() {
    if (!activeConv) return;
    const data = { name: activePreset?.name || 'Custom', temperature: temp, topP, topK, maxTokens, repeatPenalty };
    if (activePreset) {
      await window.api.updateSamplingPreset(activePreset.id, data);
      await loadSamplingPresets();
    } else {
      const preset = await window.api.createSamplingPreset(data);
      await loadSamplingPresets();
      await window.api.updateConversation(activeConv.id, { samplingPresetId: preset.id });
      await loadConversations();
    }
    showToast('Sampling settings saved');
  }

  async function selectPreset(e: Event) {
    if (!activeConv) return;
    const val = (e.target as HTMLSelectElement).value;
    await window.api.updateConversation(activeConv.id, { samplingPresetId: val || undefined });
    await loadConversations();
  }

  let saveTimeout: ReturnType<typeof setTimeout>;
  function debouncedSaveSampling() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveSampling, 500);
  }

  // MCP state
  let mcpSection = $state(true);
  let mcpConfigText = $state('');
  let mcpServers = $state<McpServerStatus[]>([]);
  let mcpTools = $state<McpToolInfo[]>([]);
  let mcpLoading = $state(false);
  let mcpError = $state('');

  async function loadMcpState() {
    try {
      mcpServers = await window.api.mcpGetStatus();
      mcpTools = await window.api.mcpGetTools();
    } catch {}
  }

  async function startEditMcp() {
    mcpConfigText = await window.api.mcpGetConfig();
    appState.mcpEditorOpen = true;
    mcpError = '';
  }

  async function saveMcpConfig() {
    mcpLoading = true;
    mcpError = '';
    try {
      JSON.parse(mcpConfigText);
      mcpServers = await window.api.mcpSaveConfig(mcpConfigText);
      mcpTools = await window.api.mcpGetTools();
      appState.mcpEditorOpen = false;
      await loadMcpToolCount();
      showToast('MCP config saved');
    } catch (err: any) {
      mcpError = err.message;
    } finally {
      mcpLoading = false;
    }
  }

  async function reconnectMcp() {
    mcpLoading = true;
    mcpError = '';
    try {
      mcpServers = await window.api.mcpReconnect();
      mcpTools = await window.api.mcpGetTools();
      await loadMcpToolCount();
    } catch (err: any) {
      mcpError = err.message;
    } finally {
      mcpLoading = false;
    }
  }

  onMount(() => {
    loadMcpState();
  });
</script>

<div class="flex flex-col h-full bg-bg-secondary border-l border-border overflow-y-auto">
  <!-- Header -->
  <div class="p-4 border-b border-border">
    <div class="text-sm font-semibold text-text-primary">Configuration</div>
  </div>

  {#if !activeConv}
    <div class="p-5 text-sm text-text-muted">Select a conversation to configure.</div>
  {:else}
    <!-- System Prompt Section -->
    <div class="border-b border-border">
      <button
        onclick={() => promptSection = !promptSection}
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
      >
        <span>System Prompt</span>
        <span class="text-text-muted text-xs">{promptSection ? '−' : '+'}</span>
      </button>

      {#if promptSection}
        <div class="px-4 pb-4 space-y-3">
          <select
            value={activeConv.systemPromptId ?? ''}
            onchange={selectPrompt}
            class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm cursor-pointer"
          >
            <option value="">None</option>
            {#each appState.systemPrompts as sp (sp.id)}
              <option value={sp.id}>{sp.name}</option>
            {/each}
          </select>

          <input
            bind:value={promptName}
            placeholder={activePrompt ? 'Prompt name' : 'Name for new prompt'}
            class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-text"
          />

          <textarea
            bind:value={promptContent}
            placeholder="Enter system prompt..."
            rows="5"
            class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-y min-h-[80px] cursor-text"
          ></textarea>

          <div class="flex gap-3">
            <button
              onclick={savePrompt}
              disabled={!promptContent.trim()}
              class="flex-1 py-2 px-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
            >
              {activePrompt ? 'Save' : 'Create & Apply'}
            </button>
            {#if activePrompt}
              <button
                onclick={clearPrompt}
                class="py-2 px-3 bg-bg-btn hover:bg-bg-btn-hover text-text-secondary rounded-lg text-sm cursor-pointer transition-colors"
              >
                Clear
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Sampling Settings Section -->
    <div class="border-b border-border">
      <button
        onclick={() => samplingSection = !samplingSection}
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
      >
        <span>Sampling</span>
        <span class="text-text-muted text-xs">{samplingSection ? '−' : '+'}</span>
      </button>

      {#if samplingSection}
        <div class="px-4 pb-4 space-y-4">
          <select
            value={activeConv.samplingPresetId ?? ''}
            onchange={selectPreset}
            class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm cursor-pointer"
          >
            <option value="">Default</option>
            {#each appState.samplingPresets as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>

          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="text-text-secondary">Temperature</span>
              <span class="text-text-muted tabular-nums">{temp.toFixed(2)}</span>
            </div>
            <input type="range" bind:value={temp} min="0" max="2" step="0.05" class="w-full" oninput={debouncedSaveSampling} />
          </div>

          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="text-text-secondary">Top P</span>
              <span class="text-text-muted tabular-nums">{topP.toFixed(2)}</span>
            </div>
            <input type="range" bind:value={topP} min="0" max="1" step="0.05" class="w-full" oninput={debouncedSaveSampling} />
          </div>

          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="text-text-secondary">Top K</span>
              <span class="text-text-muted tabular-nums">{topK}</span>
            </div>
            <input
              type="number"
              bind:value={topK}
              min="0"
              max="200"
              class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-text"
              oninput={debouncedSaveSampling}
            />
          </div>

          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="text-text-secondary">Max Tokens</span>
              <span class="text-text-muted tabular-nums">{maxTokens}</span>
            </div>
            <input
              type="number"
              bind:value={maxTokens}
              min="1"
              max="131072"
              class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-text"
              oninput={debouncedSaveSampling}
            />
          </div>

          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="text-text-secondary">Repeat Penalty</span>
              <span class="text-text-muted tabular-nums">{repeatPenalty.toFixed(2)}</span>
            </div>
            <input type="range" bind:value={repeatPenalty} min="1" max="2" step="0.05" class="w-full" oninput={debouncedSaveSampling} />
          </div>

          <button
            onclick={saveSampling}
            class="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            {activePreset ? 'Save Preset' : 'Create Preset'}
          </button>
        </div>
      {/if}
    </div>

    <!-- MCP Section -->
    <div class="border-b border-border">
      <button
        onclick={() => mcpSection = !mcpSection}
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
      >
        <span>MCP Tools</span>
        <span class="text-text-muted text-xs">{mcpSection ? '−' : '+'}</span>
      </button>

      {#if mcpSection}
        <div class="px-4 pb-4 space-y-3">
          <!-- Server status -->
          {#if mcpServers.length > 0}
            <div class="space-y-2">
              {#each mcpServers as server}
                <div class="flex items-center gap-2.5 text-sm">
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 {server.connected ? 'bg-green-500' : 'bg-red-400'}"></span>
                  <span class="text-text-primary flex-1 truncate">{server.name}</span>
                  <span class="text-text-muted text-xs">{server.toolCount} tools</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-sm text-text-muted">No MCP servers configured.</div>
          {/if}

          <!-- Tools list -->
          {#if mcpTools.length > 0}
            <div class="border border-border rounded-lg overflow-hidden">
              <div class="px-3 py-2 bg-bg-tertiary text-xs font-medium text-text-secondary">
                Loaded Tools ({mcpTools.length})
              </div>
              <div class="max-h-[180px] overflow-y-auto">
                {#each mcpTools as tool}
                  <div class="px-3 py-2 border-t border-border">
                    <div class="text-sm font-medium text-text-primary">{tool.name}</div>
                    <div class="text-xs text-text-muted mt-0.5 line-clamp-2" title={tool.description}>{tool.description}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Config actions -->
          <div class="flex gap-3">
            <button
              onclick={startEditMcp}
              class="flex-1 py-2 px-3 bg-bg-btn hover:bg-bg-btn-hover text-text-secondary rounded-lg text-sm cursor-pointer transition-colors"
            >
              Edit mcp.json
            </button>
              <button
                onclick={reconnectMcp}
                disabled={mcpLoading}
                class="py-2 px-3 bg-bg-btn hover:bg-bg-btn-hover text-text-secondary rounded-lg text-sm cursor-pointer transition-colors disabled:opacity-50"
              >
                {mcpLoading ? '...' : 'Reconnect'}
              </button>
            </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
