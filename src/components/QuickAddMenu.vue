<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'

const router = useRouter()
const portfolioStore = usePortfolioStore()

const isOpen = ref(false)
const menuRef = ref(null)

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const closeMenu = () => {
  isOpen.value = false
}

const navigateAndClose = (routeName, params = {}) => {
  router.push({ name: routeName, params })
  closeMenu()
}

const handleClickOutside = (event) => {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="quick-add-container" ref="menuRef">
    <!-- Floating Action Button -->
    <button 
      class="fab-button" 
      :class="{ 'is-active': isOpen }"
      @click="toggleMenu"
      aria-label="Quick Actions"
    >
      <span class="icon">{{ isOpen ? '×' : '+' }}</span>
    </button>

    <!-- Quick Menu -->
    <Transition name="slide-up">
      <div v-if="isOpen" class="quick-menu">
        <div class="menu-header">Quick Actions</div>
        
        <button class="menu-item" @click="navigateAndClose('Search')">
          <span class="menu-icon">🔍</span>
          <div class="menu-text">
            <span class="menu-label">Search & Add Cards</span>
            <span class="menu-sublabel">Find any card to add</span>
          </div>
        </button>

        <button class="menu-item" @click="navigateAndClose('Sets')">
          <span class="menu-icon">📦</span>
          <div class="menu-text">
            <span class="menu-label">Browse Sets</span>
            <span class="menu-sublabel">Add from specific sets</span>
          </div>
        </button>

        <button class="menu-item" @click="navigateAndClose('Portfolio', { id: portfolioStore.activePortfolioId })">
          <span class="menu-icon">📈</span>
          <div class="menu-text">
            <span class="menu-label">My Collection</span>
            <span class="menu-sublabel">Manage your items</span>
          </div>
        </button>

        <button class="menu-item" @click="navigateAndClose('DeckBuilder', { id: 'new' })">
          <span class="menu-icon">🎴</span>
          <div class="menu-text">
            <span class="menu-label">New Deck</span>
            <span class="menu-sublabel">Start a new deck list</span>
          </div>
        </button>
      </div>
    </Transition>

    <!-- Overlay backdrop when open -->
    <div v-if="isOpen" class="menu-overlay" @click="closeMenu"></div>
  </div>
</template>

<style scoped>
.quick-add-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}

.fab-button {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: #f5a623;
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1002;
  position: relative;
}

.fab-button:active {
  transform: scale(0.9);
}

.fab-button.is-active {
  background: #333;
  transform: rotate(90deg);
}

.fab-button .icon {
  font-size: 32px;
  line-height: 1;
  margin-top: -2px;
}

.quick-menu {
  position: absolute;
  bottom: 72px;
  right: 0;
  width: 260px;
  background: #1a1a1a;
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid #333;
  z-index: 1001;
  overflow: hidden;
}

.menu-header {
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: white;
  text-align: left;
  cursor: pointer;
  border-radius: 12px;
  transition: background 0.2s;
}

.menu-item:hover, .menu-item:active {
  background: #333;
}

.menu-icon {
  font-size: 20px;
  margin-right: 16px;
  width: 24px;
  text-align: center;
}

.menu-text {
  display: flex;
  flex-direction: column;
}

.menu-label {
  font-size: 15px;
  font-weight: 600;
  color: #eee;
}

.menu-sublabel {
  font-size: 12px;
  color: #888;
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 999;
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .quick-add-container {
    bottom: 80px; /* Stay above bottom navigation if any */
    right: 16px;
  }
}
</style>
