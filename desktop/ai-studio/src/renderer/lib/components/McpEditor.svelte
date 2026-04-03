<script lang="ts">
  import { appState, loadMcpToolCount, showToast } from '../stores/app.svelte';

  let configText = $state('');
  let error = $state('');
  let loading = $state(false);

  $effect(() => {
    if (appState.mcpEditorOpen) {
      window.api.mcpGetConfig().then((text) => { configText = text; });
      error = '';
    }
  });

  async function save() {
    loading = true;
    error = '';
    try {
      JSON.parse(configText);
      await window.api.mcpSaveConfig(configText);
      await loadMcpToolCount();
      appState.mcpEditorOpen = false;
      showToast('MCP config saved & servers reconnected');
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function cancel() {
    appState.mcpEditorOpen = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      cancel();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      configText = configText.substring(0, start) + '  ' + configText.substring(end);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary">
    <div class="flex items-center gap-3">
      <h2 class="text-sm font-semibold text-text-primary">Edit mcp.json</h2>
      <span class="text-xs text-text-muted">Ctrl+S to save, Escape to cancel</span>
    </div>
    <div class="flex items-center gap-3">
      {#if error}
        <span class="text-xs text-red-500 max-w-[300px] truncate" title={error}>{error}</span>
      {/if}
      <button
        onclick={cancel}
        class="px-4 py-1.5 bg-bg-btn hover:bg-bg-btn-hover text-text-secondary rounded-lg text-sm cursor-pointer transition-colors"
      >
        Cancel
      </button>
      <button
        onclick={save}
        disabled={loading}
        class="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
      >
        {loading ? 'Saving...' : 'Save & Reconnect'}
      </button>
    </div>
  </div>

  <!-- Editor -->
  <textarea
    bind:value={configText}
    class="flex-1 bg-bg-primary text-text-primary font-mono text-sm p-6 resize-none focus:outline-none cursor-text leading-relaxed"
    spellcheck="false"
    onkeydown={handleKeydown}
  ></textarea>
</div>
