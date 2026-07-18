<template>
  <div class="card-thumbnail border-2 border-ink rounded" :style="{ width: '44px', height: '44px' }">
    <img :src="src" :alt="alt" :style="imageStyle" class="object-cover w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, computed } from "vue";
import { useOwnershipCue } from "../composables/useOwnershipCue";

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: "card" },
  owned: { type: Boolean, default: true }
});

const { owned } = toRefs(props);
const { filter } = useOwnershipCue(owned);

const imageStyle = computed(() => ({
  filter: filter.value,
  border: "2px solid #1a1a1a",
  backgroundColor: "#fdfbf7"
}));
</script>

<style scoped>
.card-thumbnail {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
