import { computed, Ref } from "vue";

/**
 * Returns a CSS filter string based on ownership status.
 * @param ownedRef - a Ref<boolean> indicating whether the card is owned.
 */
export function useOwnershipCue(ownedRef: Ref<boolean>) {
  const filter = computed(() => {
    return ownedRef.value ? "" : "grayscale(100%) brightness(85%)";
  });
  return { filter };
}
