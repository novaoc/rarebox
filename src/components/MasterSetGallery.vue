<template>
  <div class="msg-panel">
      <!-- Header -->
      <div class="msg-header">
        <div class="msg-head-main">
          <h3 class="msg-title">{{ group.name }}</h3>
          <div class="msg-head-sub">
            {{ group.gameLabel }}<template v-if="cards.length"> · {{ ownedCount }}/{{ cards.length }} owned</template>
            <span v-if="needCount && !loading" class="msg-need-chip">{{ needCount }} still needed</span>
          </div>
        </div>
        <div class="msg-head-actions">
          <span v-if="foundToday" class="sticker msg-today">{{ foundToday }} found today 🎉</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="msg-filters">
        <button v-for="f in filters" :key="f.id" class="msg-filter-btn" :class="{ active: filter === f.id }" @click="filter = f.id">
          {{ f.label }} <span class="msg-filter-count">{{ f.count }}</span>
        </button>
      </div>

      <!-- Grid -->
      <div class="msg-grid-wrap">
        <div v-if="loading" class="msg-loading">Fetching the full set…</div>
        <div v-else-if="error" class="msg-error">{{ error }}</div>
        <template v-else>
          <p v-if="needCount" class="msg-hint">Tap a card you don't own to mark it as found — then add your finds to the shelf below.</p>
          <div class="msg-grid">
          <div
            v-for="card in visibleCards"
            :key="card.id"
            class="msg-card"
            :class="{ need: !owned.has(card.id) && !marks[card.id], got: marks[card.id] }"
            @click="tapCard(card)"
          >
            <div class="msg-img-wrap">
              <img v-if="card.images?.small" :src="card.images.small" :alt="card.name" loading="lazy" class="msg-img" />
              <div v-else class="msg-img-ph">{{ card.number }}</div>
              <span v-if="!owned.has(card.id) && !marks[card.id]" class="msg-tag msg-tag-need">NOT OWNED</span>
              <span v-else-if="marks[card.id]" class="msg-tag msg-tag-got">FOUND ✓</span>
            </div>
            <div class="msg-card-name">{{ card.name }}</div>
            <div class="msg-card-num">#{{ card.number }}</div>
          </div>
          </div>
        </template>
      </div>

      <!-- Footer: promote the day's finds to the shelf -->
      <div v-if="markedCards.length" class="msg-footer">
        <span class="msg-footer-note">{{ markedCards.length }} found — adding sets today's date as the purchase date</span>
        <button class="btn btn-primary" :disabled="adding" @click="addFound">{{ adding ? 'Adding…' : `Add ${markedCards.length} to shelf` }}</button>
      </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchSetCards, sortByNumber } from '../utils/masterSets'

const props = defineProps({
  group: { type: Object, required: true }, // { key, name, game, gameLabel, setId, lang, items, hunt }
  marks: { type: Object, default: () => ({}) }, // { cardId: ts }
})
const emit = defineEmits(['close', 'toggle-mark', 'add-found'])

const cards = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('all')
const adding = ref(false)

const owned = computed(() => new Set((props.group.items || []).map(i => i.cardId)))
const ownedCount = computed(() => cards.value.filter(c => owned.value.has(c.id)).length)
const needCount = computed(() => cards.value.filter(c => !owned.value.has(c.id) && !props.marks[c.id]).length)
const markedCards = computed(() => cards.value.filter(c => props.marks[c.id]))
const foundToday = computed(() => {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  return Object.values(props.marks).filter(ts => ts >= dayStart.getTime()).length
})

// Owned tab dropped — the header already shows "N/M owned"
const filters = computed(() => [
  { id: 'need', label: 'Not owned', count: needCount.value + markedCards.value.length },
  { id: 'all', label: 'All cards', count: cards.value.length },
])

const visibleCards = computed(() => {
  if (filter.value === 'owned') return cards.value.filter(c => owned.value.has(c.id))
  if (filter.value === 'need') return cards.value.filter(c => !owned.value.has(c.id))
  return cards.value
})

function tapCard(card) {
  // Owned cards are for admiring; missing ones toggle the GOT IT mark
  if (owned.value.has(card.id)) return
  emit('toggle-mark', card.id)
}

async function addFound() {
  adding.value = true
  emit('add-found', markedCards.value)
}

