<template>
  <section class="booth-section">
    <div class="booth-section-head">
      <h2>My wantlist</h2>
      <button class="btn btn-primary btn-sm" @click="openSearch">+ Add a want</button>
    </div>
    <p class="booth-section-sub">
      Cards &amp; sealed you're hunting. Scan any booth and matches light up instantly —
      even stock that's in a binder under the table.
    </p>

    <div v-if="!wants.length" class="empty-state">
      <p>Nothing on the list. Add the cards you're after — alt arts, set holes, a booster box —
      and every booth you scan gets checked against it.</p>
    </div>

    <div class="wl-items" v-else>
      <div v-for="(w, i) in wants" :key="w.id" class="wl-item card card-sm">
        <div class="wl-img">
          <img v-if="w.img" :src="w.img" :alt="w.name" loading="lazy" @error="$event.target.style.display='none'" />
          <span v-else aria-hidden="true">🎯</span>
        </div>
        <div class="wl-main">
          <div class="wl-name">{{ w.name }} <span v-if="w.type === 'sealed'" class="badge badge-info wl-sealed">Sealed</span></div>
          <div class="wl-sub">{{ [gameLabel(w.game), w.setName, w.number ? '#' + w.number : ''].filter(Boolean).join(' · ') }}</div>
        </div>
        <div class="wl-controls">
          <label class="wl-mini-label">Qty</label>
          <input type="number" min="1" class="input wl-qty" v-model.number="w.qty" @change="persist" />
          <label class="wl-mini-label">Max $</label>
          <input type="number" min="0" step="0.01" class="input wl-max" v-model.number="w.maxPrice" placeholder="any" @change="persist" />
          <button class="btn btn-ghost btn-icon" aria-label="Remove want" @click="removeWant(i)">✕</button>
        </div>
      </div>
    </div>

    <!-- Search cards + sealed across all games -->
    <div v-if="searchOpen" class="modal-overlay" @click.self="searchOpen = false">
      <div class="modal" style="max-width: 560px">
        <div class="modal-header">
          <h3>Add to wantlist</h3>
          <button class="btn btn-ghost btn-icon" @click="searchOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <form class="search-bar" @submit.prevent="runSearch">
            <input ref="searchInput" v-model="searchQuery" class="input" placeholder="Card or product — e.g. Surging Sparks booster box" />
            <button class="btn btn-primary btn-sm" type="submit" :disabled="searchBusy || searchQuery.trim().length < 2">
              {{ searchBusy ? '…' : 'Search' }}
            </button>
          </form>
          <div class="search-list">
            <div v-for="c in searchResults" :key="(c.sealed ? 's' : 'c') + c.game + c.id" class="wl-row">
              <img v-if="c.image" :src="c.image" class="wl-row-img" loading="lazy" @error="$event.target.style.display='none'" />
              <span v-else class="wl-row-img wl-row-noimg"><RbIcon name="card" :size="22" /></span>
              <span class="wl-row-name">
                {{ c.name }} <span v-if="c.sealed" class="badge badge-info wl-sealed">Sealed</span>
                <span class="wl-row-sub">{{ [gameLabel(c.game), c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="wl-row-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
              <button class="btn btn-primary btn-sm" :disabled="hasWant(c)" @click="addFromSearch(c)">{{ hasWant(c) ? '✓' : '+ Want' }}</button>
            </div>
            <p v-if="searchBusy" class="text-muted wl-msg">Searching cards and sealed across all games…</p>
            <p v-else-if="searched && !searchResults.length" class="text-muted wl-msg">No matches — try fewer words.</p>
            <p v-else-if="!searched" class="text-muted wl-msg">Singles come from the card database; sealed products (boxes, ETBs, decks) from the daily TCGplayer index.</p>
          </div>
        </div>
        <div class="modal-footer">
          <span v-if="addedFlash" class="badge badge-success">✓ Added to wantlist</span>
          <button class="btn btn-secondary" @click="searchOpen = false">Done</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import RbIcon from './icons/RbIcon.vue'
import { smartSearch } from '../utils/searchIntel'
import { loadWantlist, saveWantlist, generateWantId, wantKey } from '../utils/wantlist'

const emit = defineEmits(['changed'])

const wants = ref(loadWantlist())

const GAME_LABELS = {
  pokemon: 'Pokémon', mtg: 'Magic', yugioh: 'Yu-Gi-Oh!', lorcana: 'Lorcana',
  'one-piece': 'One Piece', riftbound: 'Riftbound',
}
function gameLabel(g) { return GAME_LABELS[g] || g }
function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function persist() {
  saveWantlist(wants.value)
  emit('changed', wants.value)
}

function removeWant(i) {
  wants.value.splice(i, 1)
  persist()
}

function hasWant(c) {
  const key = `${c.sealed ? 'sealed' : 'card'}:${c.game || ''}:${c.id || ''}`
  return wants.value.some(w => wantKey(w) === key)
}

// ── Search (cards via the live providers, sealed via the static index) ──
const searchOpen = ref(false)
const searchInput = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const searchBusy = ref(false)
const searched = ref(false)
const addedFlash = ref(false)

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

async function runSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) return
  searchBusy.value = true
  try {
    const { cards, sealed } = await smartSearch(q, { pageSize: 24, sealedLimit: 16 })
    searchResults.value = [...cards, ...sealed]
  } catch {
    searchResults.value = []
  } finally {
    searchBusy.value = false
    searched.value = true
  }
}

function addFromSearch(c) {
  if (hasWant(c)) return
  wants.value.unshift({
    id: generateWantId(),
    type: c.sealed ? 'sealed' : 'card',
    game: c.game || '',
    cardId: c.id || '',
    name: c.name || '',
    setName: c.set || '',
    number: c.number || '',
    img: c.image || '',
    qty: 1,
    maxPrice: 0,
    addedAt: new Date().toISOString(),
  })
  persist()
  addedFlash.value = true
  setTimeout(() => { addedFlash.value = false }, 1500)
}
</script>

<style scoped>
.booth-section { margin-top: 26px; }
.booth-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.booth-section-head h2 { font-size: 19px; font-weight: 900; letter-spacing: -0.01em; }
.booth-section-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }

.wl-items { display: flex; flex-direction: column; gap: 10px; }
.wl-item { display: flex; gap: 12px; align-items: center; padding: 10px 12px; flex-wrap: wrap; }
.wl-img { width: 44px; height: 58px; flex-shrink: 0; background: #fff; border: 1.5px solid var(--ink); border-radius: 7px; padding: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden; font-size: 20px; }
.wl-img img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
.wl-main { flex: 1; min-width: 140px; }
.wl-name { font-weight: 800; font-size: 14px; }
.wl-sub { font-size: 12px; color: var(--text-secondary); }
.wl-sealed { font-size: 9.5px; vertical-align: 2px; }
.wl-controls { display: flex; align-items: center; gap: 7px; }
.wl-mini-label { font-size: 10.5px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; }
.wl-qty { width: 62px; }
.wl-max { width: 84px; }

.search-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.search-bar .input { flex: 1; }
.search-list { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.wl-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border: 1.5px solid var(--border-subtle); border-radius: 10px;
  font-size: 13.5px;
}
.wl-row-img { width: 38px; height: 52px; object-fit: contain; border: 1.5px solid var(--ink); border-radius: 6px; background: #fff; flex-shrink: 0; }
.wl-row-noimg { display: inline-flex; align-items: center; justify-content: center; font-size: 20px; opacity: .4; }
.wl-row-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.wl-row-sub { display: block; font-size: 11.5px; color: var(--text-muted); font-weight: 600; }
.wl-row-price { font-weight: 800; font-size: 12.5px; white-space: nowrap; }
.wl-msg { font-size: 13px; text-align: center; padding: 16px 0; }
</style>
