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
          <span v-if="foundToday" class="sticker msg-today">{{ foundToday }} found today <RbIcon name="confetti" :size="13" /></span>
          <!-- Session-only density: component-instance state. Resets when gallery
               is hidden/unmounted/reopened (parent v-if). No Pinia/Dexie/localStorage. -->
          <button
            type="button"
            class="msg-density-toggle"
            :aria-pressed="compact ? 'true' : 'false'"
            :aria-label="compact ? 'Switch to comfortable layout' : 'Switch to compact layout'"
            :disabled="loading"
            @click="compact = !compact"
          >
            {{ compact ? 'Comfortable' : 'Compact' }}
          </button>
          <button
            v-if="needCount && !loading"
            type="button"
            class="btn btn-secondary msg-iso-btn"
            :disabled="isoDone"
            @click="isoTheRest"
          >
            {{ isoDone ? '✓ On your wantlist' : `🎯 ISO the rest (${needCount})` }}
          </button>
        </div>
      </div>

      <!-- Filters — only when there's actually something to filter (i.e.
           you don't own the whole set yet) -->
      <div v-if="!loading && hasUnowned" class="msg-filters">
        <button
          v-for="f in filters"
          :key="f.id"
          type="button"
          class="msg-filter-btn"
          :class="{ active: filter === f.id }"
          :aria-pressed="filter === f.id ? 'true' : 'false'"
          @click="filter = f.id"
        >
          {{ f.label }} <span class="msg-filter-count">{{ f.count }}</span>
        </button>
      </div>

      <!-- Grid -->
      <div class="msg-grid-wrap">
        <div v-if="loading" class="msg-loading">Fetching the full set…</div>
        <div v-else-if="error" class="msg-error">{{ error }}</div>
        <template v-else>
          <p v-if="needCount" class="msg-hint">
            {{ compact
              ? 'Tap a number you don\'t own to mark it found — preview via the magnifier. Add finds below.'
              : 'Tap a card you don\'t own to mark it as found — then add your finds to the shelf below.' }}
          </p>

          <!-- Comfortable (default): image grid -->
          <div v-if="!compact" class="msg-grid">
            <div
              v-for="card in visibleCards"
              :key="card.id"
              class="msg-card"
              :class="{ need: !isOwned(card) && !marks[card.id], got: marks[card.id] && !isOwned(card) }"
              @click="tapCard(card)"
            >
              <div class="msg-img-wrap">
                <img v-if="card.images?.small" :src="card.images.small" :alt="card.name" loading="lazy" class="msg-img" />
                <div v-else class="msg-img-ph">{{ card.number }}</div>
                <span v-if="!isOwned(card) && !marks[card.id]" class="msg-tag msg-tag-need">NOT OWNED</span>
                <span v-else-if="marks[card.id] && !isOwned(card)" class="msg-tag msg-tag-got">FOUND ✓</span>
              </div>
              <div class="msg-card-name">{{ card.name }}</div>
              <div class="msg-card-num">#{{ card.number }}</div>
              <!-- Owned cards enlarge on tap; not-owned tap marks found, so
                   they get an explicit button to show the card to a vendor -->
              <button
                v-if="!isOwned(card)"
                type="button"
                class="msg-enlarge"
                @click.stop="preview = card"
              ><RbIcon name="magnifier" :size="13" /> Show bigger</button>
            </div>
          </div>

          <!-- Compact: number-first cells from the same canonical visibleCards
               only — never synthetic 1..setSize placeholders. No extra fetch. -->
          <div v-else class="msg-grid msg-grid-compact" data-msg-compact-grid>
            <div
              v-for="card in visibleCards"
              :key="card.id"
              class="msg-compact-item"
              :class="{
                need: !isOwned(card) && !marks[card.id],
                got: marks[card.id] && !isOwned(card),
                owned: isOwned(card),
              }"
            >
              <button
                type="button"
                class="msg-compact-primary"
                :aria-label="compactPrimaryLabel(card)"
                :aria-pressed="isOwned(card) ? undefined : (marks[card.id] ? 'true' : 'false')"
                @click="tapCard(card)"
              >
                <span class="msg-compact-num" :title="card.number != null && card.number !== '' ? `#${card.number}` : undefined">#{{ card.number }}</span>
                <span class="msg-compact-name" :title="card.name || undefined">{{ card.name }}</span>
                <span
                  class="msg-compact-status"
                  :class="{
                    'is-owned': isOwned(card),
                    'is-need': !isOwned(card) && !marks[card.id],
                    'is-found': marks[card.id] && !isOwned(card),
                  }"
                >{{ compactStatusLabel(card) }}</span>
              </button>
              <!-- Missing preview: separate non-overlapping ≥44px control.
                   Label text hides at narrow widths (icon-only); aria-label stays. -->
              <button
                v-if="!isOwned(card)"
                type="button"
                class="msg-compact-preview"
                :aria-label="`Preview ${card.name || 'card'} #${card.number || ''}`"
                @click="preview = card"
              >
                <RbIcon name="magnifier" :size="16" />
                <span class="msg-compact-preview-txt">View</span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer: promote the day's finds to the shelf -->
      <div v-if="markedCards.length" class="msg-footer">
        <span class="msg-footer-note">{{ markedCards.length }} found — adding sets today's date as the purchase date</span>
        <button type="button" class="btn btn-primary msg-add-found-btn" :disabled="adding" @click="addFound">{{ adding ? 'Adding…' : `Add ${markedCards.length} to shelf` }}</button>
      </div>

    <!-- Card preview lightbox — big enough to show a vendor. Swipe (or
         arrow keys / chevrons) pages through the rest of the same list,
         so a vendor can flip through every card you still need -->
    <Teleport to="body">
      <div
        v-if="preview"
        class="msg-preview"
        @click="closePreview"
        @touchstart.passive="onPreviewTouchStart"
        @touchend.passive="onPreviewTouchEnd"
      >
        <button v-if="previewList.length > 1" type="button" class="msg-preview-nav msg-preview-nav-prev" @click.stop="previewStep(-1)" aria-label="Previous card">‹</button>
        <div class="msg-preview-inner" @click.stop>
          <transition :name="slideDir < 0 ? 'msg-slide-r' : 'msg-slide-l'" mode="out-in">
            <img :key="preview.id" :src="preview.images?.large || preview.images?.small" :alt="preview.name" class="msg-preview-img" />
          </transition>
          <div class="msg-preview-meta">
            <div class="msg-preview-name">{{ preview.name }}</div>
            <div class="msg-preview-sub">{{ preview.set?.name || group.name }} · #{{ preview.number }}</div>
            <div v-if="previewList.length > 1" class="msg-preview-count">
              {{ previewIndex + 1 }} / {{ previewList.length }} {{ isOwned(preview) ? 'owned' : 'still needed' }} · swipe for next
            </div>
          </div>
          <button type="button" class="msg-preview-close" @click="preview = null" aria-label="Close">✕</button>
        </div>
        <button v-if="previewList.length > 1" type="button" class="msg-preview-nav msg-preview-nav-next" @click.stop="previewStep(1)" aria-label="Next card">›</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import RbIcon from './icons/RbIcon.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchSetCards, sortByNumber } from '../utils/masterSets'
