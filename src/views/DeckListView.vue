<template>
  <div class="deck-list-view">
    <div class="deck-header">
      <div>
        <h2>Decks</h2>
        <p class="text-muted" style="font-size:13px;margin-top:2px">Build and track decks across all TCGs. Compare against your collection.</p>
      </div>
      <div class="deck-header-actions">
        <router-link to="/decks/meta" class="btn btn-secondary btn-sm"><RbIcon name="card" :size="14" /> Meta Decks</router-link>
        <button class="btn btn-primary btn-sm" @click="showNewDeck = true">+ New Deck</button>
      </div>
    </div>

    <!-- Game filter -->
    <div class="game-filter-bar" v-if="deckStore.decks.length > 0">
      <button
        v-for="g in gameFilters"
        :key="g.key"
        class="btn btn-sm"
        :class="g.key === activeGame ? 'btn-primary' : 'btn-ghost'"
        @click="activeGame = g.key"
      >{{ g.label }}</button>
    </div>

    <!-- Empty state -->
    <div v-if="filteredDecks.length === 0 && deckStore.decks.length === 0" class="empty-state">
      <div class="icon"><RbIcon name="card" :size="44" /></div>
      <span class="sticker">Fresh start</span>
      <h3>No decks yet</h3>
      <p>Create a deck from scratch or import a meta deck to get started.</p>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <button class="btn btn-primary" @click="showNewDeck = true">Create Deck</button>
        <router-link to="/decks/meta" class="btn btn-secondary">Browse Meta Decks</router-link>
      </div>
    </div>
    <div v-else-if="filteredDecks.length === 0" class="empty-state">
      <div class="icon"><RbIcon name="card" :size="44" /></div>
      <h3>No {{ gameLabel(activeGame) }} decks</h3>
      <button class="btn btn-primary mt-3" @click="showNewDeck = true">Create {{ gameLabel(activeGame) }} Deck</button>
    </div>

    <!-- Deck grid -->
    <div v-else class="deck-grid">
      <div
        v-for="deck in filteredDecks"
        :key="deck.id"
        class="deck-card"
        @click="router.push(`/decks/${deck.id}`)"
      >
        <div class="deck-card-delete" @click.stop="deleteDeck(deck)">
          <span class="delete-icon">✕</span>
        </div>
        <div class="deck-card-top">
          <div class="deck-card-name">{{ deck.name }}</div>
          <div class="deck-card-meta">
            <span class="badge badge-info">{{ gameLabel(deck.game) }}</span>
            <span class="deck-card-count">{{ deck.cards.length }} unique cards</span>
          </div>
        </div>
        <div class="deck-card-stats">
          <div class="deck-stat">
            <span class="deck-stat-label">Needed</span>
            <span class="deck-stat-val" :class="deckStats(deck.id)?.neededCards > 0 ? 'text-accent' : 'text-success'">
              {{ deckStats(deck.id)?.neededCards || 0 }}
            </span>
          </div>
          <div class="deck-stat">
            <span class="deck-stat-label">Owned</span>
            <span class="deck-stat-val text-success">{{ deckStats(deck.id)?.ownedCards || 0 }}</span>
          </div>
          <div class="deck-stat">
            <span class="deck-stat-label">Cost</span>
            <span class="deck-stat-val">${{ (deckStats(deck.id)?.totalCost || 0).toFixed(2) }}</span>
          </div>
        </div>
        <div class="deck-card-progress">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: (deckStats(deck.id)?.completionPct || 0) + '%' }" :class="deckStats(deck.id)?.isComplete ? 'complete' : ''"></div>
          </div>
          <span class="progress-label">{{ deckStats(deck.id)?.completionPct || 0 }}%</span>
        </div>
        <div class="deck-card-preview" v-if="deck.cards.length > 0">
          <img
            v-for="card in deck.cards.filter(c => c.image).slice(0, 5)"
            :key="card.cardId"
            :src="card.image"
            class="deck-preview-img"
            loading="lazy"
          />
          <span v-if="deck.cards.length > 5" class="deck-preview-more">+{{ deck.cards.length - 5 }}</span>
        </div>
      </div>
    </div>

    <!-- New deck modal -->
    <transition name="fade">
      <div v-if="showNewDeck" class="modal-overlay" @click.self="showNewDeck = false">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>New Deck</h3>
            <button class="btn btn-ghost btn-icon" @click="showNewDeck = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Deck Name</label>
              <input v-model="newDeckName" class="input" placeholder="e.g. Charizard ex" @keyup.enter="createDeck" ref="nameInput" />
            </div>
            <div class="form-group">
              <label class="form-label">TCG</label>
              <div class="tcg-selector">
                <button
                  v-for="g in tcgOptions"
                  :key="g.key"
                  class="btn btn-sm"
                  :class="g.key === newDeckGame ? 'btn-primary' : 'btn-ghost'"
                  @click="newDeckGame = g.key"
                >{{ g.label }}</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showNewDeck = false">Cancel</button>
            <button class="btn btn-primary" :disabled="!newDeckName.trim()" @click="createDeck">Create</button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import RbIcon from '../components/icons/RbIcon.vue'
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDeckStore } from '../stores/decks'