onMounted(async () => {
  try {
    const list = await fetchSetCards({
      game: props.group.game,
      setId: props.group.setId,
      setName: props.group.name,
      lang: props.group.lang,
    })
    cards.value = sortByNumber(list)
    if (!cards.value.length) error.value = 'No card list available for this set.'
    // Incomplete sets open straight to the cards you DON'T own — that's
    // the hunting list. Complete sets open on All (nothing to hunt).
    if (cards.value.some(c => !owned.value.has(c.id))) filter.value = 'need'
  } catch {
    error.value = navigator.onLine
      ? 'Could not load the set list — try again.'
      : 'Offline and this set list isn\'t cached yet — open it once online and it works offline after.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* Inline accordion panel — sits in the document flow right under its
   master-set stack and pushes the page down, rather than floating. The
   grid scrolls inside the panel so a 250-card set doesn't run forever. */
.msg-panel {
  display: flex;
  flex-direction: column;
  max-height: 78vh;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  animation: msg-open 0.22s ease;
}
@keyframes msg-open {
  from { opacity: 0; transform: translateY(-6px); max-height: 0; }
  to { opacity: 1; transform: translateY(0); }
}
.msg-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 10px;
}
.msg-title { font-size: 18px; font-weight: 800; }
.msg-head-sub { font-size: 12.5px; color: var(--text-secondary); font-weight: 600; margin-top: 2px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.msg-need-chip {
  font-size: 11px; font-weight: 800;
  padding: 2px 8px;
  background: var(--pink-dim);
  border: 1.5px solid var(--ink);
  border-radius: 99px;
}
.msg-head-actions { display: flex; align-items: center; gap: 10px; }
.msg-today { font-size: 10.5px; }

.msg-filters { display: flex; gap: 8px; padding: 0 18px 12px; }
.msg-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 700;
  font-family: inherit;
  color: var(--ink);
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: 99px;
  box-shadow: var(--shadow-pressed);
  cursor: pointer;
  transition: background 0.12s, box-shadow 0.1s, transform 0.1s;
}
.msg-filter-btn:hover { background: var(--bg-hover); }
.msg-filter-btn:active { box-shadow: none; transform: translate(1px, 1px); }
.msg-filter-btn.active { background: var(--accent); color: var(--on-accent); }
.msg-filter-count {
  font-size: 11px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.msg-filter-btn.active .msg-filter-count { background: rgba(20, 20, 20, 0.15); color: var(--on-accent); }

.msg-grid-wrap { overflow-y: auto; padding: 4px 18px 18px; flex: 1; }
.msg-hint { font-size: 12px; color: var(--text-secondary); font-weight: 600; margin: 0 0 12px; }
.msg-loading, .msg-error { padding: 40px 0; text-align: center; color: var(--text-secondary); font-weight: 600; font-size: 13.5px; }
.msg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 12px;
}
.msg-card { cursor: default; }
.msg-card.need, .msg-card.got { cursor: pointer; }
.msg-img-wrap {
  position: relative;
  border: 2px solid var(--ink);
  border-radius: 9px;
  overflow: hidden;
  aspect-ratio: 63 / 88;
  background: var(--bg-secondary);
}
.msg-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.msg-img-ph { display: flex; align-items: center; justify-content: center; height: 100%; font-weight: 800; color: var(--text-muted); }

/* Missing cards sit in shadow until you find them */
.msg-card.need .msg-img { filter: grayscale(1) brightness(0.72); opacity: 0.75; }
.msg-card.need .msg-img-wrap { border-style: dashed; }
.msg-card.need:hover .msg-img { filter: grayscale(0.6) brightness(0.85); }
.msg-card.got .msg-img-wrap { border-color: var(--accent-text); box-shadow: 0 0 0 2px var(--accent); }

.msg-tag {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%) rotate(-4deg);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border: 1.5px solid var(--ink);
  border-radius: 6px;
  box-shadow: var(--shadow-pressed);
  white-space: nowrap;
}
.msg-tag-need { background: var(--bg-card); color: var(--text-secondary); }
.msg-tag-got { background: var(--accent); color: var(--on-accent); }

.msg-card-name { font-size: 10.5px; font-weight: 700; margin-top: 5px; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.msg-card-num { font-size: 9.5px; color: var(--text-muted); font-weight: 700; }

.msg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-top: var(--bw) solid var(--ink);
  background: var(--bg-card);
}
.msg-footer-note { font-size: 12px; color: var(--text-secondary); font-weight: 600; }

@media (max-width: 640px) {
  .msg-panel { max-height: 82vh; }
  .msg-grid { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 9px; }
}
</style>