import { isoCards } from '../utils/wantlist'

const props = defineProps({
  group: { type: Object, required: true }, // { key, name, game, gameLabel, setId, lang, items, hunt }
  marks: { type: Object, default: () => ({}) }, // { cardId: ts }
})
const emit = defineEmits(['close', 'toggle-mark', 'add-found', 'loaded'])

const cards = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('all')
const adding = ref(false)
const preview = ref(null)

// Session-only density preference (v1). Component-instance ref — resets when
// the gallery is hidden/unmounted/reopened. Do not write Pinia, Dexie, or
// localStorage/sessionStorage for this flag.
const compact = ref(false)

// Owned matching: cardId when the item has one, otherwise name|number
// (items added before Browse stored cardIds), otherwise bare name (items
// added before card numbers were stored)
const ownedIds = computed(() => new Set((props.group.items || []).map(i => i.cardId).filter(Boolean)))
const ownedKeys = computed(() => {
  const s = new Set()
  for (const i of props.group.items || []) {
    const name = (i.cardData?.name || '').toLowerCase()
    if (!name) continue
    const num = String(i.cardData?.number || '')
    s.add(num ? `${name}|${num}` : name)
  }
  return s
})
function isOwned(card) {
  if (ownedIds.value.has(card.id)) return true
  const name = (card.name || '').toLowerCase()
  return ownedKeys.value.has(`${name}|${String(card.number || '')}`) || ownedKeys.value.has(name)
}
const ownedCount = computed(() => cards.value.filter(c => isOwned(c)).length)
const needCount = computed(() => cards.value.filter(c => !isOwned(c) && !props.marks[c.id]).length)