const deckStore = useDeckStore()
const router = useRouter()

const GAME_LABELS = {
  pokemon: 'Pokémon', mtg: 'MTG', lorcana: 'Lorcana',
  'one-piece': 'One Piece', riftbound: 'Riftbound', yugioh: 'Yu-Gi-Oh',
}

const GAME_KEYS = ['pokemon', 'mtg', 'lorcana', 'one-piece', 'riftbound', 'yugioh']

const tcgOptions = GAME_KEYS.map(k => ({ key: k, label: GAME_LABELS[k] }))

const gameFilters = computed(() => {
  const games = new Set()
  games.add('all')
  for (const d of deckStore.decks) {
    if (d.game) games.add(d.game)
  }
  return Array.from(games).map(g => ({
    key: g,
    label: g === 'all' ? 'All' : GAME_LABELS[g] || g,
  }))
})

const activeGame = ref('all')

const filteredDecks = computed(() => {
  if (activeGame.value === 'all') return deckStore.decks
  return deckStore.decks.filter(d => d.game === activeGame.value)
})

const showNewDeck = ref(false)
const newDeckName = ref('')
const newDeckGame = ref('pokemon')
const nameInput = ref(null)

function deckStats(deckId) {
  return deckStore.getDeckStats(deckId)
}

function gameLabel(game) {
  return GAME_LABELS[game] || game
}

function deleteDeck(deck) {
  const msg = `Delete "${deck.name}"? This cannot be undone.`
  if (!confirm(msg)) return
  deckStore.deleteDeck(deck.id)
}

function createDeck() {
  if (!newDeckName.value.trim()) return
  const deck = deckStore.createDeck(newDeckName.value.trim(), newDeckGame.value)
  newDeckName.value = ''
  newDeckGame.value = 'pokemon'
  showNewDeck.value = false
  router.push(`/decks/${deck.id}`)
}
</script>

<style scoped>
.deck-list-view { max-width: 1200px; margin: 0 auto; }

.deck-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.deck-header h2 { font-size: 22px; font-weight: 700; }
.deck-header-actions { display: flex; gap: 8px; }

.game-filter-bar { display: flex; gap: 4px; margin-bottom: 16px; flex-wrap: wrap; }

.deck-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.deck-card-count { font-size: 12px; color: var(--text-muted); }

.tcg-selector { display: flex; gap: 4px; flex-wrap: wrap; }

.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 16px;
}

.deck-card {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  padding: 16px;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.12s ease, transform 0.12s ease;
  cursor: pointer;
  position: relative;
}
.deck-card:hover {
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow);
  text-decoration: none;
}
.deck-card:active {
  transform: translate(1px, 1px);
  box-shadow: var(--shadow-pressed);
}

.deck-card-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-hover);
  border: 1.5px solid var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
  cursor: pointer;
  z-index: 2;
}
.deck-card:hover .deck-card-delete {
  opacity: 0.7;
}
.deck-card-delete:hover {
  opacity: 1 !important;
  background: var(--danger) !important;
}
.delete-icon {
  font-size: 12px;
  line-height: 1;
  color: var(--text-secondary);
}
.deck-card-delete:hover .delete-icon {
  color: #fff;
}

.deck-card-name { font-size: 16px; font-weight: 700; }
.deck-card-count { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.deck-card-stats { display: flex; gap: 20px; }
.deck-stat { display: flex; flex-direction: column; gap: 2px; }
.deck-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
.deck-stat-val { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }

.deck-card-progress { display: flex; align-items: center; gap: 8px; }
.progress-bar-bg {
  flex: 1;
  height: 10px;
  background: var(--bg-primary);
  border: 1.5px solid var(--ink);
  border-radius: 5px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--success);
  transition: width 0.3s;
}
.progress-bar-fill.complete { background: var(--success); }
.progress-label { font-size: 11px; color: var(--text-secondary); font-weight: 700; min-width: 32px; text-align: right; }

.deck-card-preview { display: flex; gap: 4px; align-items: center; }
.deck-preview-img { width: 30px; height: 42px; object-fit: contain; border-radius: 2px; }
.deck-preview-more { font-size: 11px; color: var(--text-muted); margin-left: 4px; }

@media (max-width: 640px) {
  .deck-header { flex-direction: column; gap: 12px; }
  .deck-header-actions { width: 100%; }
  .deck-header-actions .btn { flex: 1; justify-content: center; }
  .deck-grid { grid-template-columns: 1fr; }
}
</style>
