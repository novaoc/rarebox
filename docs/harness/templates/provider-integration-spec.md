# Rarebox Provider Integration Spec

## TCG / provider

Game:

Public data source:

CORS/browser-direct status:

Auth/key required? No preferred. If yes, explain why unavoidable:

## Data coverage

- Sets endpoint:
- Set cards endpoint:
- Search endpoint:
- Images:
- Prices:
- Sealed products:
- Graded support:

## Normalized shape

Cards must normalize to:

```js
{ id, name, number, set, image, price, rarity, game }
```

Sets must normalize to:

```js
{ id, name, code, releaseDate, total, logo }
```

## API behavior

- Expected total requests:
- Cache TTL:
- Concurrency cap:
- Timeout/retry:
- Offline/stale fallback:
- Known quirks:

## User experience

- Search works before preload? Yes / No
- Browse route:
- Add item behavior:
- Bulk add behavior:
- Mobile considerations:

## Harness requirements

- [ ] Provider registry shape eval covers the game
- [ ] Provider normalization fixture covers prices/variants
- [ ] Search fallback eval still passes
- [ ] Sealed filter eval updated if sealed behavior changes
- [ ] Browser smoke route added if a new route is introduced

## Verification

- [ ] `npm run eval:harness`
- [ ] `npm run eval:danger`
- [ ] `npm run build`
- [ ] `npm run smoke:browser`