// Safe marked set: only marks that are still not owned. Prevents stale-mark
// duplication when a card became owned elsewhere (Add found / other path).
// foundToday, filter counts, and footer all use this set.
const markedCards = computed(() => cards.value.filter(c => props.marks[c.id] && !isOwned(c)))
const hasUnowned = computed(() => cards.value.some(c => !isOwned(c)))
const foundToday = computed(() => {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  return markedCards.value.filter(c => props.marks[c.id] >= dayStart.getTime()).length
})

// Owned tab dropped — the header already shows "N/M owned"
const filters = computed(() => [
  { id: 'need', label: 'Not owned', count: needCount.value + markedCards.value.length },
  { id: 'all', label: 'All cards', count: cards.value.length },
])

const visibleCards = computed(() => {
  // Complete set → no filter bar, always show the whole set
  if (!hasUnowned.value) return cards.value
  if (filter.value === 'need') return cards.value.filter(c => !isOwned(c))
  return cards.value
})

function compactStatusLabel(card) {
  if (isOwned(card)) return 'Owned'
  if (props.marks[card.id]) return 'Found'
  return 'Need'
}

function compactPrimaryLabel(card) {
  const num = card.number != null && card.number !== '' ? `#${card.number}` : 'card'
  const name = card.name || 'Unknown'
  if (isOwned(card)) return `Preview owned ${name} ${num}`
  if (props.marks[card.id]) return `Unmark found ${name} ${num}`
  return `Mark found ${name} ${num}`
}

function tapCard(card) {
  // Owned cards enlarge for admiring; missing ones toggle the found mark
  // (they enlarge via the explicit "Show bigger" / compact preview control)
  if (isOwned(card)) { preview.value = card; return }
  emit('toggle-mark', card.id)
}

// ── Lightbox navigation — vendor flash-card mode ───────────────────────
// Swiping pages through whichever side the preview opened from: a needed
// card flips through ALL needed cards (number order, wraps around), an
// owned card through the owned ones.
const slideDir = ref(1)
const previewList = computed(() => {
  if (!preview.value) return []
  const side = isOwned(preview.value)
  return cards.value.filter(c => isOwned(c) === side)
})
const previewIndex = computed(() => previewList.value.findIndex(c => c.id === preview.value?.id))
function previewStep(dir) {
  const list = previewList.value
  if (list.length < 2) return
  slideDir.value = dir
  const i = previewIndex.value
  preview.value = list[(i + dir + list.length) % list.length]
}

