import { assert, ok, read, runEval } from './lib.mjs'

runEval('master set compact mode v1 source guards', () => {
  const gallery = read('src/components/MasterSetGallery.vue')
  const portfolioView = read('src/views/PortfolioView.vue')
  const portfolioStore = read('src/stores/portfolio.js')

  // ── Session-only density (default comfortable / off) ─────────────────
  assert(
    /Session-only density|session-only/i.test(gallery),
    'must label session-only density behavior in code',
  )
  assert(
    /const compact = ref\(false\)/.test(gallery),
    'compact must default false (comfortable / current mode)',
  )
  assert(
    /No Pinia\/Dexie\/localStorage|no Pinia, Dexie, or\s+localStorage/i.test(gallery),
    'must document no Pinia/Dexie/localStorage for compact preference',
  )
  // No persistence APIs for the compact flag
  assert(
    !/localStorage\.(get|set)Item\([^)]*compact/i.test(gallery),
    'must not read/write localStorage for compact',
  )
  assert(
    !/sessionStorage\.(get|set)Item\([^)]*compact/i.test(gallery),
    'must not read/write sessionStorage for compact',
  )
  assert(
    !/persist(Now)?\(\)/.test(gallery),
    'gallery must not call store persist for density',
  )
  // Parent still mounts gallery with v-if so unmount resets instance state
  assert(
    /v-if="msGalleryKey === g\.key"/.test(portfolioView),
    'parent must v-if gallery so compact resets on hide/unmount/reopen',
  )

  // ── Toggle control ───────────────────────────────────────────────────
  assert(
    /msg-density-toggle/.test(gallery),
    'must expose density toggle control',
  )
  assert(
    /aria-pressed="compact \? 'true' : 'false'"/.test(gallery)
      || /:aria-pressed="compact \? 'true' : 'false'"/.test(gallery),
    'density toggle must expose aria-pressed',
  )
  assert(
    /aria-label="compact \? 'Switch to comfortable layout' : 'Switch to compact layout'"/.test(gallery)
      || /:aria-label="compact \?/.test(gallery),
    'density toggle must have aria-label',
  )
  assert(
    /compact = !compact/.test(gallery),
    'toggle must flip compact ref',
  )

  // ── Canonical visibleCards only — no synthetic range ─────────────────
  assert(
    /v-for="card in visibleCards"/.test(gallery),
    'both layouts must iterate visibleCards',
  )
  const compactBlock = gallery.includes('msg-grid-compact')
    ? gallery.slice(gallery.indexOf('msg-grid-compact'))
    : ''
  assert(compactBlock.length > 0, 'compact grid class must exist')
  assert(
    /v-for="card in visibleCards"/.test(compactBlock),
    'compact grid must v-for visibleCards (canonical fetched records)',
  )
  // Strip HTML/JS comments before scanning for forbidden synthetic-range code
  const codeOnly = gallery
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  assert(
    !/for\s*\(\s*let\s+\w+\s*=\s*1/.test(codeOnly),
    'must not synthesize 1..N placeholder loops',
  )
  assert(
    !/Array\.from\(\s*\{\s*length:\s*(setSize|total|group\.total)/.test(codeOnly),
    'must not build synthetic arrays from setSize/total',
  )
  assert(
    !/\b(setSize|group\.total)\b[\s\S]{0,40}(v-for|Array\.from|new Array)/.test(codeOnly),
    'must not drive v-for/Array.from from setSize/total placeholders',
  )
  assert(
    /never synthetic|canonical fetched|visibleCards/.test(gallery),
    'must label canonical visibleCards / no-synthetic-range intent',
  )
  // Same fetch path — no second fetch for compact
  const fetchCount = (gallery.match(/fetchSetCards\s*\(/g) || []).length
  assert(fetchCount === 1, `exactly one fetchSetCards call (got ${fetchCount})`)
  assert(
    /const visibleCards = computed/.test(gallery),
    'visibleCards computed must remain the shared filter path',
  )
  assert(
    /filter\.value === 'need'/.test(gallery) && /!isOwned\(c\)/.test(gallery),
    'need filter must still use isOwned path',
  )
  assert(
    /function isOwned\(card\)/.test(gallery)
      && /ownedIds\.value\.has\(card\.id\)/.test(gallery)
      && /ownedKeys\.value\.has\(`\$\{name\}\|\$\{String\(card\.number/.test(gallery)
      && /ownedKeys\.value\.has\(name\)/.test(gallery),
    'isOwned must keep cardId → name|number → name matching',
  )

  // ── Stale-mark exclusion ─────────────────────────────────────────────
  assert(
    /markedCards = computed\(\(\) => cards\.value\.filter\(c => props\.marks\[c\.id\] && !isOwned\(c\)\)\)/.test(gallery)
      || /props\.marks\[c\.id\]\s*&&\s*!isOwned\(c\)/.test(gallery),
    'markedCards must exclude owned cards (stale marks)',
  )
  assert(
    /Safe marked set|stale-mark|still not owned/i.test(gallery),
    'must label stale-mark / safe marked set behavior',
  )
  assert(
    /foundToday[\s\S]{0,200}markedCards/.test(gallery)
      || /markedCards\.value\.filter\(c => props\.marks\[c\.id\]/.test(gallery),
    'foundToday must derive from safe markedCards set',
  )
  assert(
    /emit\('add-found',\s*markedCards\.value\)/.test(gallery),
    'add-found must emit safe markedCards (no owned duplicates)',
  )
  // Parent add-found + clear marks preserved
  assert(
    /@add-found="addFoundCards"/.test(portfolioView)
      && /function addFoundCards/.test(portfolioView)
      && /clearHuntMarks/.test(portfolioView),
    'parent add-found + clearHuntMarks path must remain',
  )
  assert(
    /function toggleHuntMark/.test(portfolioStore)
      && /function clearHuntMarks/.test(portfolioStore),
    'store hunt mark APIs must remain',
  )

  // ── Compact interactions / a11y ──────────────────────────────────────
  assert(
    /msg-compact-primary/.test(gallery) && /msg-compact-preview/.test(gallery),
    'compact must split primary cell and separate preview control',
  )
  assert(
    /compactPrimaryLabel|Mark found|Unmark found|Preview owned/.test(gallery),
    'compact primary must expose owned/mark/unmark aria labels',
  )
  assert(
    /Preview \$\{card\.name|aria-label="`Preview/.test(gallery)
      || /:aria-label="`Preview/.test(gallery),
    'compact preview control must have aria-label',
  )
  assert(
    /msg-compact-num/.test(gallery) && /msg-compact-name/.test(gallery),
    'compact cells must show number and name',
  )
  assert(
    /compactStatusLabel|Owned|Found|Need/.test(gallery),
    'compact must encode owned / needed / found status',
  )
  // Compact avoids loading full card images in the grid (lightweight)
  const compactTemplate = gallery.match(
    /<!-- Compact:[\s\S]*?msg-grid-compact[\s\S]*?(?=<!-- Footer|msg-footer)/,
  )?.[0] || gallery.slice(
    gallery.indexOf('msg-grid-compact'),
    gallery.indexOf('msg-footer'),
  )
  assert(
    !/<img[\s\S]{0,80}card\.images/.test(compactTemplate),
    'compact grid must not load card images (number-first / lightweight)',
  )
  // Owned → preview; missing → toggle-mark (shared tapCard)
  assert(
    /function tapCard\(card\)/.test(gallery)
      && /if \(isOwned\(card\)\)\s*\{\s*preview\.value = card/.test(gallery)
      && /emit\('toggle-mark',\s*card\.id\)/.test(gallery),
    'tapCard must keep owned→preview and missing→toggle-mark',
  )

  // ── ≥44px targets (toggle, compact primary/preview, ISO, filters, enlarge, close) ──
  const style = gallery.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] || ''
  function hasMin44(className) {
    const re = new RegExp(
      `\\.${className.replace(/\./g, '\\.')}\\s*\\{[^}]*min-(?:width|height):\\s*44px[^}]*min-(?:width|height):\\s*44px|` +
      `\\.${className.replace(/\./g, '\\.')}\\s*\\{[^}]*(?:min-height:\\s*44px[^}]*min-width:\\s*44px|min-width:\\s*44px[^}]*min-height:\\s*44px)`,
    )
    // Also accept width/height: 44px pairs
    const re2 = new RegExp(
      `\\.${className}\\s*\\{[^}]*(?:min-height:\\s*44px|height:\\s*44px)[^}]*(?:min-width:\\s*44px|width:\\s*44px)|` +
      `\\.${className}\\s*\\{[^}]*(?:min-width:\\s*44px|width:\\s*44px)[^}]*(?:min-height:\\s*44px|height:\\s*44px)`,
    )
    return re.test(style) || re2.test(style) || (
      style.includes(`.${className}`)
      && new RegExp(`\\.${className}\\s*\\{[^}]*min-height:\\s*44px`).test(style)
      && new RegExp(`\\.${className}\\s*\\{[^}]*min-width:\\s*44px`).test(style)
    )
  }
  for (const cls of [
    'msg-density-toggle',
    'msg-compact-primary',
    'msg-compact-preview',
    'msg-iso-btn',
    'msg-filter-btn',
    'msg-enlarge',
    'msg-preview-close',
  ]) {
    assert(hasMin44(cls), `${cls} must be ≥44×44 (min-width + min-height 44px)`)
  }

  // ── Compact overflow clamping (long num/name must not paint outside) ──
  const numBlock = style.match(/\.msg-compact-num\s*\{[^}]+\}/)?.[0] || ''
  assert(
    /overflow:\s*hidden/.test(numBlock) && /text-overflow:\s*ellipsis/.test(numBlock),
    'msg-compact-num must clamp with overflow:hidden + text-overflow:ellipsis',
  )
  assert(
    /white-space:\s*nowrap/.test(numBlock) || /word-break:\s*break-all/.test(numBlock),
    'msg-compact-num must nowrap or break-all so long collector numbers stay in-cell',
  )
  const nameBlock = style.match(/\.msg-compact-name\s*\{[^}]+\}/)?.[0] || ''
  assert(
    /overflow:\s*hidden/.test(nameBlock),
    'msg-compact-name must overflow:hidden',
  )
  assert(
    /-webkit-line-clamp:\s*2/.test(nameBlock) || /text-overflow:\s*ellipsis/.test(nameBlock),
    'msg-compact-name must line-clamp or ellipsis long titles',
  )
  assert(
    /word-break:\s*break-word|overflow-wrap:\s*anywhere/.test(nameBlock),
    'msg-compact-name must break long unbroken tokens',
  )
  // Preview control fits track (overflow hidden; icon-only at narrow OK)
  const previewBlock = style.match(/\.msg-compact-preview\s*\{[^}]+\}/)?.[0] || ''
  assert(
    /overflow:\s*hidden/.test(previewBlock) && /min-width:\s*44px/.test(previewBlock),
    'msg-compact-preview must overflow:hidden and keep ≥44px min-width',
  )
  assert(
    /msg-compact-preview-txt/.test(style)
      && (/clip:\s*rect\(0/.test(style) || /display:\s*none/.test(style.match(/\.msg-compact-preview-txt[\s\S]{0,400}/)?.[0] || '')),
    'narrow layout must hide preview label text (icon-only) while aria-label remains',
  )
  assert(
    /:aria-label="`Preview \$\{card\.name/.test(gallery)
      || /aria-label="`Preview/.test(gallery)
      || /:aria-label="`Preview/.test(gallery),
    'preview button must keep aria-label when label text is visually hidden',
  )

  // ── 280px compact grid bound (3–4 columns via minmax ≥60px) ──────────
  // Truthful track: minmax(60px+) so ~244px content yields 3 cols (4 when wider).
  // Do not claim a hard max-column cap unless CSS enforces one.
  assert(
    /\.msg-grid-compact[\s\S]{0,240}minmax\(\s*6[0-9]px/.test(style)
      || /\.msg-grid-compact[\s\S]{0,240}minmax\(\s*[7-9][0-9]px/.test(style),
    'compact grid must use minmax ≥60px so 280px yields 3–4 non-overlapping columns',
  )
  // Reject stale false claims of a desktop/narrow max ~5 columns without enforcement
  const falseMaxColClaim = /never exceed\s*~?\s*5\s*columns|max\s*~?\s*5\s*columns|desktop max\s*~?\s*5/i.test(gallery)
  const enforcesMaxCols = /grid-template-columns:\s*repeat\(\s*[1-5]\s*,/.test(style)
    || /max\([^)]*1fr[^)]*\)/.test(style)
  assert(
    !falseMaxColClaim || enforcesMaxCols,
    'must not claim max ~5 columns unless CSS actually enforces a column cap',
  )
  assert(
    /3(?:–|-| to )4\s*columns|3 columns|minmax\(60px\)/i.test(gallery),
    'comments/CSS must truthfully describe 3–4 column / minmax(60px) narrow behavior',
  )
  assert(
    /flex-wrap:\s*wrap/.test(style) && /\.msg-header/.test(style),
    'header must wrap at narrow widths',
  )
  assert(
    /\.msg-head-actions[\s\S]{0,80}flex-wrap:\s*wrap|\.msg-footer[\s\S]{0,80}flex-wrap:\s*wrap/.test(style),
    'actions/footer must wrap at 280px',
  )

  // ── Tactile tokens only in scoped styles (no new hardcoded hex/rgba/blur) ──
  // Allow var(--…) and color-mix with tokens; reject #hex and rgba()/blur(
  const hexHits = style.match(/#[0-9a-fA-F]{3,8}\b/g) || []
  assert(hexHits.length === 0, `scoped styles must not hardcode hex (found ${hexHits.join(', ')})`)
  const rgbaHits = style.match(/rgba?\(/g) || []
  assert(rgbaHits.length === 0, 'scoped styles must not hardcode rgb/rgba')
  assert(!/filter:\s*blur\(|box-shadow:[^;]*blur\(/.test(style), 'no blurred shadows')
  assert(
    /prefers-reduced-motion:\s*reduce/.test(style),
    'must respect prefers-reduced-motion',
  )

  // ── Preserve hunt / ISO / lightbox / filters surface ─────────────────
  assert(/isoTheRest|ISO the rest/.test(gallery), 'ISO the rest must remain')
  assert(/msg-preview|previewStep|onPreviewKey|Escape/.test(gallery), 'lightbox swipe/arrows/Esc must remain')
  assert(/msg-filters|filter === f\.id/.test(gallery), 'filters must remain')
  assert(/Fetching the full set|Could not load the set list|Offline and this set list/.test(gallery),
    'loading/error/offline copy must remain')

  // Lightbox scrim/meta must use theme-stable tokens (not flipping --ink/--bg-card)
  const mainCss = read('src/assets/main.css')
  assert(
    /--scrim\s*:/.test(mainCss) && /--on-scrim\s*:/.test(mainCss),
    'main.css must define fixed --scrim and --on-scrim tokens',
  )
  // Tokens live in :root fixed block and must not be remapped under dark theme
  const darkBlock = mainCss.match(/:root\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] || ''
  assert(
    !/--scrim\s*:/.test(darkBlock) && !/--on-scrim\s*:/.test(darkBlock),
    'dark theme must not remap --scrim / --on-scrim (always-dark scrim + light text)',
  )
  assert(
    /background:\s*var\(--scrim\)/.test(style) || /background:\s*var\(--scrim\);/.test(gallery),
    'msg-preview must use var(--scrim), not color-mix(var(--ink))',
  )
  assert(
    !/color-mix\([^)]*var\(--ink\)/.test(style.match(/\.msg-preview\s*\{[^}]+\}/)?.[0] || ''),
    'msg-preview must not derive scrim from theme-flipping --ink',
  )
  assert(
    /color:\s*var\(--on-scrim\)/.test(style.match(/\.msg-preview-meta\s*\{[^}]+\}/)?.[0] || ''),
    'msg-preview-meta must use var(--on-scrim), not var(--bg-card)',
  )
  assert(
    !/color:\s*var\(--bg-card\)/.test(style.match(/\.msg-preview-meta\s*\{[^}]+\}/)?.[0] || ''),
    'msg-preview-meta must not use flipping --bg-card for text on scrim',
  )

  // No compact field written into masterSets / store showcase meta
  assert(
    !/compact:\s*|masterSets\[.*compact|showcaseMasterSet\([^)]*compact/.test(portfolioStore),
    'portfolio store must not gain compact preference fields',
  )

  // Root panel must not bind a dead msg-compact class (density is grid-switched)
  assert(
    !/:class="\{\s*'msg-compact':\s*compact\s*\}"/.test(gallery)
      && !/class="msg-panel msg-compact"/.test(gallery),
    'must not bind unused root msg-compact class (compact uses msg-grid-compact)',
  )

  // Browser smoke contract: All cards long fixtures, stale Owned, Add-found E2E
  const smoke = read('scripts/smoke/browser-smoke.mjs')
  assert(
    /All cards/i.test(smoke) && /hasLongNum/.test(smoke) && /hasLongName/.test(smoke),
    'browser smoke must switch to All cards and assert long-name + long-number fixtures',
  )
  assert(
    /Smoke Owned Stale Mark/.test(smoke)
      && /staleIsOwned|stale-owned must be \.owned/.test(smoke)
      && /Owned/.test(smoke),
    'browser smoke must assert stale-owned fixture renders Owned (not Found/.got)',
  )
  assert(
    /msg-add-found-btn/.test(smoke)
      && /Add 1 to shelf|add-found/i.test(smoke)
      && /storeHasCard|store owned count/.test(smoke),
    'browser smoke must exercise Add found end-to-end into the seeded shelf store',
  )
  assert(
    /needAfterAdd|reopen need count/.test(smoke)
      && /did not reset to Comfortable/.test(smoke),
    'browser smoke must verify collapse/reopen resets Comfortable with adjusted need counts',
  )
  assert(
    /probeLightboxContrastDom|scrimDark|metaLight|contrastOk/.test(smoke)
      && /dataset\.theme\s*=\s*['"]dark['"]/.test(smoke)
      && /lightbox dark contrast/.test(smoke),
    'browser smoke must switch to dark theme and assert lightbox scrim/meta contrast',
  )
  assert(
    /getHits|intercept never fired|apiHits/.test(smoke)
      && /browse:url:/.test(smoke)
      && /smoke-ms-base|SMOKE_MS_SET_ID/.test(smoke),
    'browser smoke must assert card intercept fired and clean durable browse:url fixture cache',
  )

  ok('master set compact mode v1 guards hold')
})
