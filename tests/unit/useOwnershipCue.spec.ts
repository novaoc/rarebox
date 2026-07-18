import { ref } from "vue";
import { useOwnershipCue } from "../../src/composables/useOwnershipCue";

test('filter is empty when owned', () => {
  const owned = ref(true);
  const { filter } = useOwnershipCue(owned);
  expect(filter.value).toBe("");
});

test('filter applies when not owned', () => {
  const owned = ref(false);
  const { filter } = useOwnershipCue(owned);
  expect(filter.value).toBe("grayscale(100%) brightness(85%)");
});
