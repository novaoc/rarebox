<template>
  <div class="mock-dashboard min-h-screen text-white font-sans" style="background-color: #0d1117;">
    <!-- Top Header -->
    <header class="p-4 flex justify-between items-center border-b border-gray-800">
      <h1 class="text-xl font-bold italic" style="color: #f5a623;">RAREBOX</h1>
      <div class="w-8 h-8 rounded-full bg-gray-700"></div>
    </header>

    <main class="p-4 space-y-6">
      <!-- Glassmorphism Portfolio Card -->
      <section class="relative overflow-hidden rounded-2xl p-6 border border-white/10 shadow-xl" 
               style="background: linear-gradient(135deg, rgba(33, 38, 45, 0.7) 0%, rgba(33, 38, 45, 0.4) 100%); backdrop-filter: blur(10px);">
        <div class="text-sm text-gray-400 mb-1">Portfolio Value</div>
        <div class="text-3xl font-bold tracking-tight">$11,694.78</div>
        <div class="text-sm font-medium mt-1 text-green-400">+$42.50 today</div>
        
        <!-- Decorative Circle -->
        <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20" style="background-color: #f5a623;"></div>
      </section>

      <!-- Portfolio Chart (Mock SVG) -->
      <section class="rounded-xl p-4 bg-[#21262d]">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Performance</h2>
          <span class="text-xs text-gray-500">7D</span>
        </div>
        <div class="h-32 w-full flex items-end justify-between px-2">
           <svg viewBox="0 0 400 100" class="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f5a623" stop-opacity="0.3" />
                <stop offset="100%" stop-color="#f5a623" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,80 Q50,70 100,85 T200,60 T300,40 T400,20 L400,100 L0,100 Z" fill="url(#chartGradient)" />
            <path d="M0,80 Q50,70 100,85 T200,60 T300,40 T400,20" fill="none" stroke="#f5a623" stroke-width="3" stroke-linecap="round" />
            <circle cx="400" cy="20" r="4" fill="#f5a623" />
          </svg>
        </div>
      </section>

      <!-- 3x3 Binder Grid -->
      <section>
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">Main Binder</h2>
        <div class="grid grid-cols-3 gap-3">
          <div v-for="i in 9" :key="i" class="aspect-[2.5/3.5] rounded-lg bg-[#21262d] border border-white/5 flex items-center justify-center overflow-hidden group relative">
            <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="w-12 h-16 bg-gray-700/50 rounded flex items-center justify-center text-gray-600">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
            </div>
          </div>
        </div>
      </section>
    </main>
    
    <!-- Mobile Bottom Nav -->
    <nav class="fixed bottom-0 inset-x-0 bg-[#0d1117] border-t border-gray-800 p-4 flex justify-around items-center">
       <div class="w-6 h-6 text-[#f5a623]">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
       </div>
       <div class="w-6 h-6 text-gray-500">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/></svg>
       </div>
       <div class="w-6 h-6 text-gray-500">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
       </div>
    </nav>
  </div>
</template>

<script setup>
// Static Mockup Component
</script>

<style scoped>
.mock-dashboard {
  max-width: 480px;
  margin: 0 auto;
}
</style>