let touchX = 0
let touchY = 0
let suppressClose = false
function onPreviewTouchStart(e) {
  touchX = e.changedTouches[0].clientX
  touchY = e.changedTouches[0].clientY
}
function onPreviewTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchX
  const dy = e.changedTouches[0].clientY - touchY
  // Any real movement: it was a swipe, not a tap — don't let the click
  // that follows close the lightbox mid-browse
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
    suppressClose = true
    setTimeout(() => { suppressClose = false }, 350)
  }
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    previewStep(dx < 0 ? 1 : -1)
  }
}
function closePreview() {
  if (suppressClose) return
  preview.value = null
}
function onPreviewKey(e) {
  if (!preview.value) return
  if (e.key === 'ArrowRight') previewStep(1)
  else if (e.key === 'ArrowLeft') previewStep(-1)
  else if (e.key === 'Escape') preview.value = null
}
onMounted(() => window.addEventListener('keydown', onPreviewKey))
onUnmounted(() => window.removeEventListener('keydown', onPreviewKey))

// ── ISO the rest: every card you still need → Booth wantlist ──
// The hunt grid is already a wantlist in spirit; this makes it one in fact,
// so scanning any booth at the show lights up your set holes.
const isoDone = ref(false)

function isoTheRest() {
  const missing = cards.value.filter(c => !isOwned(c) && !props.marks[c.id])
  isoCards(missing, { game: props.group.game || 'pokemon', setName: props.group.name || '' })
  isoDone.value = true
}

function addFound() {
  adding.value = true
  emit('add-found', markedCards.value)
  // Parent handles the emit synchronously (adds items + clears marks), so
  // reset here — otherwise the next batch of finds sees a stuck button
  adding.value = false
}

onMounted(async () => {
  // No resolvable set id → bail. Fetching with an empty id used to return
  // an unfiltered card dump (the Riftbound "different set" bug).
  if (!props.group.setId) {
    error.value = 'Could not work out which set this is — try re-adding a card from Browse.'
    loading.value = false
    return
  }
  try {
    const list = await fetchSetCards({
      game: props.group.game,
      setId: props.group.setId,
      setName: props.group.name,
      lang: props.group.lang,
    })
    cards.value = sortByNumber(list)
    if (!cards.value.length) error.value = 'No card list available for this set.'
    else emit('loaded', cards.value.length)
    // Incomplete sets open straight to the cards you DON'T own — that's
    // the hunting list. Complete sets open on All (nothing to hunt).
    if (cards.value.some(c => !isOwned(c))) filter.value = 'need'
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
  flex-wrap: wrap;
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
.msg-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.msg-today { font-size: 10.5px; }

/* Density toggle — session-only; ≥44px hit target */
.msg-density-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 800;
  font-family: inherit;
  color: var(--ink);
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: 99px;
  box-shadow: var(--shadow-pressed);
  cursor: pointer;
  transition: background 0.12s, box-shadow 0.1s, transform 0.1s;
}
.msg-density-toggle:active:not(:disabled) {
  box-shadow: none;
  transform: translate(1px, 1px);
}
.msg-density-toggle[aria-pressed="true"] {
  background: var(--accent);
  color: var(--on-accent);
}
.msg-density-toggle:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ISO — local ≥44px without changing global .btn-sm */
.msg-iso-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 8px 14px;
}

.msg-filters {
  display: flex;
  gap: 8px;
  padding: 0 18px 12px;
  flex-wrap: wrap;
}
.msg-filter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  min-width: 44px;
  padding: 8px 14px;
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
.msg-filter-btn.active .msg-filter-count {
  background: var(--bg-card);
  color: var(--ink);
}

.msg-grid-wrap { overflow-y: auto; overscroll-behavior: contain; padding: 4px 18px 18px; flex: 1; }
.msg-hint { font-size: 12px; color: var(--text-secondary); font-weight: 600; margin: 0 0 12px; }
.msg-loading, .msg-error { padding: 40px 0; text-align: center; color: var(--text-secondary); font-weight: 600; font-size: 13.5px; }
.msg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 12px;
}
.msg-card { cursor: pointer; }
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
.msg-card.got .msg-img-wrap { border-color: var(--accent-text); box-shadow: 0 0 0 2px var(--accent); }

