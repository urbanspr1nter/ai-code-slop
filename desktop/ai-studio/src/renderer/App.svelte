<script lang="ts">
  import './app.css';
  import { appState, initApp } from './lib/stores/app.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import ChatView from './lib/components/ChatView.svelte';
  import Settings from './lib/components/Settings.svelte';
  import RightSidebar from './lib/components/RightSidebar.svelte';
  import Toast from './lib/components/Toast.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    initApp();
  });
</script>

<div class="flex h-full">
  <!-- Left Sidebar -->
  {#if appState.sidebarOpen}
    <div class="w-60 flex-shrink-0">
      <Sidebar />
    </div>
  {/if}

  <!-- Main content -->
  <div class="flex-1 min-w-0">
    <ChatView />
  </div>

  <!-- Right Sidebar -->
  {#if appState.rightSidebarOpen}
    <div class="w-72 flex-shrink-0">
      <RightSidebar />
    </div>
  {/if}
</div>

<!-- Settings Modal -->
{#if appState.settingsOpen}
  <Settings />
{/if}

<Toast />
