<script lang="ts">
  import { appState, loadConversations, loadFolders, selectConversation, loadModels } from '../stores/app.svelte';

  // No props needed — collapse is handled by the hamburger toggle in ChatView
  let expandedFolders = $state<Set<string>>(new Set());
  let renamingFolderId = $state<string | null>(null);
  let renameValue = $state('');

  const unfolderedConversations = $derived(
    appState.conversations.filter((c) => !c.folderId)
  );

  const folderGroups = $derived(
    appState.folders.map((folder) => ({
      folder,
      conversations: appState.conversations.filter((c) => c.folderId === folder.id),
    }))
  );

  async function newConversation(folderId?: string) {
    if (appState.endpoints.length === 0) {
      appState.settingsOpen = true;
      return;
    }

    const defaults = appState.defaults;
    const endpoint = appState.endpoints.find((e) => e.id === defaults.endpointId) ?? appState.endpoints[0];
    await loadModels(endpoint.id);
    const modelId = appState.models[0]?.id ?? 'default';

    const conv = await window.api.createConversation(
      'New Chat',
      endpoint.id,
      modelId,
      defaults.systemPromptId,
      defaults.samplingPresetId,
      folderId
    );
    await loadConversations();
    await selectConversation(conv.id);
    if (folderId) {
      expandedFolders = new Set([...expandedFolders, folderId]);
    }
  }

  async function deleteConv(id: string) {
    await window.api.deleteConversation(id);
    if (appState.activeConversationId === id) {
      appState.activeConversationId = null;
      appState.messages = [];
    }
    await loadConversations();
  }

  async function createNewFolder() {
    const folder = await window.api.createFolder('New Folder');
    await loadFolders();
    expandedFolders = new Set([...expandedFolders, folder.id]);
    renamingFolderId = folder.id;
    renameValue = folder.name;
  }

  function startRename(id: string, name: string) {
    renamingFolderId = id;
    renameValue = name;
  }

  async function finishRename() {
    if (renamingFolderId && renameValue.trim()) {
      await window.api.updateFolder(renamingFolderId, renameValue.trim());
      await loadFolders();
    }
    renamingFolderId = null;
  }

  async function deleteFolderById(id: string) {
    await window.api.deleteFolder(id);
    await loadFolders();
    await loadConversations();
  }

  async function exportFolder(folderId: string) {
    await window.api.exportFolderToFile(folderId);
  }

  function toggleFolder(id: string) {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedFolders = next;
  }

  async function moveToFolder(convId: string, folderId: string | null) {
    await window.api.updateConversation(convId, { folderId: folderId ?? undefined });
    await loadConversations();
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
</script>

{#snippet convRow(conv: typeof appState.conversations[0])}
  {@const isStreaming = appState.streamingConversationId === conv.id}
  <div
    class="group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
      {conv.id === appState.activeConversationId ? 'bg-bg-tertiary' : isStreaming ? 'bg-indigo-50' : 'hover:bg-bg-primary'}"
    role="button"
    tabindex="0"
    onclick={() => selectConversation(conv.id)}
    onkeydown={(e) => e.key === 'Enter' && selectConversation(conv.id)}
  >
    {#if isStreaming}
      <span class="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0"></span>
    {/if}
    <div class="flex-1 min-w-0">
      <div class="text-sm truncate text-text-primary">{conv.title}</div>
      <div class="text-xs text-text-muted mt-0.5">{isStreaming ? 'Generating...' : formatDate(conv.updatedAt)}</div>
    </div>
    <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0">
      <!-- Move to folder -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <select
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        onchange={(e) => { e.stopPropagation(); moveToFolder(conv.id, (e.target as HTMLSelectElement).value || null); }}
        value={conv.folderId ?? ''}
        class="bg-transparent border-none text-text-muted cursor-pointer w-5 h-5 p-0 text-xs appearance-none hover:text-text-primary"
        title="Move to folder"
      >
        <option value="">📂</option>
        {#each appState.folders as f (f.id)}
          <option value={f.id}>{f.name}</option>
        {/each}
      </select>
      <button
        onclick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
        class="text-text-muted hover:text-accent text-sm cursor-pointer transition-colors p-0.5"
        title="Delete"
      >
        ✕
      </button>
    </div>
  </div>
{/snippet}

<div class="flex flex-col h-full bg-bg-secondary border-r border-border">
  <!-- Header -->
  <div class="flex items-center gap-2 p-4 border-b border-border">
    <button
      onclick={() => newConversation()}
      class="flex-1 py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors cursor-pointer"
    >
      + New Chat
    </button>
    <button
      onclick={createNewFolder}
      class="p-2.5 rounded-lg bg-bg-btn hover:bg-bg-btn-hover text-text-secondary text-sm cursor-pointer transition-colors"
      title="New folder"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
    </button>
  </div>

  <!-- Conversation List -->
  <div class="flex-1 overflow-y-auto p-3 space-y-1">
    <!-- Folders -->
    {#each folderGroups as { folder, conversations } (folder.id)}
      <div class="mb-1">
        <!-- Folder header -->
        <div class="group flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-bg-primary transition-colors">
          <button
            onclick={() => toggleFolder(folder.id)}
            class="text-text-muted text-xs cursor-pointer flex-shrink-0 p-0.5"
          >
            {expandedFolders.has(folder.id) ? '▾' : '▸'}
          </button>
          <svg class="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>

          {#if renamingFolderId === folder.id}
            <input
              bind:value={renameValue}
              class="flex-1 min-w-0 text-sm bg-bg-input border border-border rounded px-1.5 py-0.5 text-text-primary cursor-text"
              onblur={finishRename}
              onkeydown={(e) => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') { renamingFolderId = null; } }}
              autofocus
            />
          {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="flex-1 min-w-0 text-sm text-text-secondary font-medium truncate cursor-pointer"
              onclick={() => toggleFolder(folder.id)}
              ondblclick={() => startRename(folder.id, folder.name)}
              title="Double-click to rename"
            >
              {folder.name}
            </span>
            <span class="text-xs text-text-muted flex-shrink-0">{conversations.length}</span>
          {/if}

          <div class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
            <button
              onclick={() => newConversation(folder.id)}
              class="text-text-muted hover:text-text-primary text-xs cursor-pointer p-0.5 transition-colors"
              title="New chat in folder"
            >+</button>
            <button
              onclick={() => exportFolder(folder.id)}
              class="text-text-muted hover:text-accent text-xs cursor-pointer p-0.5 transition-colors"
              title="Export folder as JSON"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button
              onclick={() => deleteFolderById(folder.id)}
              class="text-text-muted hover:text-accent text-xs cursor-pointer p-0.5 transition-colors"
              title="Delete folder (keeps chats)"
            >✕</button>
          </div>
        </div>

        <!-- Folder conversations -->
        {#if expandedFolders.has(folder.id)}
          <div class="ml-5 space-y-0.5 mt-0.5">
            {#each conversations as conv (conv.id)}
              {@render convRow(conv)}
            {/each}
            {#if conversations.length === 0}
              <div class="text-xs text-text-muted px-3 py-2">Empty folder</div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Unfoldered conversations -->
    {#each unfolderedConversations as conv (conv.id)}
      {@render convRow(conv)}
    {/each}
  </div>

  <!-- Footer -->
  <div class="p-4 border-t border-border space-y-3">
    <button
      onclick={() => appState.settingsOpen = true}
      class="w-full py-2.5 px-4 rounded-lg bg-bg-btn hover:bg-bg-btn-hover text-text-secondary text-sm transition-colors cursor-pointer"
    >
      Settings
    </button>
    <div class="flex gap-2">
      <button
        onclick={() => window.api.exportDb()}
        class="flex-1 py-2 px-3 rounded-lg text-xs text-text-muted hover:text-text-primary bg-bg-btn hover:bg-bg-btn-hover transition-colors cursor-pointer"
      >
        Export DB
      </button>
      <button
        onclick={async () => { const ok = await window.api.importDb(); if (ok) location.reload(); }}
        class="flex-1 py-2 px-3 rounded-lg text-xs text-text-muted hover:text-text-primary bg-bg-btn hover:bg-bg-btn-hover transition-colors cursor-pointer"
      >
        Import DB
      </button>
    </div>
    <button
      onclick={() => window.api.exportZip()}
      class="w-full py-2 px-3 rounded-lg text-xs text-text-muted hover:text-text-primary bg-bg-btn hover:bg-bg-btn-hover transition-colors cursor-pointer"
    >
      Download All Data (.zip)
    </button>
  </div>
</div>