/* Hover affordances only where hover exists — on touch these stick after a
   tap and leave cards dimmed inconsistently */
@media (hover: hover) {
  .msg-filter-btn:hover { background: var(--bg-hover); }
  .msg-density-toggle:hover:not(:disabled) { background: var(--bg-hover); }
  .msg-density-toggle[aria-pressed="true"]:hover:not(:disabled) { background: var(--accent); }
  .msg-card.need:hover .msg-img { filter: grayscale(0.6) brightness(0.85); }
  .msg-enlarge:hover { background: var(--bg-hover); }
  .msg-compact-primary:hover { background: var(--bg-hover); }
  .msg-compact-preview:hover { background: var(--bg-hover); }
}

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
.msg-enlarge {
  margin-top: 6px;
  width: 100%;
  min-width: 44px;
  min-height: 44px;
  padding: 10px 8px;
  font-size: 11px;
  font-weight: 800;
  font-family: inherit;
  color: var(--ink);
  background: var(--bg-card);
  border: 1.5px solid var(--ink);
  border-radius: 8px;
  box-shadow: var(--shadow-pressed);
  cursor: pointer;
}
.msg-enlarge:active { box-shadow: none; transform: translate(1px, 1px); }

/* ── Compact grid: number-first, no card images, same visibleCards ──
   minmax(60px) keeps tracks wide enough for ≥44px targets + clamped text.
   At ~280px viewport (~244px grid content after panel padding), auto-fill
   yields 3 columns (4 when content ≥ ~258px). No hard max-column cap. */
