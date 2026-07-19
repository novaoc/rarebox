import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { assert, ok, read, root, runEval } from './lib.mjs'

runEval('shelf link URL builder encoding and origin normalization', async () => {
  const modPath = path.join(root, 'src/utils/shelfLink.js')
  const { buildShelfLink } = await import(pathToFileURL(modPath).href)

  assert(typeof buildShelfLink === 'function', 'buildShelfLink must be exported')

  assert(
    buildShelfLink('abc', 'https://rarebox.io') === 'https://rarebox.io/shelf/abc',
    'plain id builds origin-absolute /shelf/ path',
  )
  assert(
    buildShelfLink('a/b c', 'https://rarebox.io') === 'https://rarebox.io/shelf/a%2Fb%20c',
    'id must be encodeURIComponent-encoded',
  )
  assert(
    buildShelfLink('x', 'https://rarebox.io/') === 'https://rarebox.io/shelf/x',
    'trailing slash on origin must be normalized away',
  )
  assert(
    buildShelfLink('x', 'https://rarebox.io///') === 'https://rarebox.io/shelf/x',
    'multiple trailing slashes must collapse',
  )
  assert(
    buildShelfLink('id+1', 'http://127.0.0.1:4173') === 'http://127.0.0.1:4173/shelf/id%2B1',
    'local origins and + encoding must work offline-friendly',
  )
  assert(
    buildShelfLink('', 'https://example.com') === 'https://example.com/shelf/',
    'empty id still yields /shelf/ path segment',
  )

  ok('buildShelfLink encodes ids and normalizes origin')
})

