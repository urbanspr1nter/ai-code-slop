<script lang="ts">
  import { appState } from '../stores/app.svelte';
</script>

{#if appState.toasts.length > 0}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
    {#each appState.toasts as toast (toast.id)}
      <div
        class="px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in
          {toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}"
      >
        {toast.type === 'success' ? '✓' : '✕'} {toast.message}
      </div>
    {/each}
  </div>
{/if}

<style>
  @keyframes fade-in {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
</style>
