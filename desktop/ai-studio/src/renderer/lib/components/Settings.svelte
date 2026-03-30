<script lang="ts">
  import { appState, loadEndpoints, loadSystemPrompts, loadSamplingPresets, loadDefaults, showToast } from '../stores/app.svelte';

  let activeTab = $state<'endpoints' | 'prompts' | 'sampling' | 'defaults'>('endpoints');

  // Defaults state
  let defaultEndpointId = $state(appState.defaults.endpointId ?? '');
  let defaultSystemPromptId = $state(appState.defaults.systemPromptId ?? '');
  let defaultSamplingPresetId = $state(appState.defaults.samplingPresetId ?? '');

  async function saveDefaultsConfig() {
    await window.api.saveDefaults({
      endpointId: defaultEndpointId || undefined,
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
  let sampTemp = $state(0.7);
  let sampTopP = $state(0.9);
  let sampTopK = $state(40);
  let sampMaxTokens = $state(4096);
  let sampRepeatPenalty = $state(1.1);
  let editingPresetId = $state<string | null>(null);

  function close() {
    appState.settingsOpen = false;
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
    sampTemp = 0.7;
    sampTopP = 0.9;
    sampTopK = 40;
    sampMaxTokens = 4096;
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
      {#each [['defaults', 'Defaults'], ['endpoints', 'Endpoints'], ['prompts', 'System Prompts'], ['sampling', 'Sampling']] as [key, label]}
        <button
          onclick={() => activeTab = key as any}
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
              <option value="">Default (temp=0.7, top_p=0.9)</option>
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
      {/if}
    </div>
  </div>
</div>
