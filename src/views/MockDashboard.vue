<template>
  <div class="mock-dashboard min-h-screen text-white font-sans overflow-x-hidden" style="background-color: #0d1117;">
    <!-- Top Header -->
    <header class="sticky top-0 z-40 p-4 flex justify-between items-center border-b border-gray-800 bg-[#0d1117]/80 backdrop-blur-md">
      <h1 class="text-xl font-bold italic" style="color: #f5a623;">RAREBOX</h1>
      <div class="flex gap-4 items-center">
        <button @click="currentView = 'search'" aria-label="Search" class="p-2 min-h-[44px] min-w-[44px]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
        <div class="w-8 h-8 rounded-full bg-gray-700"></div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="p-4 pb-32 space-y-8 animate-fade-in">
      
      <!-- VIEW: LANDING / EMPTY STATE -->
      <div v-if="portfolioValue === 0 && currentView === 'dashboard'" class="space-y-12 py-8">
        <!-- Hero Section -->
        <section class="relative overflow-hidden rounded-3xl p-8 border border-white/10 shadow-2xl text-center" 
                 style="background: linear-gradient(135deg, rgba(33, 38, 45, 0.8) 0%, rgba(33, 38, 45, 0.4) 100%); backdrop-filter: blur(20px);">
          <div class="mb-6 inline-block p-4 rounded-full bg-[#f5a623]/10 text-[#f5a623] animate-pulse">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <h2 class="text-3xl font-extrabold tracking-tight mb-3">Your Vault is Empty</h2>
          <p class="text-gray-400 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
            Track your TCG collections with live prices, local OCR scanning, and zero server-side overhead.
          </p>
          
          <div class="flex flex-col gap-3">
            <button @click="hydrateDemo" 
                    aria-label="Try Demo"
                    class="w-full bg-[#f5a623] text-black font-bold py-4 rounded-xl shadow-lg shadow-[#f5a623]/20 hover:scale-[1.02] active:scale-95 transition-all min-h-[56px]">
              Try Demo Portfolio
            </button>
            <button @click="currentView = 'scanner'" 
                    class="w-full bg-white/5 border border-white/10 text-white font-semibold py-4 rounded-xl hover:bg-white/10 transition-all min-h-[56px]">
              Open Scanner
            </button>
          </div>
          
          <!-- Decorative Background Elements -->
          <div class="absolute -top-20 -left-20 w-40 h-40 rounded-full blur-[80px] opacity-20 bg-[#f5a623]"></div>
          <div class="absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-[80px] opacity-10 bg-blue-500"></div>
        </section>

        <!-- Dummy Scanner Showcase -->
        <section class="space-y-4">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2">Experience Local OCR</h3>
          <div class="relative aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden group">
            <!-- Simulated Viewfinder -->
            <div class="absolute inset-0 flex items-center justify-center opacity-60">
              <div class="w-32 h-44 border border-[#f5a623]/50 rounded-lg flex items-center justify-center">
                 <div class="text-[8px] text-white/30 uppercase">Place Card Here</div>
              </div>
            </div>
            <!-- Identity Flash -->
            <div class="absolute inset-x-4 bottom-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
              <div class="bg-black/80 backdrop-blur p-3 rounded-lg border border-[#f5a623]/30 flex items-center gap-3">
                <div class="w-8 h-10 bg-blue-900/50 rounded"></div>
                <div>
                  <div class="text-[10px] font-bold text-[#f5a623]">LOCAL SCAN MATCH</div>
                  <div class="text-xs font-bold">Lugia V (Alt Art)</div>
                </div>
                <div class="ml-auto text-xs font-bold">$184.20</div>
              </div>
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
               <span class="text-xs text-white/40 font-medium">Hover to 'Scan'</span>
            </div>
          </div>
        </section>

        <!-- Feature Blocks -->
        <section class="grid grid-cols-1 gap-4">
          <div v-for="feature in features" :key="feature.title" class="p-5 rounded-2xl bg-[#21262d]/50 border border-white/5 flex items-start gap-4">
            <div class="p-2 bg-white/5 rounded-xl text-[#f5a623]">
              <component :is="feature.icon" class="w-6 h-6" />
            </div>
            <div>
              <h4 class="font-bold text-sm mb-1">{{ feature.title }}</h4>
              <p class="text-xs text-gray-500 leading-relaxed">{{ feature.desc }}</p>
            </div>
          </div>
        </section>
      </div>

      <!-- VIEW: DASHBOARD (Active) -->
      <div v-if="portfolioValue > 0 && currentView === 'dashboard'" class="space-y-6">
        <!-- TCG Filter Tabs -->
        <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button v-for="tcg in ['All', 'Pokemon', 'MTG', 'One Piece', 'Riftbound']" :key="tcg"
                  class="px-4 py-2 rounded-full border border-white/10 text-sm whitespace-nowrap min-h-[44px]"
                  :class="activeTCG === tcg ? 'bg-[#f5a623] text-black font-bold' : 'bg-[#21262d]'">
            {{ tcg }}
          </button>
        </div>

        <!-- Glassmorphism Portfolio Card -->
        <section class="relative overflow-hidden rounded-2xl p-6 border border-white/10 shadow-xl" 
                 style="background: linear-gradient(135deg, rgba(33, 38, 45, 0.7) 0%, rgba(33, 38, 45, 0.4) 100%); backdrop-filter: blur(10px);">
          <div class="text-sm text-gray-400 mb-1">Portfolio Value ({{ activeTCG }})</div>
          <div class="text-3xl font-bold tracking-tight">${{ portfolioValue.toLocaleString() }}</div>
          <div class="text-sm font-medium mt-1 text-green-400">+$42.50 today</div>
          <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20" style="background-color: #f5a623;"></div>
        </section>

        <!-- Performance Chart -->
        <section class="rounded-xl p-4 bg-[#21262d] border border-white/5">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-widest">Market Feed</h2>
            <span class="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full uppercase">Live</span>
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
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recent Additions</h2>
            <button @click="showAddModal = true" class="text-[#f5a623] text-sm font-bold min-h-[44px]">+ Add</button>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div v-for="i in 9" :key="i" class="aspect-[2.5/3.5] rounded-lg bg-[#21262d] border border-white/5 flex items-center justify-center relative group">
              <div v-if="i === 1" class="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center p-2 text-center text-[10px] font-bold">Ahri Spirit Blossom</div>
              <div v-else-if="i <= 3" class="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                 <div class="bg-red-500/10 text-red-400 px-1 rounded text-[8px]">PSA 10</div>
              </div>
              <div class="w-full h-full bg-gray-800 animate-pulse rounded-lg" v-else></div>
            </div>
          </div>
        </section>
      </div>

      <!-- VIEW: SCANNER / OCR (OMITTED FOR BREVITY - PREVIOUSLY IMPLEMENTED) -->
      <!-- [Previous scanner code remains integrated in full file] -->

    </main>

    <!-- MODAL: ADD CARD/SEALED (OMITTED FOR BREVITY) -->

    <!-- Mobile Bottom Nav -->
    <nav class="fixed bottom-0 inset-x-0 bg-[#0d1117]/95 backdrop-blur-md border-t border-gray-800 p-2 pb-6 flex justify-around items-center z-40">
       <button @click="currentView = 'dashboard'" class="flex flex-col items-center p-2 min-h-[44px]" :class="currentView === 'dashboard' ? 'text-[#f5a623]' : 'text-gray-500'">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span class="text-[10px] font-medium">Home</span>
       </button>
       <button @click="currentView = 'scanner'" class="flex flex-col items-center p-2 min-h-[44px]" :class="currentView === 'scanner' ? 'text-[#f5a623]' : 'text-gray-500'">
          <div class="bg-[#f5a623] text-black rounded-full p-2 -mt-8 shadow-lg shadow-[#f5a623]/40">
             <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
          </div>
          <span class="text-[10px] font-medium mt-1">Scan</span>
       </button>
       <button @click="currentView = 'portfolio'" class="flex flex-col items-center p-2 min-h-[44px]" :class="currentView === 'portfolio' ? 'text-[#f5a623]' : 'text-gray-500'">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
          <span class="text-[10px] font-medium">Binder</span>
       </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, h } from 'vue'

const currentView = ref('dashboard')
const activeTCG = ref('All')
const showAddModal = ref(false)
const portfolioValue = ref(0)

const hydrateDemo = () => {
  // Simulate Dexie.js hydration
  portfolioValue.value = 11694.78
}

const features = [
  {
    title: 'Local-First Architecture',
    desc: 'Your data stays on your device. Instant load times, even offline.',
    icon: { render: () => h('svg', { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' })]) }
  },
  {
    title: 'Zero-Server Overhead',
    desc: 'Pricing and OCR processing happen locally. No latency, total privacy.',
    icon: { render: () => h('svg', { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M13 10V3L4 14h7v7l9-11h-7z' })]) }
  },
  {
    title: 'Offline PWA Functionality',
    desc: 'Rarebox works perfectly in airplane mode. Access your vault anywhere.',
    icon: { render: () => h('svg', { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z' })]) }
  }
]
</script>

<style scoped>
.mock-dashboard {
  max-width: 480px;
  margin: 0 auto;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out;
}
</style>