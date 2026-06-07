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
      
      <!-- VIEW: DASHBOARD -->
      <div v-if="currentView === 'dashboard'" class="space-y-6">
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
          <div class="text-3xl font-bold tracking-tight">$11,694.78</div>
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
              <div class="w-full h-full bg-gray-800 animate-pulse rounded-lg" v-if="i > 3"></div>
              <div class="text-[10px] absolute bottom-1 right-1 bg-black/60 px-1 rounded" v-if="i <= 3">NM</div>
            </div>
          </div>
        </section>
      </div>

      <!-- VIEW: SCANNER / OCR -->
      <div v-if="currentView === 'scanner'" class="fixed inset-0 z-50 bg-black flex flex-col">
        <div class="relative flex-1">
          <!-- Mock Camera Feed -->
          <div class="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <div class="text-gray-500 text-sm">Camera Feed Active...</div>
            <!-- Frame Guide -->
            <div class="w-64 h-80 border-2 border-[#f5a623] rounded-lg relative">
              <div class="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white"></div>
              <div class="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white"></div>
              <div class="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white"></div>
              <div class="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white"></div>
              <div class="absolute inset-0 bg-[#f5a623]/10 animate-pulse"></div>
            </div>
          </div>
          
          <button @click="currentView = 'dashboard'" class="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white min-h-[44px]">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <!-- Real-time Recognition Overlay -->
          <div class="absolute bottom-20 inset-x-4">
             <div class="bg-[#21262d]/90 backdrop-blur p-4 rounded-xl border border-white/10 flex items-center gap-4">
                <div class="w-12 h-16 bg-gray-700 rounded shadow-lg"></div>
                <div>
                   <div class="text-xs text-[#f5a623] font-bold uppercase tracking-widest">Identifying...</div>
                   <div class="text-sm font-bold">Umbreon VMAX (Alt Art)</div>
                   <div class="text-xs text-gray-400">Evolving Skies • #215/203</div>
                </div>
                <div class="ml-auto text-right">
                   <div class="text-sm font-bold">$642.50</div>
                   <div class="text-[10px] text-green-400">+1.2%</div>
                </div>
             </div>
          </div>
        </div>
        
        <!-- Scanner Controls -->
        <div class="bg-[#0d1117] p-6 border-t border-gray-800 flex justify-between items-center">
           <button class="flex flex-col items-center gap-1 opacity-50">
             <div class="w-6 h-6 bg-white/20 rounded"></div>
             <span class="text-[10px]">Flash</span>
           </button>
           <button class="w-16 h-16 rounded-full border-4 border-white p-1">
             <div class="w-full h-full bg-[#f5a623] rounded-full shadow-lg shadow-[#f5a623]/20"></div>
           </button>
           <button @click="currentView = 'trade'" class="flex flex-col items-center gap-1">
             <div class="w-6 h-6 text-[#f5a623]">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>
             </div>
             <span class="text-[10px] text-[#f5a623]">Trade</span>
           </button>
        </div>
      </div>

    </main>

    <!-- MODAL: ADD CARD/SEALED -->
    <div v-if="showAddModal" class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
       <div class="w-full max-w-md bg-[#161b22] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up">
          <div class="flex justify-between items-center mb-6">
             <h2 class="text-xl font-bold">Add to Collection</h2>
             <button @click="showAddModal = false" class="p-2 min-h-[44px]">Close</button>
          </div>
          
          <div class="space-y-4">
             <button class="w-full p-4 rounded-xl bg-[#21262d] border border-white/5 flex items-center gap-4 hover:bg-[#30363d] transition-colors min-h-[64px]">
                <div class="p-2 bg-[#f5a623]/20 rounded-lg text-[#f5a623]">
                   <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"></path></svg>
                </div>
                <div class="text-left">
                   <div class="font-bold">Individual Card</div>
                   <div class="text-xs text-gray-400">Scan or search single cards</div>
                </div>
             </button>
             
             <button class="w-full p-4 rounded-xl bg-[#21262d] border border-white/5 flex items-center gap-4 hover:bg-[#30363d] transition-colors min-h-[64px]">
                <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                   <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1h2V3zm-4 1a1 1 0 100 2h6a1 1 0 100-2H7zm-5 8v3a1 1 0 001 1h12a1 1 0 001-1v-3H2zm14-1V8a1 1 0 00-1-1H5a1 1 0 00-1 1v3h12z"></path></svg>
                </div>
                <div class="text-left">
                   <div class="font-bold">Sealed Product</div>
                   <div class="text-xs text-gray-400">Booster boxes, ETBs, Decks</div>
                </div>
             </button>
          </div>
          
          <div class="mt-8 pt-6 border-t border-gray-800 grid grid-cols-2 gap-4">
             <div class="space-y-1">
                <label class="text-[10px] uppercase text-gray-500 font-bold">Condition</label>
                <select class="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-sm min-h-[44px]">
                   <option>Near Mint (NM)</option>
                   <option>Lightly Played (LP)</option>
                   <option>Graded (Slab)</option>
                </select>
             </div>
             <div class="space-y-1">
                <label class="text-[10px] uppercase text-gray-500 font-bold">Grading Co.</label>
                <select class="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-sm min-h-[44px]">
                   <option>None (Raw)</option>
                   <option>PSA</option>
                   <option>BGS</option>
                   <option>CGC</option>
                </select>
             </div>
          </div>
       </div>
    </div>

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
import { ref } from 'vue'

const currentView = ref('dashboard')
const activeTCG = ref('All')
const showAddModal = ref(false)
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
