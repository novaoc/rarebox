<template>
  <div class="ms-stack" :class="{ 'ms-complete': group.complete }">
    <div class="ms-fan" aria-hidden="true">
      <div class="ms-fan-card ms-fan-3"></div>
      <div class="ms-fan-card ms-fan-2"></div>
      <div class="ms-fan-card ms-fan-1">
        <img v-if="group.logo" :src="group.logo" :alt="group.name" class="ms-logo" loading="lazy" @error="$event.target.style.display = 'none'" />
        <img v-else :src="sleeveDataUri(group.name)" :alt="group.name" class="ms-sleeve" />
      </div>
      <span v-if="group.complete" class="ms-check" title="Master set complete">✓</span>
    </div>

    <div class="ms-body">
      <div class="ms-title-row">
        <span class="ms-name">{{ group.name }}</span>
        <span class="sticker ms-sticker" :class="group.complete ? '' : 'sticker-blue'">★ MASTER SET</span>
      </div>
      <div class="ms-sub">{{ group.gameLabel }}<template v-if="group.total"> · {{ group.owned }}/{{ group.total }} cards</template><template v-else> · {{ group.owned }} cards</template></div>
      <div v-if="group.total" class="ms-progress" role="progressbar" :aria-valuenow="group.owned" :aria-valuemax="group.total">
        <div class="ms-progress-fill" :style="{ width: Math.min(100, (group.owned / group.total) * 100) + '%' }"></div>
      </div>
      <div class="ms-value-row">
        <span class="sticker sticker-green ms-value">{{ fmtValue }}</span>
        <span class="ms-singles">{{ group.count }} single{{ group.count === 1 ? '' : 's' }} combined</span>
      </div>
    </div>

    <div class="ms-actions">
      <button class="btn btn-secondary btn-sm" @click="$emit('open')">{{ group.complete ? 'View cards ▸' : '🎯 Hunt ▸' }}</button>
      <button class="btn btn-ghost btn-sm ms-unstack" title="Back to single rows" @click="$emit('unshowcase')">Unstack</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { sleeveDataUri } from '../utils/offlineArt'

const props = defineProps({
  group: { type: Object, required: true },
})
defineEmits(['open', 'unshowcase'])

const fmtValue = computed(() =>
  '$' + (props.group.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
)
</script>

<style scoped>
.ms-stack {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
/* Gold-foil treatment for 100% complete sets */
.ms-complete {
  border-color: var(--accent-text);
  box-shadow: 3px 3px 0 var(--accent-text), 0 0 0 3px var(--accent-dim) inset;
}

/* Fanned stack of card backs */
.ms-fan { position: relative; width: 64px; height: 84px; flex-shrink: 0; }
.ms-fan-card {
  position: absolute;
  inset: 0;
  border: 2px solid var(--ink);
  border-radius: 7px;
  background: var(--bg-secondary);
}
.ms-fan-3 { transform: rotate(7deg) translateX(7px); background: var(--accent-dim); }
.ms-fan-2 { transform: rotate(-5deg) translateX(-5px); background: var(--pink-dim); }
.ms-fan-1 {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg-card);
  padding: 4px;
}
.ms-logo { max-width: 100%; max-height: 100%; object-fit: contain; }
.ms-sleeve { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.ms-check {
  position: absolute;
  top: -8px;
  right: -10px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 900;
  box-shadow: var(--shadow-pressed);
}

.ms-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.ms-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ms-name { font-size: 15px; font-weight: 800; }
.ms-sticker { font-size: 9.5px; letter-spacing: 0.4px; }
.ms-sub { font-size: 12px; color: var(--text-secondary); font-weight: 600; }

.ms-progress {
  height: 8px;
  border: 1.5px solid var(--ink);
  border-radius: 99px;
  background: var(--bg-secondary);
  overflow: hidden;
  max-width: 260px;
}
.ms-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
.ms-complete .ms-progress-fill { background: var(--success); }

.ms-value-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ms-value { font-size: 13px; }
.ms-singles { font-size: 11.5px; color: var(--text-muted); font-weight: 600; }

.ms-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.ms-unstack { font-size: 11px; }

@media (max-width: 640px) {
  .ms-stack { flex-wrap: wrap; }
  .ms-actions { flex-direction: row; width: 100%; }
  .ms-actions .btn { flex: 1; }
}
</style>
