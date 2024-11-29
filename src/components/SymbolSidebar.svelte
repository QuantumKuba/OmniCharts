<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  // Sidebar state
  let isOpen = false;

  // List of symbols
  let symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "USDTUSD", "BTC.D"];

  // Toggle the sidebar
  const toggleSidebar = () => {
    isOpen = !isOpen;
  };

  // Handle symbol selection
  const selectSymbol = (symbol) => {
    dispatch("symbolSelected", { symbol });
  };
</script>

<div class="toggle-button {isOpen ? 'open' : ''}" on:click={toggleSidebar}>
  {isOpen ? "Close" : "Symbols"}
</div>

<div class="sidebar {isOpen ? 'open' : ''}">
  <ul class="symbol-list">
    {#each symbols as symbol}
      <li on:click={() => selectSymbol(symbol)}>{symbol}</li>
    {/each}
  </ul>
</div>

<style>
  .sidebar {
    position: fixed;
    right: 0;
    top: 0;
    width: 250px;
    height: 100%;
    background-color: #1e1e1e;
    color: #fff;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
    overflow-y: auto;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .toggle-button {
    position: fixed;
    right: 0;
    top: 50%;
    background-color: #1e1e1e;
    color: #fff;
    padding: 10px;
    cursor: pointer;
    transform: translateX(0);
    transition: transform 0.3s ease-in-out;
  }
  .toggle-button.open {
    transform: translateX(-250px);
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