runEval('PortfolioView shelf-link polish source guards', () => {
  const view = read('src/views/PortfolioView.vue')
  const router = read('src/router/index.js')
  const app = read('src/App.vue')

  // Three-state initialized gate — no cold-load false not-found
  assert(/!store\.initialized/.test(view), 'must gate on !store.initialized')
  assert(/Loading shelf/.test(view), 'must show neutral loading while uninitialized')
  assert(/Shelf not found/.test(view), 'must show explicit Shelf not found after init+missing')
  assert(/data-shelf-not-found/.test(view), 'not-found root must be marked for smoke/tests')
  assert(/v-else-if="!portfolio"/.test(view), 'missing shelf branch must use v-else-if="!portfolio"')
  // Order: initialized check before portfolio missing
  const initIdx = view.indexOf('!store.initialized')
  const missingIdx = view.indexOf('Shelf not found')
  const shelfUiIdx = view.indexOf('PullToRefresh')
  assert(initIdx !== -1 && missingIdx !== -1 && initIdx < missingIdx,
    'loading gate must appear before not-found')
  assert(missingIdx < shelfUiIdx, 'not-found must appear before main shelf UI')

  // Dashboard CTA on not-found
  assert(/shelf-not-found-cta/.test(view) && /to="\/"/.test(view),
    'not-found must offer Dashboard CTA')

  // Copy link — desktop + mobile, /shelf/ path via builder
  assert(/buildShelfLink/.test(view), 'must use buildShelfLink helper')
  assert(/Copy link/.test(view), 'must expose Copy link control')
  assert(/shelf-link-btn/.test(view), 'desktop Copy link control must exist')
  assert(/shelf-link-menu-item/.test(view), 'mobile overflow Copy link item must exist')
  assert(/linkCopied/.test(view) && /Copied/.test(view), 'must support brief Copied state')

  // Privacy helper — same device/browser, no upload, Export / Local Sync
  assert(/same device and browser only/i.test(view), 'privacy copy must say same device/browser only')
  assert(/Nothing is uploaded/i.test(view), 'privacy copy must say nothing is uploaded')
  assert(/Export or Local Sync/i.test(view), 'privacy copy must point to Export or Local Sync')
  assert(!/public(ly)?\s+share|anyone with the link|share with friends/i.test(view),
    'must not imply public sharing')

  // Clipboard fallback — no silent failure, no execCommand
  assert(/navigator\.clipboard/.test(view), 'must use clipboard API')
  assert(/showLinkFallback|data-shelf-link-fallback/.test(view),
    'must expose visible URL fallback path')
  assert(/readonly/.test(view) && /shelf-link-input/.test(view),
    'fallback URL input must be readonly/selectable')
  assert(/Could not copy automatically/.test(view), 'must show concise copy error/help')
  assert(!/execCommand/.test(view), 'must not use deprecated execCommand')

  // Touch targets ≥44px
  assert(/shelf-link-btn[\s\S]{0,80}min-height:\s*44px|\.shelf-link-btn\s*\{[^}]*min-height:\s*44px/.test(view),
    'desktop Copy link must be ≥44px')
  assert(/dropdown-menu button[\s\S]{0,120}min-height:\s*44px|\.dropdown-menu button\s*\{[^}]*min-height:\s*44px/.test(view),
    'mobile dropdown items must be ≥44px')
  assert(/shelf-link-menu-item/.test(view) && /min-height:\s*44px/.test(view),
    'mobile Copy link menu item targets ≥44px')
  // Mobile more-actions trigger (entry path to Copy link) ≥44px + accessible name
  assert(/shelf-more-actions-btn/.test(view),
    'mobile more-actions trigger must use scoped shelf-more-actions-btn class')
  assert(/shelf-more-actions-btn[\s\S]{0,120}min-height:\s*44px|\.shelf-more-actions-btn\s*\{[^}]*min-height:\s*44px/.test(view),
    'mobile more-actions trigger must be ≥44px')
  assert(/shelf-more-actions-btn[\s\S]{0,200}aria-label\s*=\s*["']More shelf actions["']|aria-label\s*=\s*["']More shelf actions["'][\s\S]{0,200}shelf-more-actions-btn/.test(view),
    'mobile more-actions trigger must have aria-label')

  // Tokens only in new styles (no hardcoded hex in shelf-link scoped block)
  const style = view.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] || ''
  const shelfStyleChunks = style.match(/\.shelf-link[\s\S]*?(?=\n\.|\n@media|$)/g) || []
  for (const chunk of shelfStyleChunks) {
    assert(!/#[0-9a-fA-F]{3,8}/.test(chunk), 'shelf-link styles must use tokens, not hex')
  }
  assert(/var\(--danger-text\)/.test(style), 'copy error must use danger-text token')

  // Post-init setup/refresh once per valid id; no work for missing/empty
  assert(/lastSetupShelfId/.test(view), 'must track last setup shelf id to avoid duplicate refresh')
  assert(/store\.initialized/.test(view) && /lastSetupShelfId/.test(view),
    'setup watch must depend on store.initialized')
  assert(/startShelfSetup|loadMsSetMeta\(/.test(view) && /refreshPrices\(/.test(view),
    'valid shelf must still run setup + price refresh after init')
  // Must not auto-refresh on bare onMounted anymore (cold race)
  assert(!/onMounted\s*\(\s*\(\s*\)\s*=>\s*\{\s*refreshPrices/.test(view),
    'must not call refreshPrices on bare onMounted (cold-load race)')
  // Missing non-empty shelf id: zero setup/API work after init (hasShelf / portfolio match)
  assert(/hasShelf/.test(view),
    'setup watch must track hasShelf so missing ids skip setup')
  assert(/!hasShelf|hasShelf/.test(view) && /portfolios\.some\(\s*p\s*=>\s*p\.id\s*===\s*instanceShelfId\s*\)/.test(view),
    'hasShelf must resolve via portfolios matching instanceShelfId')
  const setupFn = view.match(/function\s+startShelfSetup\s*\([^)]*\)\s*\{[\s\S]*?\n\}/)
  assert(setupFn, 'startShelfSetup function must exist')
  assert(/portfolios\.some\(\s*p\s*=>\s*p\.id\s*===\s*id\s*\)/.test(setupFn[0]),
    'startShelfSetup must require a matching portfolio before work')
  assert(/loadMsSetMeta\(/.test(setupFn[0]) && /refreshPrices\(/.test(setupFn[0]),
    'startShelfSetup must still call loadMsSetMeta + refreshPrices when shelf exists')
  // loadMsSetMeta itself must bail before API work when shelf missing
  assert(/const shelf\s*=\s*store\.portfolios\.find[\s\S]{0,80}if\s*\(\s*!shelf\s*\)\s*return/.test(view),
    'loadMsSetMeta must return before API work when shelf is missing')

  // Primary A→B isolation: capture route id primitive at setup; do not bind identity to live route
  assert(/instanceShelfId/.test(view), 'must capture instanceShelfId at setup')
  assert(/const\s+instanceShelfId\s*=/.test(view), 'instanceShelfId must be a setup-time const primitive')
  // Capture may go through a raw temp (`_rawRouteId = route.params.id`) then normalize
  const idCaptureBlock = view.match(/route\.params\.id[\s\S]{0,280}?const\s+instanceShelfId\s*=[\s\S]{0,200}/)?.[0]
    || view.match(/const\s+instanceShelfId\s*=[\s\S]{0,200}route\.params\.id/)?.[0]
    || ''
  assert(/route\.params\.id/.test(idCaptureBlock) && /instanceShelfId/.test(idCaptureBlock),
    'instanceShelfId must be derived from route.params.id at setup')
  assert(/store\.portfolios\.find\(\s*p\s*=>\s*p\.id\s*===\s*instanceShelfId\s*\)/.test(view),
    'portfolio computed must resolve via instanceShelfId, not live route')
  assert(/getPortfolioStats\(\s*instanceShelfId\s*\)/.test(view),
    'stats must use instanceShelfId, not live route.params.id')
  assert(!/store\.portfolios\.find\(\s*p\s*=>\s*p\.id\s*===\s*route\.params\.id\s*\)/.test(view),
    'portfolio must not re-bind to live route.params.id during leave transition')
  assert(!/getPortfolioStats\(\s*route\.params\.id\s*\)/.test(view),
    'stats must not re-bind to live route.params.id')

  // Captured shelf id: refresh writes use snapshot shelfId (instance-bound portfolio)
  const refreshFn = view.match(/async function refreshPrices\s*\(\)\s*\{[\s\S]*?\n\}/)
  assert(refreshFn, 'refreshPrices function must exist')
  assert(/const shelfId\s*=\s*portfolio\.value\.id/.test(refreshFn[0]),
    'refreshPrices must capture starting shelf id')
  assert(/itemsSnapshot|items\.slice\(/.test(refreshFn[0]),
    'refreshPrices must snapshot items at start')
  assert(/store\.updateItem\(\s*shelfId\s*,/.test(refreshFn[0]),
    'refreshPrices updateItem writes must use captured shelfId')
  assert(/recordSnapshot\(\s*shelfId\s*\)/.test(refreshFn[0]),
    'refreshPrices snapshot must use captured shelfId')
  assert(!/store\.updateItem\(\s*portfolio\.value\.id\s*,/.test(refreshFn[0]),
    'refreshPrices must not re-read portfolio.value.id for updateItem')
  assert(!/recordSnapshot\(\s*portfolio\.value\.id\s*\)/.test(refreshFn[0]),
    'refreshPrices must not re-read portfolio.value.id for recordSnapshot')

  // Same-instance deferral safety net (not primary A→B mechanism — that is instanceShelfId)
  assert(/pendingSetupShelfId/.test(view), 'must defer setup when refresh in-flight on same instance')
  assert(/flushPendingShelfSetup/.test(view), 'must flush deferred setup after refresh settles')
  assert(/if\s*\(\s*refreshing\.value\s*\)\s*\{[\s\S]{0,80}pendingSetupShelfId\s*=\s*id/.test(view),
    'setup watcher must defer id when refreshing instead of marking complete')
  assert(/startShelfSetup/.test(view), 'setup must go through startShelfSetup (mark complete only when work starts)')
  assert(/id\s*!==\s*instanceShelfId|instanceShelfId\s*!==\s*id/.test(view),
    'startShelfSetup must refuse ids other than this instanceShelfId')
  // lastSetupShelfId must not be assigned in the watcher before the refreshing early-return
  const setupWatch = view.match(/watch\(\s*\n?\s*\(\)\s*=>\s*\(\{\s*ready:\s*store\.initialized[\s\S]*?\},\s*\{[^}]*immediate:\s*true/)
  assert(setupWatch, 'setup watch with immediate:true must exist')
  assert(/instanceShelfId/.test(setupWatch[0]),
    'setup watch must key off instanceShelfId (not live portfolio/route rebind)')
  assert(/refreshing\.value/.test(setupWatch[0]) && /pendingSetupShelfId/.test(setupWatch[0]),
    'setup watch must branch on refreshing and defer pending id')
  assert(!/lastSetupShelfId\.value\s*=\s*id[\s\S]{0,40}loadMsSetMeta\(\)/.test(setupWatch[0]),
    'setup watch must not mark complete then call bare loadMsSetMeta (old race)')

  // loadMsSetMeta stale-generation / instance shelf-id guard
  const metaFn = view.match(/async function loadMsSetMeta\s*\([^)]*\)\s*\{[\s\S]*?\n\}/)
  assert(metaFn, 'loadMsSetMeta function must exist')
  assert(/msMetaGen/.test(view) && /const gen\s*=\s*\+\+msMetaGen/.test(metaFn[0]),
    'loadMsSetMeta must bump a generation token')
  assert(/gen\s*!==\s*msMetaGen/.test(metaFn[0]),
    'loadMsSetMeta must drop stale completions via generation')
  assert(/instanceShelfId\s*!==\s*shelfId|shelfId\s*!==\s*instanceShelfId/.test(metaFn[0]),
    'loadMsSetMeta must guard against wrong instance shelf id')

  // Unmount cleanup: disposed gate + resize listener + timers/generations
  assert(/onBeforeUnmount/.test(view), 'must clean up on unmount')
  const unmountFn = view.match(/onBeforeUnmount\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)/)
  assert(unmountFn, 'onBeforeUnmount handler must exist')
  assert(/disposed\s*=\s*true/.test(unmountFn[0]),
    'must set disposed flag on unmount so dead instance cannot start setup/refresh')
  assert(/clearTimeout\(\s*linkCopiedTimer\s*\)/.test(unmountFn[0]),
    'must clear linkCopiedTimer on unmount')
  assert(/msMetaGen\+\+/.test(unmountFn[0]),
    'must invalidate in-flight meta generation on unmount')
  assert(/pendingSetupShelfId\s*=\s*null/.test(unmountFn[0]),
    'must clear pending setup queue on unmount')
  // Named resize handler + removeEventListener (no anonymous leak)
  assert(/function\s+onWindowResize\s*\(/.test(view),
    'resize listener must use a named onWindowResize handler')
  assert(/addEventListener\(\s*['"]resize['"]\s*,\s*onWindowResize\s*\)/.test(view),
    'must add resize listener with named handler')
  assert(/removeEventListener\(\s*['"]resize['"]\s*,\s*onWindowResize\s*\)/.test(unmountFn[0]),
    'must remove resize listener on unmount')

  // Disposed gate: finally flush, flushPending, startShelfSetup, loadMsSetMeta completion
  assert(/let\s+disposed\s*=\s*false/.test(view), 'must declare disposed flag defaulting false')
  assert(/function\s+startShelfSetup\s*\([^)]*\)\s*\{[\s\S]*?\bif\s*\(\s*disposed/.test(view),
    'startShelfSetup must no-op when disposed')
  assert(/function\s+flushPendingShelfSetup\s*\([^)]*\)\s*\{[\s\S]*?\bif\s*\(\s*disposed/.test(view),
    'flushPendingShelfSetup must no-op when disposed')
  assert(/if\s*\(\s*!disposed\s*\)\s*flushPendingShelfSetup\s*\(\s*\)|if\s*\(\s*!disposed\s*\)\s*\{[\s\S]{0,40}flushPendingShelfSetup/.test(view),
    'refreshPrices finally must not flush setup after dispose')
  assert(/if\s*\(\s*disposed\s*\|\|\s*gen\s*!==\s*msMetaGen\s*\)\s*return|if\s*\(\s*disposed\s*\)\s*return[\s\S]{0,80}gen\s*!==\s*msMetaGen/.test(metaFn[0]),
    'loadMsSetMeta completion must no-op when disposed')
  // Alert priceMap: preserve explicit $0 via finiteMoney/nullish, not ||
  assert(/finiteMoney\(\s*item\.currentMarketPrice\s*\)\s*\?\?\s*finiteMoney\(\s*item\.purchasePrice\s*\)\s*\?\?\s*0/.test(refreshFn[0]),
    'alert priceMap must preserve $0 with finiteMoney/?? not ||')
  assert(!/currentMarketPrice\s*\|\|\s*item\.purchasePrice\s*\|\|\s*0/.test(refreshFn[0]),
    'alert priceMap must not collapse $0 with ||')

  // Document fullPath key so A/B get distinct component instances (pairs with instanceShelfId)
  assert(/:key="route\?\.fullPath"|:key='route\?\.fullPath'/.test(app),
    'App.vue router-view must key component by route.fullPath (A/B instance isolation)')

  // Fallback focus/select + aria-live for Copied/error
  assert(/shelfLinkInputRef|focusShelfLinkFallback/.test(view),
    'must focus/select readonly fallback after it appears')
  assert(/aria-live/.test(view) && /linkAriaLive|Copied/.test(view),
    'must expose aria-live feedback for Copied/error')

  // Preserve existing actions
  for (const label of ['↑ Import', '↻ Prices', '↓ Export', 'Delete', '★ Master Set', 'Bulk Import']) {
    assert(view.includes(label) || (label === '↑ Import' && /Import/.test(view)),
      `must preserve control: ${label}`)
  }
  assert(/exportPortfolio/.test(view) && /confirmDelete/.test(view) && /openMasterSetModal/.test(view),
    'Export/Delete/Master Set handlers must remain')
  assert(/showBulkImport/.test(view) && /refreshPrices/.test(view),
    'Import and Prices must remain')

  // No store/db/backup mutations introduced for link feature
  assert(!/createPortfolio\(/.test(view), 'Copy link must not create shelves')
  const copyFn = view.match(/async function copyShelfLink\s*\([\s\S]*?\n\}/)
  assert(copyFn, 'copyShelfLink function must exist')
  assert(!/persist|deletePortfolio|createPortfolio|addItem|updateItem/.test(copyFn[0]),
    'copyShelfLink must not mutate store/db')

  // Route safety: /shelf/:id alias remains; catch-all unchanged; named redirect preferred
  assert(/path:\s*'\/shelf\/:id'/.test(router), '/shelf/:id route must remain')
  assert(/path:\s*'\/portfolio\/:id'/.test(router), '/portfolio/:id route must remain')
  assert(/path:\s*'\/:pathMatch\(\.\*\)\*'/.test(router), 'catch-all must remain')
  const shelfRouteIdx = router.indexOf("path: '/shelf/:id'")
  const catchAllIdx = router.indexOf("path: '/:pathMatch(.*)*'")
  assert(shelfRouteIdx !== -1 && catchAllIdx !== -1 && shelfRouteIdx < catchAllIdx,
    '/shelf/:id must stay before catch-all')
  assert(/name:\s*'Portfolio'/.test(router) && /params:\s*\{\s*id:/.test(router),
    '/shelf/:id redirect should use named Portfolio route params')
  assert(!/path:\s*'\/portfolio\/'\s*\+\s*to\.params\.id/.test(router),
    '/shelf/:id must not string-concat portfolio path')

  // User-facing shelf wording (not portfolio) on new UI
  assert(/Shelf not found/.test(view), 'user-facing not-found uses shelf')
  assert(/Shelf link/.test(view), 'fallback label uses shelf')
  assert(!/Portfolio not found/.test(view), 'must not say Portfolio not found')

  ok('PortfolioView initialized gate, copy link, privacy, race guards, and route guards hold')
})
