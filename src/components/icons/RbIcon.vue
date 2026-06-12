<template>
  <svg
    class="rb-icon"
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
  >
    <!-- card — two fanned trading cards -->
    <template v-if="name === 'card'">
      <rect x="9" y="10" width="20" height="28" rx="3" transform="rotate(-8 19 24)" :fill="P.pink" :stroke="ink" stroke-width="2.5" />
      <rect x="20" y="9" width="20" height="29" rx="3" transform="rotate(6 30 24)" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <circle cx="30" cy="20" r="4.5" :fill="P.blue" :stroke="ink" stroke-width="2.5" transform="rotate(6 30 24)" />
    </template>

    <!-- box — sealed product -->
    <template v-else-if="name === 'box'">
      <path d="M6 16 24 6l18 10v16L24 42 6 32V16Z" :fill="P.blue" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M6 16l18 10 18-10M24 26v16" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M15 11l18 10" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
    </template>

    <!-- trophy — graded slab -->
    <template v-else-if="name === 'trophy'">
      <path d="M14 8h20v10a10 10 0 0 1-20 0V8Z" :fill="P.yellow" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M14 11H7a7 7 0 0 0 7 9M34 11h7a7 7 0 0 1-7 9" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M21 28h6v6h-6z" :fill="P.yellow" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <rect x="14" y="34" width="20" height="7" rx="2" :fill="P.pink" :stroke="ink" stroke-width="2.5" />
    </template>

    <!-- magnifier -->
    <template v-else-if="name === 'magnifier'">
      <circle cx="20" cy="20" r="12" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <circle cx="20" cy="20" r="6" fill="#fff" :stroke="ink" stroke-width="2.5" />
      <path d="m30 30 11 11" :stroke="ink" stroke-width="5" stroke-linecap="round" />
    </template>

    <!-- chart — bars -->
    <template v-else-if="name === 'chart'">
      <rect x="6" y="26" width="8" height="14" rx="2" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <rect x="20" y="16" width="8" height="24" rx="2" :fill="P.pink" :stroke="ink" stroke-width="2.5" />
      <rect x="34" y="8" width="8" height="32" rx="2" :fill="P.green" :stroke="ink" stroke-width="2.5" />
    </template>

    <!-- trend — line going up -->
    <template v-else-if="name === 'trend'">
      <path d="M6 38 18 26l8 6L42 14" :stroke="ink" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M30 12h12v12" :stroke="ink" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="18" cy="26" r="4" :fill="P.green" :stroke="ink" stroke-width="2.5" />
    </template>

    <!-- confetti -->
    <template v-else-if="name === 'confetti'">
      <path d="M14 22 6 42l20-8" :fill="P.yellow" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M20 14c4-4 10-4 14 0M28 24c5-1 9 2 10 7" :stroke="ink" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <rect x="30" y="6" width="6" height="6" rx="1.5" :fill="P.pink" :stroke="ink" stroke-width="2" transform="rotate(20 33 9)" />
      <rect x="39" y="16" width="5" height="5" rx="1.5" :fill="P.green" :stroke="ink" stroke-width="2" transform="rotate(-15 41 18)" />
      <circle cx="24" cy="7" r="3" :fill="P.blue" :stroke="ink" stroke-width="2" />
    </template>

    <!-- bell -->
    <template v-else-if="name === 'bell'">
      <path d="M24 6c7 0 12 5 12 12v8l4 8H8l4-8v-8c0-7 5-12 12-12Z" :fill="P.yellow" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M19 38a5 5 0 0 0 10 0" :stroke="ink" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <circle cx="36" cy="10" r="5" :fill="P.pink" :stroke="ink" stroke-width="2.5" />
    </template>

    <!-- camera -->
    <template v-else-if="name === 'camera'">
      <rect x="5" y="14" width="38" height="26" rx="4" :fill="P.blue" :stroke="ink" stroke-width="2.5" />
      <path d="M17 14l3-6h8l3 6" :fill="P.blue" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <circle cx="24" cy="27" r="8" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <circle cx="24" cy="27" r="3" fill="#fff" :stroke="ink" stroke-width="2" />
    </template>

    <!-- check-badge -->
    <template v-else-if="name === 'check'">
      <path d="M24 4l5 4 6-1 2 6 6 2-1 6 4 5-4 5 1 6-6 2-2 6-6-1-5 4-5-4-6 1-2-6-6-2 1-6-4-5 4-5-1-6 6-2 2-6 6 1 5-4Z" :fill="P.green" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="m16 24 6 6 11-12" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <!-- question — thought bubble -->
    <template v-else-if="name === 'question'">
      <path d="M24 6C13 6 6 13 6 21c0 5 3 9 7 12l-2 9 9-5c1 .2 3 .3 4 .3 11 0 18-7 18-15S35 6 24 6Z" :fill="P.pink" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M19 18c0-3 2-5 5-5s5 2 5 4c0 4-5 4-5 8" :stroke="ink" stroke-width="3" stroke-linecap="round" fill="none" />
      <circle cx="24" cy="30.5" r="2.2" :fill="ink" />
    </template>

    <!-- mailbox — empty state -->
    <template v-else-if="name === 'mailbox'">
      <rect x="6" y="16" width="26" height="18" rx="8" :fill="P.blue" :stroke="ink" stroke-width="2.5" />
      <path d="M28 16h6a8 8 0 0 1 8 8v10H28" :fill="P.yellow" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M14 34v8" :stroke="ink" stroke-width="3" stroke-linecap="round" />
      <path d="M30 8h8M30 4v9" :stroke="ink" stroke-width="2.5" stroke-linecap="round" />
    </template>

    <!-- upload -->
    <template v-else-if="name === 'upload'">
      <path d="M24 30V8m0 0-9 9m9-9 9 9" :stroke="ink" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M8 32v4a5 5 0 0 0 5 5h22a5 5 0 0 0 5-5v-4" :stroke="ink" stroke-width="3" stroke-linecap="round" fill="none" />
      <circle cx="24" cy="34" r="3" :fill="P.green" :stroke="ink" stroke-width="2" />
    </template>

    <!-- download -->
    <template v-else-if="name === 'download'">
      <path d="M24 8v22m0 0 9-9m-9 9-9-9" :stroke="ink" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M8 32v4a5 5 0 0 0 5 5h22a5 5 0 0 0 5-5v-4" :stroke="ink" stroke-width="3" stroke-linecap="round" fill="none" />
      <circle cx="24" cy="12" r="3" :fill="P.pink" :stroke="ink" stroke-width="2" />
    </template>

    <!-- antenna — live data -->
    <template v-else-if="name === 'antenna'">
      <circle cx="24" cy="26" r="5" :fill="P.pink" :stroke="ink" stroke-width="2.5" />
      <path d="M24 31v11" :stroke="ink" stroke-width="3" stroke-linecap="round" />
      <path d="M14 16a14 14 0 0 1 20 0M9 10a21 21 0 0 1 30 0" :stroke="ink" stroke-width="3" stroke-linecap="round" fill="none" />
    </template>

    <!-- lock -->
    <template v-else-if="name === 'lock'">
      <rect x="10" y="20" width="28" height="22" rx="4" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <path d="M16 20v-4a8 8 0 0 1 16 0v4" :stroke="ink" stroke-width="3" fill="none" />
      <circle cx="24" cy="30" r="3.5" :fill="ink" />
      <path d="M24 32v5" :stroke="ink" stroke-width="3" stroke-linecap="round" />
    </template>

    <!-- bolt -->
    <template v-else-if="name === 'bolt'">
      <path d="M27 4 10 28h11l-2 16 19-26H26l1-14Z" :fill="P.yellow" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
    </template>

    <!-- binder — master set stack -->
    <template v-else-if="name === 'binder'">
      <rect x="13" y="7" width="24" height="32" rx="3" transform="rotate(7 25 23)" :fill="P.green" :stroke="ink" stroke-width="2.5" />
      <rect x="10" y="9" width="24" height="32" rx="3" transform="rotate(-5 22 25)" :fill="P.pink" :stroke="ink" stroke-width="2.5" />
      <rect x="12" y="8" width="24" height="32" rx="3" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <path d="m24 16 1.8 3.8 4.2.6-3 3 .7 4.1L24 25.6l-3.7 1.9.7-4.1-3-3 4.2-.6L24 16Z" :fill="ink" />
    </template>

    <!-- shelf — the namesake -->
    <template v-else-if="name === 'shelf'">
      <path d="M6 40h36" :stroke="ink" stroke-width="3.5" stroke-linecap="round" />
      <rect x="9" y="14" width="9" height="26" rx="2" :fill="P.blue" :stroke="ink" stroke-width="2.5" />
      <rect x="20" y="10" width="9" height="30" rx="2" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <rect x="33" y="18" width="9" height="22" rx="2" transform="rotate(9 37 29)" :fill="P.pink" :stroke="ink" stroke-width="2.5" />
    </template>

    <!-- coin — value -->
    <template v-else-if="name === 'coin'">
      <circle cx="24" cy="24" r="17" :fill="P.yellow" :stroke="ink" stroke-width="2.5" />
      <circle cx="24" cy="24" r="11" fill="none" :stroke="ink" stroke-width="2" stroke-dasharray="3 3" />
      <path d="M24 15v18M28.5 18.5c-1-1.5-7.5-2.5-7.5 1.5 0 4 7 2.5 7 6.5 0 4-6.5 3-8 1.5" :stroke="ink" stroke-width="2.5" stroke-linecap="round" fill="none" />
    </template>

    <!-- swap — trade arrows -->
    <template v-else-if="name === 'swap'">
      <path d="M8 16h26m0 0-7-7m7 7-7 7" :stroke="ink" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M40 32H14m0 0 7-7m-7 7 7 7" :stroke="ink" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <!-- sparkle -->
    <template v-else>
      <path d="M24 6c1.5 8 4 12 14 14-10 2-12.5 6-14 14-1.5-8-4-12-14-14 10-2 12.5-6 14-14Z" :fill="P.yellow" :stroke="ink" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M37 30c.8 4 2 6 6 7-4 1-5.2 3-6 7-.8-4-2-6-6-7 4-1 5.2-3 6-7Z" :fill="P.pink" :stroke="ink" stroke-width="2" stroke-linejoin="round" />
    </template>
  </svg>
</template>

<script setup>
// Rarebox's own emoji — Tactile-guideline icons (see DesignTactileView):
// 48-grid, flat brand fills, chunky ink strokes, round joins. Replaces the
// platform emojis that clashed with the app's look on every OS differently.
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
})

const ink = 'var(--ink, #141414)'
const P = { yellow: '#ffd23f', pink: '#ff6ba9', green: '#2fbf71', blue: '#4f86f7' }
</script>

<style scoped>
.rb-icon { display: inline-block; vertical-align: -0.18em; flex-shrink: 0; }
</style>
