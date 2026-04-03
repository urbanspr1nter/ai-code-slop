<script lang="ts">
  import { appState, loadEndpoints, loadSystemPrompts, loadSamplingPresets, loadDefaults, loadConversations, showToast } from '../stores/app.svelte';

  let activeTab = $state<'endpoints' | 'prompts' | 'sampling' | 'defaults' | 'help'>('endpoints');

  // Defaults state
  let defaultEndpointId = $state(appState.defaults.endpointId ?? '');
  let defaultModelId = $state(appState.defaults.modelId ?? '');
  let defaultSystemPromptId = $state(appState.defaults.systemPromptId ?? '');
  let defaultSamplingPresetId = $state(appState.defaults.samplingPresetId ?? '');

  async function saveDefaultsConfig() {
    await window.api.saveDefaults({
      endpointId: defaultEndpointId || undefined,
      modelId: defaultModelId || undefined,
      systemPromptId: defaultSystemPromptId || undefined,
      samplingPresetId: defaultSamplingPresetId || undefined,
    });
    await loadDefaults();
    showToast('Defaults saved');
  }

  // Endpoint form
  let epName = $state('');
  let epUrl = $state('');
  let epApiKey = $state('');
  let editingEndpointId = $state<string | null>(null);

  // System prompt form
  let spName = $state('');
  let spContent = $state('');
  let editingPromptId = $state<string | null>(null);

  // Sampling preset form
  let sampName = $state('');
  let sampTemp = $state(1.0);
  let sampTopP = $state(0.9);
  let sampTopK = $state(20);
  let sampMaxTokens = $state(65536);
  let sampRepeatPenalty = $state(1.1);
  let editingPresetId = $state<string | null>(null);

  function close() {
    appState.settingsOpen = false;
    // Refresh all data so toolbar/sidebars reflect any changes
    loadEndpoints();
    loadSystemPrompts();
    loadSamplingPresets();
    loadConversations();
    loadDefaults();
  }

  async function saveEndpoint() {
    if (!epName.trim() || !epUrl.trim()) return;
    const isEdit = !!editingEndpointId;
    if (editingEndpointId) {
      await window.api.updateEndpoint(editingEndpointId, epName.trim(), epUrl.trim(), epApiKey.trim() || undefined);
    } else {
      await window.api.createEndpoint(epName.trim(), epUrl.trim(), epApiKey.trim() || undefined);
    }
    resetEndpointForm();
    await loadEndpoints();
    showToast(isEdit ? 'Endpoint updated' : 'Endpoint added');
  }

  function editEndpoint(id: string) {
    const ep = appState.endpoints.find((e) => e.id === id);
    if (!ep) return;
    editingEndpointId = id;
    epName = ep.name;
    epUrl = ep.url;
    epApiKey = ep.apiKey ?? '';
  }

  async function deleteEndpoint(id: string) {
    await window.api.deleteEndpoint(id);
    await loadEndpoints();
    showToast('Endpoint deleted');
  }

  function resetEndpointForm() {
    editingEndpointId = null;
    epName = '';
    epUrl = '';
    epApiKey = '';
  }

  async function savePrompt() {
    if (!spName.trim() || !spContent.trim()) return;
    const isEdit = !!editingPromptId;
    if (editingPromptId) {
      await window.api.updateSystemPrompt(editingPromptId, spName.trim(), spContent.trim());
    } else {
      await window.api.createSystemPrompt(spName.trim(), spContent.trim());
    }
    resetPromptForm();
    await loadSystemPrompts();
    showToast(isEdit ? 'Prompt updated' : 'Prompt added');
  }

  function editPrompt(id: string) {
    const sp = appState.systemPrompts.find((s) => s.id === id);
    if (!sp) return;
    editingPromptId = id;
    spName = sp.name;
    spContent = sp.content;
  }

  async function deletePrompt(id: string) {
    await window.api.deleteSystemPrompt(id);
    await loadSystemPrompts();
    showToast('Prompt deleted');
  }

  function resetPromptForm() {
    editingPromptId = null;
    spName = '';
    spContent = '';
  }

  async function savePreset() {
    if (!sampName.trim()) return;
    const isEdit = !!editingPresetId;
    const data = { name: sampName.trim(), temperature: sampTemp, topP: sampTopP, topK: sampTopK, maxTokens: sampMaxTokens, repeatPenalty: sampRepeatPenalty };
    if (editingPresetId) {
      await window.api.updateSamplingPreset(editingPresetId, data);
    } else {
      await window.api.createSamplingPreset(data);
    }
    resetPresetForm();
    await loadSamplingPresets();
    showToast(isEdit ? 'Preset updated' : 'Preset added');
  }

  function editPreset(id: string) {
    const p = appState.samplingPresets.find((s) => s.id === id);
    if (!p) return;
    editingPresetId = id;
    sampName = p.name;
    sampTemp = p.temperature;
    sampTopP = p.topP;
    sampTopK = p.topK;
    sampMaxTokens = p.maxTokens;
    sampRepeatPenalty = p.repeatPenalty;
  }

  async function deletePreset(id: string) {
    await window.api.deleteSamplingPreset(id);
    await loadSamplingPresets();
    showToast('Preset deleted');
  }

  function resetPresetForm() {
    editingPresetId = null;
    sampName = '';
    sampTemp = 1.0;
    sampTopP = 0.9;
    sampTopK = 20;
    sampMaxTokens = 65536;
    sampRepeatPenalty = 1.1;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="bg-bg-secondary rounded-2xl w-[640px] max-h-[80vh] flex flex-col shadow-2xl border border-border" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-border">
      <h2 class="text-lg font-semibold">Settings</h2>
      <button onclick={close} class="text-text-muted hover:text-text-primary cursor-pointer text-lg px-1">✕</button>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-border px-6 gap-1">
      {#each [['defaults', 'Defaults'], ['endpoints', 'Endpoints'], ['prompts', 'System Prompts'], ['sampling', 'Sampling'], ['help', 'Help']] as [key, label]}
        <button
          onclick={() => activeTab = key as typeof activeTab}
          class="px-4 py-3 text-sm font-medium transition-colors cursor-pointer {activeTab === key ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text-primary'}"
        >{label}</button>
      {/each}
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      {#if activeTab === 'defaults'}
        <div class="space-y-5">
          <p class="text-sm text-text-secondary">These defaults are applied when creating new conversations.</p>

          <div>
            <label class="text-sm text-text-secondary block mb-1.5">Default Endpoint</label>
            <select
              bind:value={defaultEndpointId}
              class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-pointer"
            >
              <option value="">First available</option>
              {#each appState.endpoints as ep (ep.id)}
                <option value={ep.id}>{ep.name}</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="text-sm text-text-secondary block mb-1.5">Default Model ID</label>
            <input
              bind:value={defaultModelId}
              placeholder="e.g. qwen2.5-7b-instruct (blank = first available)"
              class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-text"
            />
          </div>

          <div>
            <label class="text-sm text-text-secondary block mb-1.5">Default System Prompt</label>
            <select
              bind:value={defaultSystemPromptId}
              class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-pointer"
            >
              <option value="">None</option>
              {#each appState.systemPrompts as sp (sp.id)}
                <option value={sp.id}>{sp.name}</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="text-sm text-text-secondary block mb-1.5">Default Sampling Preset</label>
            <select
              bind:value={defaultSamplingPresetId}
              class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-pointer"
            >
              <option value="">Default (temp=1.0, top_p=0.9, top_k=20)</option>
              {#each appState.samplingPresets as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>

          <button
            onclick={saveDefaultsConfig}
            class="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            Save Defaults
          </button>
        </div>

      {:else if activeTab === 'endpoints'}
        <div class="space-y-4 mb-6">
          <input bind:value={epName} placeholder="Name (e.g. My llama.cpp server)" class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-text" />
          <input bind:value={epUrl} placeholder="URL (e.g. http://192.168.1.100:8080/v1)" class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-text" />
          <input bind:value={epApiKey} placeholder="API Key (optional)" type="password" class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-text" />
          <div class="flex gap-3">
            <button onclick={saveEndpoint} class="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer transition-colors">
              {editingEndpointId ? 'Update' : 'Add'} Endpoint
            </button>
            {#if editingEndpointId}
              <button onclick={resetEndpointForm} class="px-5 py-2.5 bg-bg-btn text-text-secondary rounded-lg text-sm cursor-pointer transition-colors hover:bg-bg-btn-hover">Cancel</button>
            {/if}
          </div>
        </div>
        <div class="space-y-2">
          {#each appState.endpoints as ep (ep.id)}
            <div class="flex items-center justify-between bg-bg-primary rounded-lg px-4 py-3">
              <div>
                <div class="text-sm font-medium">{ep.name}</div>
                <div class="text-xs text-text-muted mt-0.5">{ep.url}</div>
              </div>
              <div class="flex gap-3">
                <button onclick={() => editEndpoint(ep.id)} class="text-sm text-text-muted hover:text-text-primary cursor-pointer transition-colors">Edit</button>
                <button onclick={() => deleteEndpoint(ep.id)} class="text-sm text-text-muted hover:text-accent cursor-pointer transition-colors">Delete</button>
              </div>
            </div>
          {/each}
        </div>

      {:else if activeTab === 'prompts'}
        <div class="space-y-4 mb-6">
          <input bind:value={spName} placeholder="Prompt name" class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-text" />
          <textarea bind:value={spContent} placeholder="System prompt content..." rows="5" class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary resize-none cursor-text"></textarea>
          <div class="flex gap-3">
            <button onclick={savePrompt} class="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer transition-colors">
              {editingPromptId ? 'Update' : 'Add'} Prompt
            </button>
            {#if editingPromptId}
              <button onclick={resetPromptForm} class="px-5 py-2.5 bg-bg-btn text-text-secondary rounded-lg text-sm cursor-pointer transition-colors hover:bg-bg-btn-hover">Cancel</button>
            {/if}
          </div>
        </div>
        <div class="space-y-2">
          {#each appState.systemPrompts as sp (sp.id)}
            <div class="flex items-center justify-between bg-bg-primary rounded-lg px-4 py-3">
              <div class="flex-1 min-w-0 mr-4">
                <div class="text-sm font-medium">{sp.name}</div>
                <div class="text-xs text-text-muted mt-0.5 truncate">{sp.content.slice(0, 80)}...</div>
              </div>
              <div class="flex gap-3">
                <button onclick={() => editPrompt(sp.id)} class="text-sm text-text-muted hover:text-text-primary cursor-pointer transition-colors">Edit</button>
                <button onclick={() => deletePrompt(sp.id)} class="text-sm text-text-muted hover:text-accent cursor-pointer transition-colors">Delete</button>
              </div>
            </div>
          {/each}
        </div>

      {:else if activeTab === 'sampling'}
        <div class="space-y-4 mb-6">
          <input bind:value={sampName} placeholder="Preset name" class="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary cursor-text" />
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm text-text-secondary block mb-1.5">Temperature: {sampTemp}</label>
              <input type="range" bind:value={sampTemp} min="0" max="2" step="0.05" class="w-full" />
            </div>
            <div>
              <label class="text-sm text-text-secondary block mb-1.5">Top P: {sampTopP}</label>
              <input type="range" bind:value={sampTopP} min="0" max="1" step="0.05" class="w-full" />
            </div>
            <div>
              <label class="text-sm text-text-secondary block mb-1.5">Top K: {sampTopK}</label>
              <input type="number" bind:value={sampTopK} min="0" max="200" class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-text" />
            </div>
            <div>
              <label class="text-sm text-text-secondary block mb-1.5">Max Tokens: {sampMaxTokens}</label>
              <input type="number" bind:value={sampMaxTokens} min="1" max="131072" class="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-text" />
            </div>
            <div class="col-span-2">
              <label class="text-sm text-text-secondary block mb-1.5">Repeat Penalty: {sampRepeatPenalty}</label>
              <input type="range" bind:value={sampRepeatPenalty} min="1" max="2" step="0.05" class="w-full" />
            </div>
          </div>
          <div class="flex gap-3">
            <button onclick={savePreset} class="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer transition-colors">
              {editingPresetId ? 'Update' : 'Add'} Preset
            </button>
            {#if editingPresetId}
              <button onclick={resetPresetForm} class="px-5 py-2.5 bg-bg-btn text-text-secondary rounded-lg text-sm cursor-pointer transition-colors hover:bg-bg-btn-hover">Cancel</button>
            {/if}
          </div>
        </div>
        <div class="space-y-2">
          {#each appState.samplingPresets as p (p.id)}
            <div class="flex items-center justify-between bg-bg-primary rounded-lg px-4 py-3">
              <div>
                <div class="text-sm font-medium">{p.name}</div>
                <div class="text-xs text-text-muted mt-0.5">temp={p.temperature} top_p={p.topP} top_k={p.topK} max={p.maxTokens}</div>
              </div>
              <div class="flex gap-3">
                <button onclick={() => editPreset(p.id)} class="text-sm text-text-muted hover:text-text-primary cursor-pointer transition-colors">Edit</button>
                <button onclick={() => deletePreset(p.id)} class="text-sm text-text-muted hover:text-accent cursor-pointer transition-colors">Delete</button>
              </div>
            </div>
          {/each}
        </div>
      {:else if activeTab === 'help'}
        <div class="space-y-6 text-sm text-text-secondary leading-relaxed">
          <div>
            <h3 class="text-base font-semibold text-text-primary mb-2">Getting Started</h3>
            <p>AI Studio connects to remote OpenAI-compatible LLM servers. It does not run models locally. To start chatting:</p>
            <ol class="list-decimal pl-5 mt-2 space-y-1">
              <li>Add an <strong>Endpoint</strong> (e.g. <code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs">http://127.0.0.1:8000/v1</code>)</li>
              <li>Click <strong>+ New Chat</strong> to create a conversation</li>
              <li>Select a model from the toolbar dropdown</li>
              <li>Type a message and press <strong>Ctrl+Enter</strong> to send</li>
            </ol>
          </div>

          <div>
            <h3 class="text-base font-semibold text-text-primary mb-2">Keyboard Shortcuts</h3>
            <div class="grid grid-cols-2 gap-2">
              <div><code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs">Ctrl+Enter</code></div><div>Send message</div>
              <div><code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs">Escape</code></div><div>Cancel editing</div>
              <div><code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs">Ctrl+Enter</code></div><div>Save & regenerate (while editing)</div>
            </div>
          </div>

          <div>
            <h3 class="text-base font-semibold text-text-primary mb-2">Template Variables</h3>
            <p>Use these in system prompts. They resolve fresh on every request:</p>
            <div class="mt-2 space-y-2">
              <div class="flex items-start gap-3">
                <code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs whitespace-nowrap">{'{{current_date}}'}</code>
                <span>Today's date in ISO format (e.g. <code class="text-xs">2026-03-30</code>)</span>
              </div>
              <div class="flex items-start gap-3">
                <code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs whitespace-nowrap">{'{{current_time}}'}</code>
                <span>Current local time (e.g. <code class="text-xs">3:45:12 PM</code>)</span>
              </div>
              <div class="flex items-start gap-3">
                <code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs whitespace-nowrap">{'{{current_datetime}}'}</code>
                <span>Full date and time in local format</span>
              </div>
            </div>
            <p class="mt-2 text-text-muted">Example: <code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs">You are a helpful assistant. Today is {'{{current_date}}'}.</code></p>
          </div>

          <div>
            <h3 class="text-base font-semibold text-text-primary mb-2">Sampling Parameters</h3>
            <div class="space-y-2">
              <div><strong>Temperature</strong> — Controls randomness. 0 = deterministic, 2 = very creative. Default: 1.0</div>
              <div><strong>Top P</strong> — Nucleus sampling. Only consider tokens in the top P probability mass. Default: 0.9</div>
              <div><strong>Top K</strong> — Only consider the K most likely tokens. Lower = more focused. Default: 20</div>
              <div><strong>Max Tokens</strong> — Maximum response length in tokens. Default: 65536</div>
              <div><strong>Repeat Penalty</strong> — Penalizes repeated tokens. 1.0 = off, higher = less repetition. Default: 1.1</div>
            </div>
          </div>

          <div>
            <h3 class="text-base font-semibold text-text-primary mb-2">MCP Tools</h3>
            <p>Connect MCP (Model Context Protocol) servers to give models access to external tools like web search, file access, APIs, etc.</p>
            <p class="mt-2">Configure via the <strong>Configuration panel</strong> (gear icon) &gt; <strong>MCP Tools</strong> &gt; <strong>Edit mcp.json</strong>. Format:</p>
            <pre class="bg-bg-tertiary rounded-lg p-3 mt-2 text-xs overflow-x-auto">{'{\n  "mcpServers": {\n    "my-server": {\n      "command": "npx",\n      "args": ["-y", "some-mcp-package"],\n      "env": { "API_KEY": "..." }\n    }\n  }\n}'}</pre>
            <p class="mt-2">Tool calls and results appear as colored cards in the chat — blue for calls, green for results. They persist across restarts.</p>
          </div>

          <div>
            <h3 class="text-base font-semibold text-text-primary mb-2">Folders & Export</h3>
            <p>Organize conversations into folders. Export a folder's conversations as JSON in OpenAI API format (with vision support) for synthetic data generation.</p>
            <p class="mt-2">Other export options in the sidebar:</p>
            <ul class="list-disc pl-5 mt-1 space-y-1">
              <li><strong>Export DB</strong> — Save the SQLite database</li>
              <li><strong>Import DB</strong> — Load a database backup</li>
              <li><strong>Download All Data (.zip)</strong> — Full backup including DB, MCP config, and settings</li>
            </ul>
          </div>

          <div>
            <h3 class="text-base font-semibold text-text-primary mb-2">Features</h3>
            <ul class="list-disc pl-5 space-y-1">
              <li>Streaming responses with live token/s stats</li>
              <li>Image attachments via paste, drag & drop, or file picker (vision)</li>
              <li>Thinking trace support (<code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs">{'<think>'}</code> tags from DeepSeek, QwQ, etc.)</li>
              <li>Edit messages and regenerate from any point</li>
              <li>Multiple endpoints — switch between providers per conversation</li>
              <li>System prompt and sampling presets — save and reuse</li>
              <li>Background generation — switch chats while responses stream</li>
              <li>Performance stats: tok/s, TTFT, context estimate</li>
            </ul>
          </div>

          <div class="text-text-muted text-xs pt-2 border-t border-border">
            AI Studio v0.1.0 — Cross-platform LLM chat client
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