.msg-grid-compact {
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 8px;
  max-width: 100%;
}
.msg-compact-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.msg-compact-primary {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 2px;
  width: 100%;
  min-width: 44px;
  min-height: 44px;
  max-width: 100%;
  padding: 6px 5px;
  text-align: left;
  font-family: inherit;
  color: var(--ink);
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: 8px;
  box-shadow: var(--shadow-pressed);
  cursor: pointer;
  overflow: hidden;
  transition: background 0.12s, box-shadow 0.1s, transform 0.1s;
}
.msg-compact-primary:active {
  box-shadow: none;
  transform: translate(1px, 1px);
}
.msg-compact-item.need .msg-compact-primary {
  border-style: dashed;
  background: var(--bg-secondary);
}
.msg-compact-item.got .msg-compact-primary {
  border-color: var(--accent-text);
  box-shadow: var(--shadow-pressed), 0 0 0 2px var(--accent);
}
.msg-compact-item.owned .msg-compact-primary {
  background: var(--bg-card);
}
/* Long collector numbers must not paint outside the cell */
.msg-compact-num {
  display: block;
  min-width: 0;
  max-width: 100%;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
}
/* Long names clamp to 2 lines inside the track */
.msg-compact-name {
  display: -webkit-box;
  min-width: 0;
  max-width: 100%;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
}
.msg-compact-status {
  margin-top: 2px;
  max-width: 100%;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg-compact-status.is-owned { color: var(--text-secondary); }
.msg-compact-status.is-need { color: var(--text-muted); }
.msg-compact-status.is-found {
  color: var(--on-accent);
  background: var(--accent);
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  padding: 1px 4px;
  align-self: flex-start;
  max-width: 100%;
  box-sizing: border-box;
}
/* Separate preview control — full-width in track; icon-only when narrow */
.msg-compact-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-width: 44px;
  min-height: 44px;
  max-width: 100%;
  padding: 6px 4px;
  font-size: 10px;
  font-weight: 800;
  font-family: inherit;
  color: var(--ink);
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: 8px;
  box-shadow: var(--shadow-pressed);
  cursor: pointer;
  overflow: hidden;
  transition: background 0.12s, box-shadow 0.1s, transform 0.1s;
}
.msg-compact-preview:active {
  box-shadow: none;
  transform: translate(1px, 1px);
}
.msg-compact-preview-txt {
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* Lightbox — always-dark scrim + always-light meta (theme-stable tokens) */
.msg-preview {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}
.msg-preview-inner { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 100%; margin: auto; }
.msg-preview-img {
  max-width: min(420px, 88vw);
  /* leave room for the meta lines + overlay padding so the card name stays
     on-screen on landscape phones */
  max-height: min(78vh, calc(100vh - 140px));
  border-radius: 14px;
  border: 3px solid var(--ink);
  box-shadow: var(--shadow-lg);
  background: var(--bg-card);
}
.msg-preview-meta { text-align: center; color: var(--on-scrim); }
.msg-preview-name { font-size: 16px; font-weight: 800; }
.msg-preview-sub { font-size: 12.5px; opacity: 0.85; font-weight: 600; margin-top: 2px; }
.msg-preview-count {
  font-size: 11.5px;
  font-weight: 700;
  opacity: 0.7;
  margin-top: 5px;
}
.msg-preview-nav {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 2px solid var(--ink);
  box-shadow: var(--shadow-sm);
  font-size: 24px;
  line-height: 1;
  font-weight: 900;
  cursor: pointer;
  color: var(--ink);
  z-index: 1;
}
.msg-preview-nav:active { box-shadow: none; transform: translate(1px, 1px); }
.msg-preview-nav-prev { margin-right: 10px; }
.msg-preview-nav-next { margin-left: 10px; }
/* Phones: float the chevrons over the image edges — side-by-side there's
   no room, and thumbs reach mid-screen anyway */
@media (max-width: 640px) {
  .msg-preview-nav { position: fixed; top: 50%; transform: translateY(-50%); opacity: 0.92; }
  .msg-preview-nav-prev { left: 8px; margin: 0; }
  .msg-preview-nav-next { right: 8px; margin: 0; }
  .msg-preview-nav:active { transform: translateY(-50%) translate(1px, 1px); }
}
/* Swipe transitions — card slides out the way the finger moved */
.msg-slide-l-enter-active, .msg-slide-l-leave-active,
.msg-slide-r-enter-active, .msg-slide-r-leave-active { transition: transform 0.14s ease, opacity 0.14s ease; }
.msg-slide-l-enter-from { transform: translateX(28px); opacity: 0; }
.msg-slide-l-leave-to { transform: translateX(-28px); opacity: 0; }
.msg-slide-r-enter-from { transform: translateX(-28px); opacity: 0; }
.msg-slide-r-leave-to { transform: translateX(28px); opacity: 0; }
.msg-preview-close {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 2px solid var(--ink);
  box-shadow: var(--shadow-sm);
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  color: var(--ink);
}
.msg-preview-close:active { box-shadow: none; transform: translate(1px, 1px); }

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
.msg-add-found-btn {
  min-height: 44px;
  min-width: 44px;
}

@media (max-width: 640px) {
  .msg-panel { max-height: 82vh; }
  .msg-grid:not(.msg-grid-compact) { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 9px; }
  /* 280px: minmax(60px) + 6px gap → 3 non-overlapping columns in ~244px content */
  .msg-grid-compact {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 6px;
  }
  /* Icon-only preview at narrow widths — aria-label remains on the button */
  .msg-compact-preview-txt {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .msg-compact-preview { position: relative; }
}

@media (prefers-reduced-motion: reduce) {
  .msg-panel { animation: none; }
  .msg-density-toggle,
  .msg-filter-btn,
  .msg-compact-primary,
  .msg-compact-preview,
  .msg-enlarge {
    transition: none;
  }
  .msg-slide-l-enter-active, .msg-slide-l-leave-active,
  .msg-slide-r-enter-active, .msg-slide-r-leave-active { transition: none; }
}
</style>
