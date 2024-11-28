<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let isOpen = false; // Export isOpen to bind with parent

  // List of symbols
  let symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'USDTUSD', 'BTC.D'];

  // Toggle the sidebar
  const toggleSidebar = () => {
    isOpen = !isOpen;
  };

  // Handle symbol selection
  const selectSymbol = (symbol) => {
    dispatch('symbolSelected', { symbol });
  };
</script>

<style>
  .sidebar {
    width: 250px;
    height: 100vh;
    background-color: #1e1e1e;
    color: #fff;
    transition: transform 0.3s ease-in-out;
    overflow-y: auto;
  }
  .sidebar.closed {
    transform: translateX( -250px );
  }
  .toggle-button {
    background-color: #1e1e1e;
    color: #fff;
    padding: 10px;
    cursor: pointer;
    text-align: center;
  }
  .symbol-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .symbol-list li {
    padding: 15px;
    cursor: pointer;
  }
  .symbol-list li:hover {
    background-color: #333;
  }
</style>

<div class="sidebar {isOpen ? '' : 'closed'}">
  <div class="toggle-button" on:click={toggleSidebar}>
    {isOpen ? '<<' : '>>'}
  </div>
  <ul class="symbol-list">
    {#each symbols as symbol}
      <li on:click={() => selectSymbol(symbol)}>{symbol}</li>
    {/each}
  </ul>
</div>
