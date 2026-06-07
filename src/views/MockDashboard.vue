<template>
  <div class="mock-dashboard min-h-screen text-white font-sans pb-24" style="background-color: #0d1117;">
    <!-- Top Header -->
    <header class="p-4 flex justify-between items-center border-b border-gray-800 sticky top-0 bg-[#0d1117]/80 backdrop-blur-md z-50">
      <h1 class="text-xl font-bold italic" style="color: #f5a623;">RAREBOX</h1>
      <div class="flex gap-4">
        <button @click="currentView = 'dashboard'" :class="currentView === 'dashboard' ? 'text-[#f5a623]' : 'text-gray-400'">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        <button @click="currentView = 'search'" :class="currentView === 'search' ? 'text-[#f5a623]' : 'text-gray-400'">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </button>
      </div>
    </header>

    <main class="p-4 space-y-8">
      
      <!-- DASHBOARD VIEW -->
      <div v-if="currentView === 'dashboard'" class="space-y-6 animate-fade-in">
        <!-- Glassmorphism Portfolio Card -->
        <section class="relative overflow-hidden rounded-2xl p-6 border border-white/10 shadow-xl" 
                 style="background: linear-gradient(135deg, rgba(33, 38, 45, 0.7) 0%, rgba(33, 38, 45, 0.4) 100%); backdrop-filter: blur(10px);">
          <div class="text-sm text-gray-400 mb-1">Portfolio Value</div>
          <div class="text-3xl font-bold tracking-tight">$11,694.78</div>
          <div class="text-sm font-medium mt-1 text-green-400">+$42.50 today</div>
          <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20" style="background-color: #f5a623;"></div>
        </section>

        <!-- Performance Chart -->
        <section class="rounded-xl p-4 bg-[#21262d] border border-white/5">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Performance</h2>
            <span class="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">7D</span>
          </div>
          <div class="h-32 w-full">
             <svg viewBox="0 0 400 100" class="w-full h-full overflow-visible">
              <path d="M0,80 Q50,70 100,85 T200,60 T300,40 T400,20" fill="none" stroke="#f5a623" stroke-width="3" />
              <path d="M0,80 Q50,70 100,85 T200,60 T300,40 T400,20 L400,100 L0,100 Z" fill="rgba(245, 166, 35, 0.1)" />
            </svg>
          </div>
        </section>

        <!-- 3x3 Binder Grid -->
        <section>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Featured Binder</h2>
          <div class="grid grid-cols-3 gap-3">
            <div v-for="i in 9" :key="i" class="aspect-[2.5/3.5] rounded-lg bg-[#21262d] border border-white/5 flex items-center justify-center relative overflow-hidden">
              <div class="w-full h-full bg-gradient-to-br from-gray-700/50 to-transparent"></div>
              <div class="absolute bottom-1 right-1 text-[10px] text-gray-500">#{{i}}</div>
            </div>
          </div>
        </section>
      </div>

      <!-- SEARCH VIEW -->
      <div v-if="currentView === 'search'" class="space-y-6 animate-fade-in">
        <section>
          <div class="relative">
            <input type="text" placeholder="Search cards, sets, or players..." 
                   class="w-full bg-[#21262d] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-[#f5a623]/50">
            <svg class="absolute left-4 top-4.5 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="2"/></svg>
          </div>
          <div class="flex gap-2 mt-4 overflow-x-auto pb-2">
            <span v-for="tag in ['Charizard', 'Pikachu', 'Evolving Skies', 'Graded']" :key="tag" 
                  class="whitespace-nowrap px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">{{tag}}</span>
          </div>
        </section>

        <section>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Trending Sets</h2>
          <div class="grid grid-cols-2 gap-4">
            <div v-for="set in ['Scarlet & Violet', 'Crown Zenith', 'Silver Tempest', 'Lost Origin']" :key="set" 
                 class="p-4 bg-[#21262d] rounded-xl border border-white/5 flex flex-col items-center text-center">
              <div class="w-12 h-12 bg-white/5 rounded-full mb-2 flex items-center justify-center">
                <div class="w-6 h-6 bg-[#f5a623] rounded-sm opacity-50"></div>
              </div>
              <span class="text-xs font-medium">{{set}}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- DECK BUILDER VIEW (Simplified Mock) -->
      <div v-if="currentView === 'decks'" class="space-y-6 animate-fade-in">
        <header class="flex justify-between items-end">
          <div>
            <h2 class="text-2xl font-bold">New Deck</h2>
            <p class="text-gray-500 text-sm">Standard Format • 60 Cards</p>
          </div>
          <button class="bg-[#f5a623] text-black px-4 py-2 rounded-lg font-bold text-sm">SAVE</button>
        </header>

        <section class="space-y-2">
          <div v-for="n in 4" :key="n" class="flex items-center gap-4 p-3 bg-[#21262d] rounded-xl border border-white/5">
            <div class="w-10 h-14 bg-gray-800 rounded"></div>
            <div class="flex-1">
              <div class="text-sm font-bold">Pokémon Name #00{{n}}</div>
              <div class="text-xs text-gray-500">Rare Holo • Evolution</div>
            </div>
            <div class="text-[#f5a623] font-bold">x4</div>
          </div>
        </section>
      </div>

    </main>

    <!-- Bottom Nav -->
    <nav class="fixed bottom-0 inset-x-0 bg-[#0d1117] border-t border-gray-800 p-4 flex justify-around items-center z-50">
       <button @click="currentView = 'dashboard'" :class="currentView === 'dashboard' ? 'text-[#f5a623]' : 'text-gray-500'">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
       </button>
       <button @click="currentView = 'search'" :class="currentView === 'search' ? 'text-[#f5a623]' : 'text-gray-500'">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/></svg>
       </button>
       <button @click="currentView = 'decks'" :class="currentView === 'decks' ? 'text-[#f5a623]' : 'text-gray-500'">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
       </button>
    </nav>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const currentView = ref('dashboard')
</script>

<style scoped>
.mock-dashboard {
  max-width: 480px;
  margin: 0 auto;
}
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
