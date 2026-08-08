<template>
  <!-- Three-state gate: wait for store init before claiming missing shelf -->
  <div v-if="!store.initialized" class="portfolio-view shelf-gate" aria-busy="true" aria-live="polite">
    <div class="empty-state shelf-gate-state">
      <div class="spinner spinner-lg" aria-hidden="true"></div>
      <h3>Loading shelf…</h3>
      <p class="text-secondary">Opening your local collection</p>
    </div>
  </div>

  <div v-else-if="!portfolio" class="portfolio-view shelf-gate" data-shelf-not-found>
    <div class="empty-state shelf-gate-state">
      <div class="icon"><RbIcon name="mailbox" :size="44" /></div>
      <h3>Shelf not found</h3>
      <p class="text-secondary">This shelf is not in your local collection on this device.</p>
      <router-link to="/" class="btn btn-primary mt-3 shelf-not-found-cta">Dashboard</router-link>
    </div>
  </div>

  <div class="portfolio-view" v-else>
    <PullToRefresh :refreshing="refreshing" @refresh="refreshPrices" aria-label="Pull to refresh">
      <!-- Header -->
      <div class="portfolio-header">
        <div class="portfolio-title-row">
          <span class="portfolio-dot-lg" :style="{ background: portfolio.color }"></span>
          <div>
            <h2 class="portfolio-name" v-if="!editingName" @click="startEditName">
              {{ portfolio.name }}
              <span class="edit-icon text-muted" style="font-size:13px;margin-left:6px">✎</span>
            </h2>
            <div v-else class="name-edit-row">
              <input v-model="editName" class="input name-input" @keyup.enter="saveName" @keyup.escape="editingName = false" ref="nameInputRef" />
              <div class="flex gap-2 mt-2 mobile-full-width">
                <button class="btn btn-primary btn-sm flex-1" @click="saveName">Save</button>
                <button class="btn btn-ghost btn-sm flex-1" @click="editingName = false">Cancel</button>
              </div>
            </div>
            <div class="portfolio-meta text-muted">{{ portfolio.items.length }} items · Created {{ formatDate(portfolio.createdAt) }}</div>
          </div>
        </div>
        <div class="portfolio-header-actions">
          <router-link to="/search" class="btn btn-primary btn-sm">+ Add Card</router-link>
          <button class="btn btn-secondary btn-sm" @click="showAddSealed = true">+ Sealed</button>
          <button class="btn btn-secondary btn-sm" @click="openMasterSetModal">★ Master Set</button>
          
          <!-- Dropdown for secondary actions on mobile -->
          <div class="action-dropdown" v-if="isMobile">
            <button type="button" class="btn btn-secondary btn-icon shelf-more-actions-btn" @click="showActionsMenu = !showActionsMenu" aria-label="More shelf actions">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <transition name="fade">
              <div v-if="showActionsMenu" class="dropdown-menu" @click="showActionsMenu = false">
                <button type="button" class="shelf-link-menu-item" @click.stop="copyShelfLink">{{ linkCopied ? 'Copied' : 'Copy link' }}</button>
                <button type="button" @click="showBulkImport = true">↑ Bulk Import</button>
                <button type="button" :disabled="refreshing" @click="refreshPrices">↻ Refresh Prices</button>
                <button type="button" @click="exportPortfolio">↓ Export Excel</button>
                <button type="button" class="text-danger" @click="confirmDelete = true">Delete Shelf</button>
              </div>
            </transition>
          </div>
          
          <template v-else>
            <button type="button" class="btn btn-secondary btn-sm shelf-link-btn" @click="copyShelfLink">{{ linkCopied ? 'Copied' : 'Copy link' }}</button>
            <button class="btn btn-secondary btn-sm" @click="showBulkImport = true">↑ Import</button>
            <button class="btn btn-secondary btn-sm" :disabled="refreshing" @click="refreshPrices">
              <span v-if="refreshing" class="spinner spinner-sm"></span>
              <span v-else>↻ Prices</span>
            </button>
            <button class="btn btn-secondary btn-sm" @click="exportPortfolio">↓ Export</button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete = true">Delete</button>
          </template>
        </div>
        <p class="shelf-link-help text-muted">
          This link opens this shelf on the same device and browser only. Nothing is uploaded. On another device, use Export or Local Sync.
        </p>
        <div v-if="linkCopyError || showLinkFallback" class="shelf-link-fallback" data-shelf-link-fallback>
          <p v-if="linkCopyError" class="shelf-link-error" role="alert">{{ linkCopyError }}</p>
          <label class="shelf-link-fallback-label text-muted" for="shelf-link-url-input">Shelf link</label>
          <input
            id="shelf-link-url-input"
            ref="shelfLinkInputRef"
            class="input shelf-link-input"
            type="text"
            readonly
            :value="shelfLinkUrl"
            @focus="selectShelfLinkInput"
          />
        </div>
        <div class="sr-only" aria-live="polite">{{ linkAriaLive }}</div>
        <div v-if="refreshStatus" class="refresh-status-banner text-muted">{{ refreshStatus }}</div>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-tile" :class="{ 'shimmer-active': refreshing }">
          <div class="label">Total Value</div>
          <div class="value" :class="{ 'shimmer': refreshing }">
            <template v-if="!refreshing"><span class="sticker sticker-green total-value-sticker">${{ stats.totalValue.toFixed(2) }}</span></template>
            <template v-else>&nbsp;</template>
          </div>
          <div class="sub">{{ stats.itemCount }} items</div>
        </div>
        <div class="stat-tile" :class="{ 'shimmer-active': refreshing }">
          <div class="label">Cost Basis</div>
          <div class="value" :class="{ 'shimmer': refreshing }">
            <template v-if="!refreshing">${{ stats.totalCost.toFixed(2) }}</template>
            <template v-else>&nbsp;</template>
          </div>
        </div>
        <div class="stat-tile" :class="{ 'shimmer-active': refreshing }">
          <div class="label">Total Gain/Loss</div>
          <div class="value" :class="[stats.gain >= 0 ? 'text-success' : 'text-danger', { 'shimmer': refreshing }]">
            <template v-if="!refreshing">{{ stats.gain >= 0 ? '+' : '' }}${{ Math.abs(stats.gain).toFixed(2) }}</template>
            <template v-else>&nbsp;</template>
          </div>
          <div class="sub" :class="[stats.gainPct >= 0 ? 'text-success' : 'text-danger', { 'shimmer': refreshing }]">
            <template v-if="!refreshing">{{ stats.gainPct >= 0 ? '+' : '' }}{{ stats.gainPct.toFixed(1) }}%</template>
            <template v-else>&nbsp;</template>
          </div>
        </div>
        <div class="stat-tile hide-mobile" v-if="stats.topGainer">
          <div class="label">Top Gainer</div>
          <div class="value" style="font-size:16px">{{ stats.topGainer.item.cardData?.name || stats.topGainer.item.name }}</div>
          <div class="sub text-success">+{{ stats.topGainer.gain.toFixed(1) }}%</div>
        </div>
      </div>

      <!-- Portfolio chart -->
      <div class="card mb-4 hide-mobile">
        <div class="section-header">
          <div>
            <div class="section-title">Shelf Value</div>
            <div class="section-subtitle">Historical value over time</div>
          </div>
        </div>
        <PortfolioChart :portfolios="[portfolio]" :height="280" :label="portfolio.name" />
      </div>

      <!-- Master set suggestion — appears when a set crosses 80% owned -->
      <div v-if="msSuggestion" class="ms-suggest">
        <span class="ms-suggest-text">
          <template v-if="!msSuggestion.total">You have <strong>{{ msSuggestion.owned }} cards</strong> from <strong>{{ msSuggestion.name }}</strong> — showcase the stack as a master set?</template>
          <template v-else-if="msSuggestion.owned >= msSuggestion.total"><RbIcon name="confetti" :size="15" /> Your <strong>{{ msSuggestion.name }}</strong> set is complete — showcase it as a master set?</template>
          <template v-else>You're <strong>{{ msSuggestion.total - msSuggestion.owned }} card{{ msSuggestion.total - msSuggestion.owned === 1 ? '' : 's' }}</strong> from a <strong>{{ msSuggestion.name }}</strong> master set ({{ msSuggestion.owned }}/{{ msSuggestion.total }}) — showcase the stack?</template>
        </span>
        <div class="ms-suggest-actions">
          <button class="btn btn-primary btn-sm" @click="showcaseSuggestion">Showcase</button>
          <button class="btn btn-ghost btn-sm" @click="store.dismissMasterSetSuggestion(portfolio.id, msSuggestion.key)">Not now</button>
        </div>
      </div>

      <!-- Master sets showcase — each stack's Hunt gallery expands inline
           right beneath it, accordion-style -->
      <div v-if="masterSetGroups.length" class="ms-showcase">
        <div v-for="g in masterSetGroups" :key="g.key" class="ms-showcase-item">
          <MasterSetStack
            :group="g"
            :open="msGalleryKey === g.key"
            @open="msGalleryKey === g.key ? (msGalleryKey = null) : (msGalleryKey = g.key)"
            @unshowcase="store.unshowcaseMasterSet(portfolio.id, g.key)"
          />
          <MasterSetGallery
            v-if="msGalleryKey === g.key"
            :group="g"
            :marks="g.hunt"
            @close="msGalleryKey = null"
            @toggle-mark="(cardId) => store.toggleHuntMark(portfolio.id, g.key, cardId)"
            @add-found="addFoundCards"
            @loaded="(n) => msGalleryLoaded(g, n)"
          />
        </div>
      </div>

      <!-- Items view -->
      <div class="card no-padding-mobile">
        <div class="section-header px-mobile">
          <div>
            <div class="section-title">Items</div>
            <div class="section-subtitle">{{ filteredItems.length }} of {{ portfolio.items.length }}</div>
          </div>
        </div>
        
        <div class="sticky-filter-bar">
          <div class="filter-tabs-wrap">
            <div class="filter-tabs">
              <button
                v-for="f in filters"
                :key="f.value"
                class="filter-tab"
                :class="{ active: activeFilter === f.value }"
                @click="activeFilter = f.value"
              >{{ f.label }} <span class="filter-count">{{ filterCount(f.value) }}</span></button>
            </div>
          </div>
          <div class="search-mini-wrap px-mobile mt-2">
            <input v-model="itemSearch" class="input input-sm" placeholder="Search shelf..." />
          </div>
        </div>

        <div v-if="filteredItems.length === 0" class="empty-state">
          <div class="icon"><RbIcon name="mailbox" :size="44" /></div>
          <h3>No items match your filters</h3>
          <button v-if="activeFilter !== 'all' || itemSearch" class="btn btn-secondary mt-3" @click="activeFilter = 'all'; itemSearch = ''">Clear Filters</button>
          <template v-else>
            <router-link to="/search" class="btn btn-primary mt-3">Search Cards</router-link>
            <router-link to="/guide/shelves" class="btn btn-ghost mt-3">How shelves work</router-link>
          </template>
        </div>

        <div v-else>
          <!-- Desktop Table View -->
          <div class="table-wrap hide-mobile">
          <table class="table">
            <thead>
              <tr>
                <th class="checkbox-col">
                  <div class="checkbox-wrapper">
                    <input
                      type="checkbox"
                      :checked="isAllSelected"
                      :indeterminate="isPartiallySelected"
                      @change="toggleSelectAll"
                    />
                  </div>
                </th>
                <th>Item</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Paid</th>
                <th>Value</th>
                <th>Gain/Loss</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredItems"
                :key="item.id"
                class="item-row"
                :class="{ selected: selectedIds.has(item.id) }"
                @click="selectItem(item)"
              >
                <td class="checkbox-col" @click.stop>
                  <div class="checkbox-wrapper">
                    <input type="checkbox" :checked="selectedIds.has(item.id)" @change="toggleItemSelection(item.id)" />
                  </div>
                </td>
                <td>
                  <div class="item-name-cell">
                    <img v-if="item.cardData?.images?.small || item.imageUrl" :src="item.cardData?.images?.small || item.imageUrl" class="item-thumb" loading="lazy" />
                    <div class="item-sealed-icon" v-else><RbIcon name="box" :size="22" /></div>
                    <div>
                      <div class="item-name">{{ getItemName(item) }}</div>
                      <div class="item-sub">{{ getItemSub(item) }}</div>
                    </div>
                  </div>
                </td>
                <td><span class="badge" :class="typeBadgeClass(item.type)">{{ item.type }}</span></td>
                <td class="font-mono">{{ item.quantity || 1 }}</td>
                <td class="font-mono">${{ ((item.purchasePrice || 0) * (item.quantity || 1)).toFixed(2) }}</td>
                <td class="font-mono"><span class="text-accent">${{ (getCurrentValue(item) * (item.quantity || 1)).toFixed(2) }}</span></td>
                <td>
                  <div class="gain-cell">
                    <span :class="getGain(item) >= 0 ? 'text-success' : 'text-danger'">
                      {{ getGain(item) >= 0 ? '+' : '' }}${{ Math.abs(getGain(item)).toFixed(2) }}
                    </span>
                    <span class="gain-pct text-muted">({{ getGainPct(item) >= 0 ? '+' : '' }}{{ getGainPct(item).toFixed(1) }}%)</span>
                  </div>
                </td>
                <td>
                  <div class="actions flex gap-2">
                    <button class="btn btn-ghost btn-icon btn-sm" @click.stop="editItem(item)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
                    <button class="btn btn-ghost btn-icon btn-sm text-danger" @click.stop="removeItem(item)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          <!-- Mobile High-Density List View -->
          <div class="mobile-item-list show-mobile">
            <div
              v-for="item in filteredItems"
              :key="item.id"
              class="mobile-item-card"
              :class="{ selected: selectedIds.has(item.id) }"
              @click="selectItem(item)"
            >
              <div class="mobile-item-checkbox" @click.stop="toggleItemSelection(item.id)">
                <div class="custom-checkbox" :class="{ checked: selectedIds.has(item.id) }"></div>
              </div>
              <img v-if="item.cardData?.images?.small || item.imageUrl" :src="item.cardData?.images?.small || item.imageUrl" class="mobile-item-thumb" />
              <div class="mobile-item-info">
                <div class="mobile-item-name">{{ getItemName(item) }}</div>
                <div class="mobile-item-sub">{{ getItemSub(item) }}</div>
                <div class="mobile-item-stats mt-1">
                  <span class="text-accent font-bold">${{ (getCurrentValue(item) * (item.quantity || 1)).toFixed(2) }}</span>
                  <span class="text-muted">· {{ item.quantity || 1 }} qty</span>
                  <span :class="getGain(item) >= 0 ? 'gain-pos' : 'gain-neg'" class="mobile-item-gain">
                    {{ getGainPct(item) >= 0 ? '+' : '' }}{{ getGainPct(item).toFixed(1) }}%
                  </span>
                </div>
              </div>
              <div class="mobile-item-menu" @click.stop="openItemMenu(item)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PullToRefresh>

    <!-- Mobile Bottom Action Menu (for specific item) -->
    <transition name="slide-up">
      <div v-if="activeItemMenu" class="bottom-sheet-overlay" @click="activeItemMenu = null">
        <div class="bottom-sheet" @click.stop>
          <div class="bottom-sheet-header">
            <div class="bottom-sheet-title">{{ getItemName(activeItemMenu) }}</div>
            <div class="bottom-sheet-subtitle">{{ getItemSub(activeItemMenu) }}</div>
          </div>
          <div class="bottom-sheet-actions">
            <button @click="selectItem(activeItemMenu); activeItemMenu = null">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              View Details & Analysis
            </button>
            <button @click="editItem(activeItemMenu); activeItemMenu = null">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              Edit Quantity & Price
            </button>
            <button class="text-danger" @click="removeItem(activeItemMenu); activeItemMenu = null">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              Remove from Shelf
            </button>
          </div>
          <button class="btn btn-ghost btn-lg w-full mt-2" @click="activeItemMenu = null">Cancel</button>
        </div>
      </div>
    </transition>

    <!-- Bulk Action Bar -->
    <transition name="slide-up">
      <div v-if="selectedIds.size > 0" class="bulk-action-bar">
        <div class="bulk-action-content">
          <div class="bulk-info">
            <span class="bulk-count">{{ selectedIds.size }}</span>
            <span class="bulk-label">{{ selectedIds.size === 1 ? 'item' : 'items' }} selected</span>
          </div>
          <div class="bulk-actions">
            <button class="btn btn-ghost btn-sm" @click="selectedIds.clear()">Cancel</button>
            <button class="btn btn-danger btn-sm" @click="confirmBulkDelete = true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Item detail panel (6.5) — grab-handle bottom sheet on phones,
         inline card on desktop. Art rides a framed −2° mat; quantity is a
         stepper and grades are key-caps, both persisting immediately. -->
    <transition name="slide-up">
      <div v-if="selectedItem" class="item-detail-panel card">
        <button
          type="button"
          class="panel-grab-zone"
          aria-label="Close details"
          @click="selectedItem = null"
          @touchstart.passive="sheetTouchY = $event.changedTouches[0].clientY"
          @touchend="($event.changedTouches[0].clientY - sheetTouchY > 48) && (selectedItem = null)"
        ><span class="panel-grab" aria-hidden="true"></span></button>
        <div class="panel-header-row">
          <h3>{{ getItemName(selectedItem) }}</h3>
          <button class="btn btn-ghost btn-icon" @click="selectedItem = null" aria-label="Close details">✕</button>
        </div>
        <div class="panel-body-row">
          <div class="panel-left" v-if="selectedItem.cardData?.images?.small || selectedItem.imageUrl">
            <div class="panel-art-frame">
              <img :src="selectedItem.cardData?.images?.large || selectedItem.cardData?.images?.small || selectedItem.imageUrl" class="panel-img" @error="$event.target.style.display='none'" />
            </div>
          </div>
          <div class="panel-right">
            <div class="panel-info-grid">
              <div class="info-row"><span class="info-label">Type</span><span class="badge" :class="typeBadgeClass(selectedItem.type)">{{ selectedItem.type }}</span></div>
              <div class="info-row" v-if="selectedItem.priceVariant"><span class="info-label">Variant</span><span>{{ formatVariantLabel(selectedItem.priceVariant) }}</span></div>
              <div class="info-row"><span class="info-label">Quantity</span>
                <div class="stepper" role="group" aria-label="Quantity">
                  <button type="button" class="stepper-btn" :disabled="(selectedItem.quantity || 1) <= 1" aria-label="Decrease quantity" @click="bumpQuantity(-1)">−</button>
                  <span class="stepper-value">{{ selectedItem.quantity || 1 }}</span>
                  <button type="button" class="stepper-btn" aria-label="Increase quantity" @click="bumpQuantity(1)">+</button>
                </div>
              </div>
              <div class="info-row"><span class="info-label">Paid (each)</span><span>${{ (selectedItem.purchasePrice || 0).toFixed(2) }}</span></div>
              <div class="info-row"><span class="info-label">Current Value</span><span class="text-accent font-bold">${{ getCurrentValue(selectedItem).toFixed(2) }}</span></div>
              <div class="info-row"><span class="info-label">Purchased</span><span>{{ selectedItem.purchaseDate || '—' }}</span></div>
            </div>

            <!-- Grade key-caps: the slab's company + grade as physical keys,
                 pressed-in on the current values. Changing one persists and
                 refreshes the graded-fetch query for the new grade. -->
            <div v-if="selectedItem.type === 'graded'" class="mt-4">
              <div class="pc-fetch-label">Grade</div>
              <div class="keycap-row">
                <button v-for="c in GRADE_COMPANIES" :key="c" type="button" class="keycap keycap-sm" :class="{ selected: (selectedItem.gradingCompany || 'PSA') === c }" @click="setItemGradeCompany(c)">{{ c }}</button>
              </div>
              <div class="keycap-row mt-2">
                <button v-for="g in itemGradeOptions" :key="g" type="button" class="keycap keycap-sm" :class="{ selected: String(selectedItem.grade) === g }" @click="setItemGrade(g)">{{ g }}</button>
              </div>
            </div>

            <div v-if="selectedItem.type === 'graded' || selectedItem.type === 'sealed'" class="mt-4">
              <div class="form-group">
                <label class="form-label">Update Current Value ($)</label>
                <div class="flex gap-2">
                  <input v-model.number="editCurrentValue" class="input input-sm" type="number" step="0.01" :placeholder="getCurrentValue(selectedItem).toFixed(2)" />
                  <button class="btn btn-primary btn-sm" @click="saveCurrentValue">Save</button>
                </div>
              </div>

              <!-- PriceCharting graded/sealed fetch -->
              <div class="pc-fetch-section mt-4">
                <div class="pc-fetch-label">Fetch from PriceCharting</div>
                <div class="flex gap-2 pc-fetch-row">
                  <input v-model="pcQuery" class="input input-sm" placeholder="Search query…" @keyup.enter="searchPC" aria-label="PriceCharting search query" />
                  <button class="btn btn-secondary pc-fetch-btn" :disabled="pcSearching || !pcQuery.trim()" @click="searchPC">
                    <span v-if="pcSearching" class="spinner spinner-sm"></span>
                    <span v-else>Fetch</span>
                  </button>
                </div>
                <div v-if="pcError" class="text-danger mt-2" style="font-size:12px">{{ pcError }}</div>
                <div v-if="pcResult" class="pc-result-box mt-3">
                  <div class="pc-result-price-main">${{ pcResult.price.toFixed(2) }}</div>
                  <div class="pc-result-meta">{{ pcResult.product_name }} · PriceCharting</div>
                  <button class="btn btn-primary pc-apply-btn w-full mt-3" @click="applyPCPrice">Apply Price</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="selectedItem.type === 'card' && selectedItem.cardId" class="panel-chart-section">
          <div class="section-title mb-3 px-mobile">Price History</div>
          <PriceChart :cardId="selectedItem.cardId || ''" :cardRef="itemHistoryRef(selectedItem)" :currentPrice="selectedItem.currentMarketPrice" :height="220" />
        </div>
      </div>
    </transition>

    <!-- Bulk Import Modal -->
    <transition name="fade">
      <BulkImportModal v-if="showBulkImport" :portfolioId="portfolio.id" @close="showBulkImport = false" @imported="onBulkImported" />
    </transition>

    <!-- Add Sealed Modal -->
    <transition name="fade">
      <AddItemModal v-if="showAddSealed" :card="null" :defaultPortfolioId="portfolio.id" defaultType="sealed" @close="showAddSealed = false" />
    </transition>

    <!-- Add master set modal -->
    <transition name="fade">
      <div v-if="showMasterSetModal" class="modal-overlay" @click.self="!msForm.busy && (showMasterSetModal = false)">
        <div class="modal">
          <div class="modal-header">
            <h3>★ Add a Master Set</h3>
            <button class="btn btn-ghost btn-icon" :disabled="msForm.busy" @click="showMasterSetModal = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="ms-modal-hint">Adds every card of a set to this shelf in one go and showcases it as a binder stack — no trip to Browse. Cards you already own are skipped.</p>
            <div class="form-group">
              <label class="form-label">Game</label>
              <select v-model="msForm.game" class="input" :disabled="msForm.busy" @change="loadMsFormSets">
                <option v-for="g in msGameOptions" :key="g.value" :value="g.value">{{ g.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Set</label>
              <select v-model="msForm.setKey" class="input" :disabled="msForm.busy || !msForm.sets.length">
                <option value="" disabled>{{ msForm.sets.length ? 'Pick a set…' : 'Loading sets…' }}</option>
                <option v-for="s in msForm.sets" :key="s.id" :value="s.id">{{ s.name }}{{ s.total ? ` · ${s.total} cards` : '' }}</option>
              </select>
            </div>
            <div v-if="msForm.progress" class="ms-modal-progress">{{ msForm.progress }}</div>
            <div v-if="msForm.error" class="ms-modal-error">{{ msForm.error }}</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" :disabled="msForm.busy" @click="showMasterSetModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="msForm.busy || !msForm.setKey" @click="confirmAddMasterSet">{{ msForm.busy ? 'Adding…' : 'Add & Showcase' }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Edit item modal -->
    <transition name="fade">
      <div v-if="editingItem" class="modal-overlay" @click.self="editingItem = null">
        <div class="modal">
          <div class="modal-header">
            <h3>Edit Item</h3>
            <button class="btn btn-ghost btn-icon" @click="editingItem = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Purchase Price ($)</label>
                <input v-model.number="editForm.purchasePrice" class="input" type="number" step="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">Quantity</label>
                <div class="stepper" role="group" aria-label="Quantity">
                  <button type="button" class="stepper-btn" :disabled="(editForm.quantity || 1) <= 1" aria-label="Decrease quantity" @click="editForm.quantity = Math.max(1, (editForm.quantity || 1) - 1)">−</button>
                  <span class="stepper-value">{{ editForm.quantity || 1 }}</span>
                  <button type="button" class="stepper-btn" aria-label="Increase quantity" @click="editForm.quantity = (editForm.quantity || 1) + 1">+</button>
                </div>
              </div>
            </div>
            <div v-if="editingItem.type !== 'card'" class="form-group">
              <label class="form-label">Current Market Value ($)</label>
              <input v-model.number="editForm.currentValue" class="input" type="number" step="0.01" />
            </div>
            <div v-if="store.portfolios.length > 1" class="form-group">
              <label class="form-label">Move to shelf</label>
              <div class="flex gap-2">
                <select v-model="moveTargetId" class="select" style="flex:1">
                  <option value="">Stay on “{{ portfolio.name }}”</option>
                  <option v-for="p in store.portfolios.filter(p => p.id !== portfolio.id)" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <button class="btn btn-secondary" :disabled="!moveTargetId" @click="moveEditingItem">Move</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Purchase Date</label>
              <input v-model="editForm.purchaseDate" class="input" type="date" />
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea v-model="editForm.notes" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="editingItem = null">Cancel</button>
            <button class="btn btn-primary" @click="saveEditItem">Save Changes</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Delete confirm -->
    <transition name="fade">
      <div v-if="confirmDelete" class="modal-overlay" @click.self="confirmDelete = false">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>Delete Shelf</h3>
            <button class="btn btn-ghost btn-icon" @click="confirmDelete = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-secondary">Delete <strong>{{ portfolio.name }}</strong>? This will remove {{ portfolio.items.length }} items forever.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="confirmDelete = false">Cancel</button>
            <button class="btn btn-danger" @click="deletePortfolio">Delete Forever</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Bulk Delete confirm -->
    <transition name="fade">
      <div v-if="confirmBulkDelete" class="modal-overlay" @click.self="confirmBulkDelete = false">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>Delete Selected Items</h3>
            <button class="btn btn-ghost btn-icon" @click="confirmBulkDelete = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-secondary">Delete <strong>{{ selectedIds.size }}</strong> items from your collection?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="confirmBulkDelete = false">Cancel</button>
            <button class="btn btn-danger" @click="deleteSelected">Delete Items</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import RbIcon from '../components/icons/RbIcon.vue'
import { ref, computed, watch, nextTick, onBeforeUnmount, reactive } from 'vue'
import { tokenMatch } from '../utils/search.js'
import { useRoute, useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import { exportPortfolioToExcel } from '../utils/excel'
import { getCard, getMarketPrice, formatVariantLabel } from '../services/pokemonApi'
// (master-set helpers from pokemonApi/providers/cardCache imported below)
import { fetchPrice } from '../services/priceServer'
import { itemHistoryRef } from '../services/priceHistory'
import { getPrice as getTcgPrice } from '../services/priceFeedService'
import {
  buildGradedPcQuery,
  pcGradeForItem,
  isFiniteGradedPrice,
  riftboundGradedFetchGuard,
  RIFTBOUND_GRADED_NO_NUMBER_MSG,
} from '../utils/gradedPriceQuery'
import { checkAlerts, notifyTriggered } from '../utils/alerts'
import { refreshUpdates } from '../utils/refreshHeal'
import PriceChart from '../components/PriceChart.vue'
import PortfolioChart from '../components/PortfolioChart.vue'
import AddItemModal from '../components/AddItemModal.vue'
import BulkImportModal from '../components/BulkImportModal.vue'
import MasterSetStack from '../components/MasterSetStack.vue'
import MasterSetGallery from '../components/MasterSetGallery.vue'
import { fetchSetCards } from '../utils/masterSets'
import { getSets as getPokemonSets, getJapaneseSets } from '../services/pokemonApi'
import { getProvider } from '../services/tcg/providers'
import { getTcgPrefs } from '../services/tcg/cardCache'

// ── Master sets ────────────────────────────────────────────────────────
// A master set collapses every single from one set into a binder-stack
// showcase with combined value + completion. Grouping is view-layer only.

const MS_GAME_LABELS = { pokemon: 'Pokémon', mtg: 'Magic', yugioh: 'Yu-Gi-Oh!', lorcana: 'Lorcana', 'one-piece': 'One Piece', riftbound: 'Riftbound' }

function msItemKey(item) {
  if (item.type !== 'card') return null
  const setId = item.cardData?.set?.id || item.cardData?.set?.name || item.setName
  if (!setId) return null
  // JP Pokémon set ids collide with EN ones once lowercased (EN sv3 =
  // Obsidian Flames, JP SV3 = Ruler of the Black Flame) — qualify them
  const lang = item._lang === 'ja' ? 'ja:' : ''
  return `${item.game || 'pokemon'}:${lang}${String(setId).toLowerCase()}`
}

// Items added before set ids were stored group by set NAME; normalize to
// the real set id (via the meta map) so old and new items land in one group
function msCanonicalKey(item) {
  const key = msItemKey(item)
  if (!key) return null
  const meta = msSetMeta.value[key]
  if (meta?.id) {
    const lang = item._lang === 'ja' ? 'ja:' : ''
    return `${item.game || 'pokemon'}:${lang}${String(meta.id).toLowerCase()}`
  }
  return key
}

// Route/store + instance shelf identity must exist before loadMsSetMeta/setup.
// Capture id once at setup as a primitive — App fullPath key mounts a new instance
// per navigation, but the leaving instance stays alive ~300ms while the global route
// already points at B. Binding portfolio/setup to live route.params.id would make A
// rebind to B and start duplicate B work. Fading A stays A; new B owns B setup.
const route = useRoute()
const router = useRouter()
const store = usePortfolioStore()
const _rawRouteId = route.params.id
const instanceShelfId = typeof _rawRouteId === 'string'
  ? _rawRouteId
  : (Array.isArray(_rawRouteId) ? String(_rawRouteId[0] ?? '') : String(_rawRouteId ?? ''))

// Set totals + logos, filled lazily from the cached set lists (no extra
// network beyond what Browse already caches)
const msSetMeta = ref({})
/** Bumps on each load / unmount so a slower prior shelf cannot overwrite meta. */
let msMetaGen = 0
/** True after unmount — dead instance must not start setup/refresh. */
let disposed = false
async function loadMsSetMeta(forShelfId) {
  if (disposed) return
  // Prefer explicit id; fall back to this instance's captured shelf identity
  const shelfId = forShelfId ?? (instanceShelfId || null)
  if (!shelfId) return
  // Missing shelf after init: zero set-list/API work (not-found UI only)
  const shelf = store.portfolios.find(p => p.id === shelfId)
  if (!shelf) return
  const gen = ++msMetaGen
  const items = shelf.items || []
  const meta = {}
  const games = new Set(['pokemon'])
  for (const g of getTcgPrefs() || []) games.add(g)
  for (const item of items) if (item.game) games.add(item.game)
  await Promise.allSettled([...games].map(async (g) => {
    if (g === 'pokemon') {
      const [en, jp] = await Promise.allSettled([getPokemonSets(), getJapaneseSets()])
      // EN and JP keyed separately — lowercased ids collide (sv3 ≠ SV3)
      // and merged keys gave EN sets JP logos and totals
      if (en.status === 'fulfilled') {
        for (const s of en.value || []) {
          meta[`pokemon:${String(s.id).toLowerCase()}`] = { id: s.id, total: s.total || s.printedTotal || null, logo: s.images?.logo || '', name: s.name }
        }
      }
      if (jp.status === 'fulfilled') {
        for (const s of jp.value || []) {
          meta[`pokemon:ja:${String(s.id).toLowerCase()}`] = { id: s.id, total: s.total || s.printedTotal || null, logo: s.images?.logo || '', name: s.name, _lang: 'ja' }
        }
      }
    } else {
      const sets = await getProvider(g)?.getSets() || []
      for (const s of sets) {
        // YGOPRODeck's num_of_cards counts rarity printings (Metal Raiders:
        // 432 vs 144 real cards) — an inflated denominator makes the 80%
        // suggestion unreachable. Treat as unknown; the gallery backfills
        // the true count the first time the set list is fetched.
        const total = g === 'yugioh' ? null : (s.total || null)
        const m = { id: s.id, total, logo: s.logo || '', name: s.name }
        meta[`${g}:${String(s.id).toLowerCase()}`] = m
        meta[`${g}:${String(s.name).toLowerCase()}`] = m
      }
    }
  }))
  // Dead instance / stale completion: never write meta for another shelf
  if (disposed || gen !== msMetaGen) return
  if (instanceShelfId !== shelfId) return
  msSetMeta.value = meta
  migrateMasterSetKeys()
}

// Showcases saved before set-id keys existed are stored under name-based
// keys ("riftbound:origins"); move them to the canonical id key so they
// keep matching their (now id-grouped) items
function migrateMasterSetKeys() {
  const ms = portfolio.value?.masterSets
  if (!ms) return
  for (const key of Object.keys(ms)) {
    const meta = msSetMeta.value[key]
    if (!meta?.id) continue
    const [game] = key.split(':')
    const lang = meta._lang === 'ja' ? 'ja:' : ''
    const canon = `${game}:${lang}${String(meta.id).toLowerCase()}`
    if (canon !== key && !ms[canon]) {
      store.showcaseMasterSet(portfolio.value.id, canon, { ...ms[key], setId: meta.id })
      store.unshowcaseMasterSet(portfolio.value.id, key)
    }
  }
}

const msGroups = computed(() => {
  const groups = new Map()
  for (const item of portfolio.value?.items || []) {
    const key = msCanonicalKey(item)
    if (!key) continue
    let g = groups.get(key)
    if (!g) {
      g = {
        key,
        game: item.game || 'pokemon',
        name: item.cardData?.set?.name || item.setName || '',
        setId: item.cardData?.set?.id || '',
        lang: item._lang === 'ja' ? 'ja' : null,
        items: [], ids: new Set(), value: 0, count: 0,
      }
      groups.set(key, g)
    }
    g.items.push(item)
    // Unique-card tally: cardId when stored, name|number for older items
    g.ids.add(item.cardId || `${(item.cardData?.name || '').toLowerCase()}|${item.cardData?.number || ''}`)
    g.value += getCurrentValue(item) * (item.quantity || 1)
    g.count += item.quantity || 1
  }
  for (const g of groups.values()) {
    g.owned = g.ids.size || g.items.length
    const meta = msSetMeta.value[g.key]
    g.total = meta?.total || null
    g.logo = meta?.logo || ''
    if (!g.name && meta?.name) g.name = meta.name
    // Items grouped by set name carry no usable set id — the gallery would
    // fetch getSetCards('') and show a stranger's card list (the Riftbound
    // "wrong set" bug). The meta map knows the real id.
    if (!g.setId && meta?.id) g.setId = meta.id
  }
  return groups
})

const masterSetGroups = computed(() => {
  const showcased = portfolio.value?.masterSets || {}
  const out = []
  for (const key of Object.keys(showcased)) {
    const g = msGroups.value.get(key)
    const saved = showcased[key]
    if (!g) continue
    out.push({
      ...g,
      name: g.name || saved.name,
      // saved.total is the exact fetched-list length (backfilled when the
      // gallery loads) — beats API totals that are null (Lorcast) or count
      // rarity printings instead of cards (YGOPRODeck)
      total: saved.total || g.total || null,
      logo: g.logo || saved.logo || '',
      setId: g.setId || saved.setId || '',
      lang: g.lang || saved.lang || null,
      hunt: saved.hunt || {},
      gameLabel: MS_GAME_LABELS[g.game] || g.game,
      complete: !!(g.total && g.owned >= g.total),
    })
  }
  return out.sort((a, b) => b.value - a.value)
})

// All showcased sets stay collapsed in the table — the gallery is where
// you appreciate (and hunt) the cards
const collapsedMsKeys = computed(() => new Set(Object.keys(portfolio.value?.masterSets || {})))

// ── Hunt-mode gallery ──────────────────────────────────────────────────
const msGalleryKey = ref(null)
const msGalleryGroup = computed(() => masterSetGroups.value.find(g => g.key === msGalleryKey.value) || null)

function addFoundCards(cards) {
  const g = msGalleryGroup.value
  if (!g) return
  // Local date, not toISOString (UTC) — an evening find shouldn't be
  // stamped with tomorrow, and the "found today" tally counts local days
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  for (const card of cards) {
    store.addItem(portfolio.value.id, {
      type: 'card', quantity: 1, purchasePrice: 0, purchaseDate: today, notes: '',
      cardId: card.id,
      game: card.game === 'pokemon' ? undefined : card.game,
      _lang: card._lang || null,
      cardData: { name: card.name, number: card.number, images: card.images, set: card.set, rarity: card.rarity, supertype: card.supertype, _lang: card._lang },
      priceVariant: '', currentMarketPrice: card.price,
    })
  }
  store.clearHuntMarks(portfolio.value.id, g.key, cards.map(c => c.id))
}

const msSuggestion = computed(() => {
  const showcased = portfolio.value?.masterSets || {}
  const dismissed = new Set(portfolio.value?.masterSetsDismissed || [])
  // Sets with a known total qualify at 80% owned; sets whose API has no
  // card counts (Lorcast) qualify on sheer bulk instead of never
  const score = (g) => g.total ? 1 + g.owned / g.total : g.owned / 1000
  let best = null
  for (const g of msGroups.value.values()) {
    if (showcased[g.key] || dismissed.has(g.key)) continue
    if (g.total) {
      if (g.total < 10) continue // tiny "sets" make silly trophies
      if (g.owned / g.total < 0.8) continue
    } else if (g.owned < 30) {
      continue
    }
    if (!best || score(g) > score(best)) best = g
  }
  return best
})

function showcaseSuggestion() {
  const s = msSuggestion.value
  if (!s) return
  store.showcaseMasterSet(portfolio.value.id, s.key, { name: s.name, game: s.game, total: s.total, logo: s.logo, setId: s.setId, lang: s.lang })
}

// The gallery just fetched the set's real card list — its length is the
// truest completion denominator we'll ever get, so save it
function msGalleryLoaded(g, count) {
  const saved = portfolio.value?.masterSets?.[g.key]
  if (!saved || !count || saved.total === count) return
  store.showcaseMasterSet(portfolio.value.id, g.key, { ...saved, total: count })
}

// ── Add Master Set from the shelf (no Browse round-trip) ───────────────
const showMasterSetModal = ref(false)
const msForm = reactive({ game: 'pokemon', setKey: '', busy: false, progress: '', error: '', sets: [] })

function openMasterSetModal() {
  showMasterSetModal.value = true
  msForm.error = ''
  msForm.progress = ''
  loadMsFormSets()
}

const msGameOptions = computed(() => {
  const games = new Set(['pokemon', ...(getTcgPrefs() || [])])
  return [...games].map(g => ({ value: g, label: MS_GAME_LABELS[g] || g }))
})

async function loadMsFormSets() {
  msForm.sets = []
  msForm.setKey = ''
  try {
    if (msForm.game === 'pokemon') {
      const [en, jp] = await Promise.allSettled([getPokemonSets(), getJapaneseSets()])
      const sets = []
      if (en.status === 'fulfilled') sets.push(...(en.value || []).map(s => ({ ...s, _lang: 'en' })))
      if (jp.status === 'fulfilled') sets.push(...(jp.value || []).map(s => ({ ...s, _lang: 'ja' })))
      msForm.sets = sets.map(s => ({ id: s.id, name: s.name + (s._lang === 'ja' ? ' (JP)' : ''), total: s.total || s.printedTotal || null, logo: s.images?.logo || '', _lang: s._lang }))
    } else {
      const sets = await getProvider(msForm.game)?.getSets() || []
      msForm.sets = sets.map(s => ({ id: s.id, name: s.name, total: s.total || null, logo: s.logo || '' }))
    }
  } catch (e) {
    msForm.error = 'Could not load sets — check your connection.'
  }
}

async function confirmAddMasterSet() {
  const set = msForm.sets.find(s => s.id === msForm.setKey)
  if (!set || msForm.busy) return
  msForm.busy = true
  msForm.error = ''
  msForm.progress = 'Fetching set list…'
  try {
    const cards = await fetchSetCards({ game: msForm.game, setId: set.id, setName: set.name, lang: set._lang })
    if (!cards.length) throw new Error('Set has no cards')

    const key = `${msForm.game}:${set._lang === 'ja' ? 'ja:' : ''}${String(set.id).toLowerCase()}`
    const owned = new Set((msGroups.value.get(key)?.items || []).map(i => i.cardId))
    const toAdd = cards.filter(c => !owned.has(c.id))
    msForm.progress = `Adding ${toAdd.length} of ${cards.length} cards (you own ${cards.length - toAdd.length})…`
    for (const card of toAdd) {
      store.addItem(portfolio.value.id, {
        type: 'card', quantity: 1, purchasePrice: 0, purchaseDate: '', notes: '',
        cardId: card.id,
        game: card.game === 'pokemon' ? undefined : card.game,
        _lang: card._lang || null,
        cardData: { name: card.name, number: card.number, images: card.images, set: card.set, rarity: card.rarity, supertype: card.supertype, _lang: card._lang },
        priceVariant: '', currentMarketPrice: card.price,
      })
    }
    store.showcaseMasterSet(portfolio.value.id, key, { name: set.name, game: msForm.game, total: cards.length || set.total, logo: set.logo, setId: set.id, lang: set._lang || null })
    msForm.progress = `Done — ${set.name} is on the shelf as a master set ✓`
    setTimeout(() => { showMasterSetModal.value = false; msForm.busy = false; msForm.progress = '' }, 1400)
  } catch (e) {
    msForm.error = navigator.onLine ? 'Could not fetch that set — try again.' : 'You\'re offline — adding a full set needs a connection.'
    msForm.busy = false
  }
}
import PullToRefresh from '../components/PullToRefresh.vue'
import { buildShelfLink } from '../utils/shelfLink'

// portfolio/stats resolve from instance-captured id (see setup block above)
const portfolio = computed(() => store.portfolios.find(p => p.id === instanceShelfId))
const stats = computed(() => store.getPortfolioStats(instanceShelfId) || { totalValue: 0, totalCost: 0, gain: 0, gainPct: 0, itemCount: 0 })

const activeFilter = ref('all')
const itemSearch = ref('')
const editingName = ref(false)
const editName = ref('')
const nameInputRef = ref(null)
const selectedItem = ref(null)
const sheetTouchY = ref(0) // grab-handle swipe-down start
// ?add=sealed (the tab-bar Add fan's "Sealed" action) opens the sealed add
// flow directly; the query is cleared so back/refresh don't reopen it.
const showAddSealed = ref(route.query.add === 'sealed')
if (route.query.add) router.replace({ path: route.path })
const showBulkImport = ref(false)
const editingItem = ref(null)
const editForm = ref({})
const confirmDelete = ref(false)
const confirmBulkDelete = ref(false)
const editCurrentValue = ref(null)
const refreshing = ref(false)
const refreshStatus = ref('')
const showActionsMenu = ref(false)
const activeItemMenu = ref(null)
const linkCopied = ref(false)
const linkCopyError = ref('')
const showLinkFallback = ref(false)
const shelfLinkInputRef = ref(null)
let linkCopiedTimer = null
let refreshStatusTimer = null
/** Last shelf id that received post-init setup/refresh on this instance (avoids duplicate work). */
const lastSetupShelfId = ref(null)
/**
 * Safety net only: if setup is deferred while refresh is in-flight on this same
 * instance, retry after settle. Primary A→B isolation is instanceShelfId + fullPath key
 * (leaving A never rebinds to B).
 */
let pendingSetupShelfId = null

const shelfLinkUrl = computed(() => {
  if (!portfolio.value?.id) return ''
  return buildShelfLink(portfolio.value.id)
})

const linkAriaLive = computed(() => {
  if (linkCopied.value) return 'Copied'
  if (linkCopyError.value) return linkCopyError.value
  return ''
})

function selectShelfLinkInput(e) {
  e?.target?.select?.()
}

async function focusShelfLinkFallback() {
  await nextTick()
  const el = shelfLinkInputRef.value
  if (!el || typeof el.focus !== 'function') return
  try {
    el.focus()
    el.select?.()
  } catch {
    // Not focusable in this environment — fallback remains visible/selectable
  }
}

async function copyShelfLink() {
  const url = shelfLinkUrl.value
  if (!url) return
  linkCopyError.value = ''
  showLinkFallback.value = false
  if (linkCopiedTimer) {
    clearTimeout(linkCopiedTimer)
    linkCopiedTimer = null
  }
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('clipboard_unavailable')
    }
    await navigator.clipboard.writeText(url)
    linkCopied.value = true
    linkCopiedTimer = setTimeout(() => {
      linkCopied.value = false
      linkCopiedTimer = null
    }, 2000)
  } catch {
    linkCopied.value = false
    showLinkFallback.value = true
    linkCopyError.value = 'Could not copy automatically — select the link below.'
    // Close overflow so the readonly URL fallback is not covered on mobile
    showActionsMenu.value = false
    await focusShelfLinkFallback()
  }
}

const isMobile = ref(window.innerWidth <= 768)
let _resizeTimer
function onWindowResize() {
  clearTimeout(_resizeTimer)
  _resizeTimer = setTimeout(() => { isMobile.value = window.innerWidth <= 768 }, 150)
}
window.addEventListener('resize', onWindowResize)

// Bulk Selection
const selectedIds = reactive(new Set())
const isAllSelected = computed(() => filteredItems.value.length > 0 && filteredItems.value.every(i => selectedIds.has(i.id)))
const isPartiallySelected = computed(() => {
  const count = filteredItems.value.filter(i => selectedIds.has(i.id)).length
  return count > 0 && count < filteredItems.value.length
})

function toggleItemSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
}

function toggleSelectAll() {
  if (isAllSelected.value) filteredItems.value.forEach(i => selectedIds.delete(i.id))
  else filteredItems.value.forEach(i => selectedIds.add(i.id))
}

function deleteSelected() {
  store.removeItems(portfolio.value.id, Array.from(selectedIds))
  selectedIds.clear()
  confirmBulkDelete.value = false
}

function openItemMenu(item) {
  activeItemMenu.value = item
}

// PriceCharting logic (existing)
const pcQuery = ref('')
const pcSearching = ref(false)
const pcResult = ref(null)
const pcError = ref('')

watch(selectedItem, (item) => {
  pcResult.value = null; pcError.value = ''
  if (!item) return
  if (item.type === 'graded') {
    pcQuery.value = buildGradedPcQuery({
      game: item.game,
      name: item.cardData?.name || item.name,
      setName: item.cardData?.set?.name || item.setName,
      number: item.cardData?.number,
      cardData: item.cardData,
    })
  } else if (item.type === 'sealed') pcQuery.value = item.name || ''
})

async function searchPC() {
  if (!pcQuery.value.trim()) return
  pcSearching.value = true; pcError.value = ''; pcResult.value = null
  try {
    const item = selectedItem.value
    if (item?.type === 'graded') {
      const guard = riftboundGradedFetchGuard({
        game: item.game,
        number: item.cardData?.number,
        name: item.cardData?.name || item.name,
        cardData: item.cardData,
      }, pcQuery.value)
      if (!guard.ok) {
        pcError.value = guard.message || RIFTBOUND_GRADED_NO_NUMBER_MSG
        return
      }
    }
    const grade = item?.type === 'graded'
      ? pcGradeForItem(item)
      : 'ungraded'
    const result = await fetchPrice(pcQuery.value, grade)
    if (item?.type === 'graded' && !isFiniteGradedPrice(result)) {
      pcError.value = 'No graded market data for that grade — the slab may trade too thinly. Set the value manually below. Raw market is never used.'
      return
    }
    pcResult.value = result
  } catch (e) {
    pcError.value = e?.message === 'no_graded_data'
      ? 'No graded market data for that grade — the slab may trade too thinly. Set the value manually below. Raw market is never used.'
      : e?.message === 'no_results'
        ? 'No PriceCharting match for this exact card (number/variant) — set the value manually.'
        : 'Fetch failed'
  }
  finally { pcSearching.value = false }
}

function applyPCPrice() {
  if (!selectedItem.value || !isFiniteGradedPrice(pcResult.value)) return
  const price = pcResult.value.price
  const key = selectedItem.value.type === 'card' ? 'currentMarketPrice' : 'currentValue'
  const updates = { [key]: price, lastPriceUpdate: new Date().toISOString() }
  store.updateItem(portfolio.value.id, selectedItem.value.id, updates)
  editCurrentValue.value = price
  pcResult.value = null
}

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Cards', value: 'card' },
  { label: 'Graded', value: 'graded' },
  { label: 'Sealed', value: 'sealed' },
]

const filteredItems = computed(() => {
  if (!portfolio.value) return []
  let items = portfolio.value.items
  // Singles inside a collapsed master set live in the showcase stack, not
  // the table; expanding the stack brings them back
  const hidden = collapsedMsKeys.value
  if (hidden.size) items = items.filter(i => !hidden.has(msCanonicalKey(i)))
  if (activeFilter.value !== 'all') items = items.filter(i => i.type === activeFilter.value)
  if (itemSearch.value) {
    const q = itemSearch.value.toLowerCase()
    items = items.filter(i => tokenMatch(q, getItemName(i), getItemSub(i)))
  }
  return items
})

function filterCount(type) {
  if (!portfolio.value) return 0
  if (type === 'all') return portfolio.value.items.length
  return portfolio.value.items.filter(i => i.type === type).length
}

function getItemName(item) { return item.type === 'sealed' ? item.name : (item.cardData?.name || '—') }

const GAME_LABELS = { magic: 'Magic', yugioh: 'Yu-Gi-Oh!', 'one-piece': 'One Piece', lorcana: 'Lorcana', riftbound: 'Riftbound' }
function getItemSub(item) {
  if (item.type === 'graded') return `${item.gradingCompany || 'PSA'} ${item.grade || ''} · ${item.cardData?.set?.name || item.setName || ''}`
  if (item.game && item.game !== 'pokemon') return `${item.type === 'sealed' ? item.setName : item.cardData?.set?.name} · ${GAME_LABELS[item.game] || item.game}`
  if (item.type === 'card') return `${item.cardData?.set?.name || ''} #${item.cardData?.number || ''} · ${item.priceVariant ? formatVariantLabel(item.priceVariant) : ''}`
  return item.setName || ''
}

function finiteMoney(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null }
function getCurrentValue(item) {
  if (item.type === 'card') {
    return finiteMoney(item.currentMarketPrice) ?? finiteMoney(item.purchasePrice) ?? 0
  }
  return finiteMoney(item.currentValue) ?? finiteMoney(item.purchasePrice) ?? 0
}
function getGain(item) { return (getCurrentValue(item) - (item.purchasePrice || 0)) * (item.quantity || 1) }
function getGainPct(item) { return item.purchasePrice ? ((getCurrentValue(item) - item.purchasePrice) / item.purchasePrice) * 100 : 0 }
function typeBadgeClass(type) { return { card: 'badge-info', graded: 'badge-accent', sealed: 'badge-success' }[type] || 'badge-info' }
function formatDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }

function startEditName() { editName.value = portfolio.value.name; editingName.value = true; nextTick(() => nameInputRef.value?.focus()) }
function saveName() { if (editName.value.trim()) store.updatePortfolio(portfolio.value.id, { name: editName.value.trim() }); editingName.value = false }
function selectItem(item) { selectedItem.value = selectedItem.value?.id === item.id ? null : item; editCurrentValue.value = getCurrentValue(item) }

// ── Detail-panel quick edits (6.5): stepper + grade key-caps ───────────
// updateItem replaces the item object, so re-point the panel at the fresh
// one (this also re-runs the selectedItem watcher, rebuilding the graded
// fetch query — a grade change means the old fetched price is stale).
function syncSelected() {
  const id = selectedItem.value?.id
  if (id) selectedItem.value = portfolio.value?.items.find(i => i.id === id) || null
}

function bumpQuantity(dir) {
  const item = selectedItem.value
  if (!item) return
  const next = Math.max(1, (item.quantity || 1) + dir)
  store.updateItem(portfolio.value.id, item.id, { quantity: next })
  syncSelected()
}

// Same company/grade sets as the add flow — keep in sync with AddItemModal
const GRADE_COMPANIES = ['PSA', 'BGS', 'CGC', 'CGC Pristine', 'SGC', 'ACE', 'TAG', 'BGS Black', 'Other']
const GRADES_BY_COMPANY = {
  PSA:   ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  BGS:   ['10', '9.5', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  CGC:   ['10', '9.5', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  'CGC Pristine': ['10'],
  SGC:   ['10', '9.5', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  ACE:   ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  TAG:   ['10', '9.5', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  'BGS Black': ['10'],
  Other: ['10', '9.5', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
}
const itemGradeOptions = computed(() =>
  GRADES_BY_COMPANY[selectedItem.value?.gradingCompany || 'PSA'] || GRADES_BY_COMPANY.PSA)

function setItemGradeCompany(c) {
  const item = selectedItem.value
  if (!item) return
  const grades = GRADES_BY_COMPANY[c] || GRADES_BY_COMPANY.PSA
  const grade = grades.includes(String(item.grade)) ? String(item.grade) : grades[0]
  store.updateItem(portfolio.value.id, item.id, { gradingCompany: c, grade })
  syncSelected()
}
function setItemGrade(g) {
  const item = selectedItem.value
  if (!item) return
  store.updateItem(portfolio.value.id, item.id, { grade: g })
  syncSelected()
}
// The edit form carries only the editable fields — writing the whole item
// snapshot back would clobber anything a background price refresh updated
// while the modal was open (currentMarketPrice, lastPriceUpdate…).
function editItem(item) {
  editingItem.value = item
  editForm.value = {
    purchasePrice: item.purchasePrice,
    quantity: item.quantity,
    currentValue: item.currentValue,
    purchaseDate: item.purchaseDate,
    notes: item.notes || '',
  }
}
function saveEditItem() {
  const f = editForm.value
  const updates = {
    purchasePrice: finiteMoney(f.purchasePrice) ?? 0,
    quantity: Math.max(1, Math.floor(Number(f.quantity) || 1)),
    purchaseDate: f.purchaseDate,
    notes: f.notes,
  }
  if (editingItem.value.type !== 'card') updates.currentValue = finiteMoney(f.currentValue)
  store.updateItem(portfolio.value.id, editingItem.value.id, updates)
  editingItem.value = null
}
function saveCurrentValue() {
  if (!selectedItem.value) return
  const v = finiteMoney(editCurrentValue.value)
  if (v == null) return // emptied input yields '' — never store that
  store.updateItem(portfolio.value.id, selectedItem.value.id, { [selectedItem.value.type === 'card' ? 'currentMarketPrice' : 'currentValue']: v })
}
function onBulkImported(count) { refreshStatus.value = `Imported ${count} cards`; setTimeout(() => { refreshStatus.value = '' }, 3000) }
function removeItem(item) { if (confirm(`Remove ${getItemName(item)}?`)) store.removeItem(portfolio.value.id, item.id) }

const moveTargetId = ref('')
function moveEditingItem() {
  if (!editingItem.value || !moveTargetId.value) return
  store.moveItem(portfolio.value.id, editingItem.value.id, moveTargetId.value)
  editingItem.value = null
  moveTargetId.value = ''
}

function pcQueryForItem(item) {
  if (item.type === 'graded') {
    return buildGradedPcQuery({
      game: item.game,
      name: item.cardData?.name || item.name,
      setName: item.cardData?.set?.name || item.setName,
      number: item.cardData?.number,
      cardData: item.cardData,
    })
  }
  if (item.type === 'sealed') {
    // Include set name so PriceCharting returns the right product, not just the most popular one
    const name = item.name || ''
    const set = item.setName || ''
    return `${set} ${name}`.trim()
  }
  return null
}

/** Bounded concurrency pool for price refresh workers. */
async function mapPool(items, limit, fn) {
  if (!items.length) return
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
}

async function refreshPrices() {
  if (disposed || !portfolio.value || refreshing.value) return
  // Use this instance's shelf — portfolio is bound to instanceShelfId, not live route
  const shelfId = portfolio.value.id
  const itemsSnapshot = portfolio.value.items.slice()
  refreshing.value = true
  refreshStatus.value = 'Refreshing prices…'
  if (refreshStatusTimer) {
    clearTimeout(refreshStatusTimer)
    refreshStatusTimer = null
  }

  const isPokemonItem = i => !i.game || i.game === 'pokemon'
  const cardItems = itemsSnapshot.filter(i => i.type === 'card' && i.cardId && isPokemonItem(i))
  const ebayItems = itemsSnapshot.filter(i => (i.type === 'graded' || i.type === 'sealed') && isPokemonItem(i))
  // Non-Pokémon raw cards + sealed only — graded never goes through getTcgPrice.
  const otherTcgRawItems = itemsSnapshot.filter(
    i => i.game && i.game !== 'pokemon' && i.type !== 'graded'
  )
  // All non-Pokémon graded slabs (Riftbound and others) — grade-aware PC only.
  const otherTcgGradedItems = itemsSnapshot.filter(
    i => i.game && i.game !== 'pokemon' && i.type === 'graded'
  )
  let updated = 0
  const REFRESH_CONCURRENCY = 4

  try {
    await Promise.allSettled([
      // Raw EN cards — pokemontcg.io (bulk-friendly)
      mapPool(cardItems.filter(i => !store.isJPCard(i)), REFRESH_CONCURRENCY, async item => {
        try {
          const card = await getCard(item.cardId, item._lang)
          const priceResult = getMarketPrice(card, item.priceVariant)
          const price = priceResult?.price ?? priceResult
          // Price when valid + backfill of missing images/set/name — the
          // fetched card has them, so faceless items heal on refresh
          const updates = refreshUpdates(item, card, price)
          if (updates) {
            store.updateItem(shelfId, item.id, updates)
            updated++
          }
        } catch {}
      }),
      // JP cards — tcgdex (one request per card, stagger)
      mapPool(cardItems.filter(i => store.isJPCard(i)), 2, async (item, idx) => {
        await new Promise(r => setTimeout(r, idx * 500))
        try {
          const card = await getCard(item.cardId, item._lang)
          const priceResult = getMarketPrice(card, item.priceVariant)
          const price = priceResult?.price ?? priceResult
          const updates = refreshUpdates(item, card, price)
          if (updates) {
            store.updateItem(shelfId, item.id, updates)
            updated++
          }
        } catch {}
      }),
      // Pokémon graded slabs + sealed — PriceCharting (direct browser API)
      mapPool(ebayItems, REFRESH_CONCURRENCY, async item => {
        const query = pcQueryForItem(item)
        const grade = pcGradeForItem(item)
        if (!query) return
        try {
          const result = await fetchPrice(query, grade)
          if (!isFiniteGradedPrice(result) && item.type === 'graded') return // retain stale/manual
          if (result && typeof result.price === 'number' && Number.isFinite(result.price)) {
            const updates = { currentValue: result.price, lastPriceUpdate: new Date().toISOString() }
            // Always update image for sealed items on refresh — corrects wrong images from generic queries
            if (item.type === 'sealed' && result.image) updates.imageUrl = result.image
            store.updateItem(shelfId, item.id, updates)
            updated++
          }
        } catch {
          // Graded/sealed miss or offline — keep existing value
        }
      }),
      // Non-Pokémon graded — fetchPrice(query, grade) only. Never getTcgPrice/raw.
      mapPool(otherTcgGradedItems, REFRESH_CONCURRENCY, async item => {
        const query = pcQueryForItem(item)
        const grade = pcGradeForItem(item)
        if (!query) return
        // Riftbound without collector # — refuse fuzzy graded auto-price.
        const guard = riftboundGradedFetchGuard({
          game: item.game,
          number: item.cardData?.number,
          name: item.cardData?.name || item.name,
          cardData: item.cardData,
        }, query)
        if (!guard.ok) return
        try {
          const result = await fetchPrice(query, grade)
          if (!isFiniteGradedPrice(result)) return // retain Collectr/manual/stale
          store.updateItem(shelfId, item.id, {
            currentValue: result.price,
            lastPriceUpdate: new Date().toISOString(),
          })
          updated++
        } catch {
          // no_graded_data / offline / timeout — never raw fallback
        }
      }),
      // Non-Pokémon raw cards + sealed — priceFeedService routes per game
      mapPool(otherTcgRawItems, REFRESH_CONCURRENCY, async item => {
        const name = item.name || item.cardData?.name
        if (!name) return
        // Sealed names are often just the SKU ("Collector Booster Box") —
        // the set lives in setName. Without it the query matches EVERY
        // set's box and the first hit wins ($380 box → $1800 wrong-set box).
        const query = item.type === 'sealed'
          ? [name, item.setName].filter(Boolean).join(' ')
          : name
        try {
          const price = await getTcgPrice(query, item.game)
          if (typeof price === 'number' && Number.isFinite(price)) {
            const updates = item.type === 'card'
              ? { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() }
              : { currentValue: price, lastPriceUpdate: new Date().toISOString() }
            store.updateItem(shelfId, item.id, updates)
            updated++
          }
        } catch {}
      }),
    ])

    if (updated > 0) store.recordSnapshot(shelfId)

    // Check price alerts against the shelf we refreshed (captured id; $0 is valid)
    const refreshedShelf = store.portfolios.find(p => p.id === shelfId)
    const alertItems = refreshedShelf?.items || itemsSnapshot
    const priceMap = new Map()
    for (const item of alertItems) {
      if (item.type === 'card' && item.cardId) {
        // Alerts compare against real market prices only — falling back to
        // purchase price or 0 makes "below $X" fire on unpriced cards.
        const mp = finiteMoney(item.currentMarketPrice)
        if (mp != null) priceMap.set(item.cardId, mp)
      }
    }
    const triggered = checkAlerts(priceMap)
    if (triggered.length > 0) notifyTriggered(triggered)

    // Dead instance: finish captured writes/alerts only — no UI timers or setup handoff
    if (disposed) return

    refreshStatus.value = updated > 0 ? `Updated ${updated} item${updated > 1 ? 's' : ''}` : 'No updates'
    refreshStatusTimer = setTimeout(() => {
      refreshStatus.value = ''
      refreshStatusTimer = null
    }, 3000)
  } finally {
    refreshing.value = false
    // Live instance only: flush same-instance deferred setup if any
    if (!disposed) flushPendingShelfSetup()
  }
}

/**
 * Run post-init setup for a shelf id once on this instance. Marks complete only when
 * work starts (not when deferred due to in-flight refresh). Dead instances never start work.
 * Missing non-empty ids (no matching portfolio) do zero setup/API work.
 */
function startShelfSetup(id) {
  if (disposed || !id || lastSetupShelfId.value === id) return
  // Only ever set up this instance's captured shelf
  if (id !== instanceShelfId) return
  // Require a real local shelf after store init — not-found must not hit APIs
  if (!store.initialized || !store.portfolios.some(p => p.id === id)) return
  lastSetupShelfId.value = id
  loadMsSetMeta(id)
  refreshPrices()
}

/** After in-flight refresh settles, run deferred setup for this instance if still needed. */
function flushPendingShelfSetup() {
  if (disposed) return
  const queued = pendingSetupShelfId
  pendingSetupShelfId = null
  // Identity is instance-captured — never read live route.params here
  const currentId = instanceShelfId || null
  const target = (queued && currentId === queued)
    ? queued
    : (currentId && lastSetupShelfId.value !== currentId ? currentId : null)
  if (!target || !store.initialized) return
  if (lastSetupShelfId.value === target) return
  // Missing shelf: do not start setup/API work from the flush path either
  if (!store.portfolios.some(p => p.id === target)) return
  startShelfSetup(target)
}

// After store init only: run setup + price refresh once for this instance's captured id
// when a matching portfolio exists. Empty id and missing non-empty id never trigger
// loadMsSetMeta/refreshPrices. Cold direct-open waits for init (no false not-found).
// Primary A→B isolation is instanceShelfId (leaving A stays A). pendingSetupShelfId is
// only a same-instance deferral if refresh is already in-flight when setup would run.
watch(
  () => ({
    ready: store.initialized,
    id: instanceShelfId || null,
    hasShelf: !!(instanceShelfId && store.portfolios.some(p => p.id === instanceShelfId)),
  }),
  ({ ready, id, hasShelf }) => {
    if (disposed || !ready || !id || !hasShelf) return
    if (lastSetupShelfId.value === id) return
    if (refreshing.value) {
      pendingSetupShelfId = id
      return
    }
    pendingSetupShelfId = null
    startShelfSetup(id)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('resize', onWindowResize)
  if (_resizeTimer) {
    clearTimeout(_resizeTimer)
    _resizeTimer = null
  }
  if (linkCopiedTimer) {
    clearTimeout(linkCopiedTimer)
    linkCopiedTimer = null
  }
  if (refreshStatusTimer) {
    clearTimeout(refreshStatusTimer)
    refreshStatusTimer = null
  }
  // Invalidate in-flight meta loads and drop deferred setup
  msMetaGen++
  pendingSetupShelfId = null
})

function exportPortfolio() { if (portfolio.value) exportPortfolioToExcel(portfolio.value) }
function deletePortfolio() { store.deletePortfolio(portfolio.value.id); router.push('/') }
</script>

<style scoped>
.portfolio-view { max-width: 1200px; margin: 0 auto; padding-bottom: 80px; }

.shelf-gate { min-height: 40vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
.shelf-gate-state { width: 100%; max-width: 360px; }
.shelf-not-found-cta { min-height: 44px; min-width: 44px; }

.shelf-link-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 14px;
}
.shelf-link-help {
  font-size: 12px;
  line-height: 1.45;
  max-width: 52rem;
  margin: 0;
}
.shelf-link-fallback {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
}
.shelf-link-fallback-label { font-size: 11px; font-weight: 700; }
.shelf-link-error {
  margin: 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--danger-text);
  line-height: 1.4;
}
.shelf-link-input {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  min-height: 44px;
}
.sr-only {
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

.portfolio-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; position: relative; }

/* ── Master sets ── */
.ms-suggest {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--accent-dim);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
}
.ms-suggest-text { font-size: 13px; line-height: 1.45; }
.ms-suggest-actions { display: flex; gap: 8px; flex-shrink: 0; }
.ms-showcase { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.ms-showcase-item { display: flex; flex-direction: column; gap: 10px; }
.ms-modal-hint { font-size: 12.5px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5; }
.ms-modal-progress { font-size: 12.5px; font-weight: 700; color: var(--success-text); margin-top: 4px; }
.ms-modal-error { font-size: 12.5px; font-weight: 700; color: var(--danger-text); margin-top: 4px; }
.portfolio-title-row { display: flex; align-items: flex-start; gap: 14px; }
.portfolio-dot-lg { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
.portfolio-name { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; cursor: pointer; }
.portfolio-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.refresh-status-banner { font-size: 12px; font-weight: 700; background: var(--bg-card); padding: 4px 12px; border-radius: 20px; width: fit-content; border: 1.5px solid var(--ink); box-shadow: var(--shadow-pressed); }

.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
.total-value-sticker { font-size: 20px; text-transform: none; letter-spacing: -0.02em; padding: 2px 12px; }

.sticky-filter-bar { position: sticky; top: 0; z-index: 20; background: var(--bg-card); padding: 12px 0; border-bottom: var(--bw) solid var(--border-subtle); }
.filter-tabs-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 0 16px; }
.filter-tabs { display: flex; gap: 8px; min-width: max-content; }
.filter-tab { background: var(--bg-card); border: 1.5px solid var(--ink); color: var(--text-secondary); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.filter-tab.active { background: var(--accent); color: var(--on-accent); border-color: var(--on-accent); box-shadow: var(--shadow-pressed); }
.filter-count { opacity: 0.7; font-weight: 800; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; }
.item-row.selected td { background: var(--accent-dim); }
.item-thumb { width: 36px; height: 50px; object-fit: contain; border-radius: 4px; border: 1px solid var(--border-subtle); }
.item-name-cell { display: flex; align-items: center; gap: 10px; }
.item-sealed-icon { width: 36px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.item-name { font-size: 14px; font-weight: 700; }
.item-sub { font-size: 11px; color: var(--text-muted); }
.gain-cell { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.gain-pct { font-size: 12px; font-weight: 500; }

/* Mobile Card View */
.mobile-item-list { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px 16px; }
/* Desktop default: mobile-only blocks hidden (was missing — both layouts rendered) */
.show-mobile { display: none !important; }
.mobile-item-card { display: flex; align-items: center; padding: 10px 12px; background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-pressed); gap: 10px; cursor: pointer; }
.mobile-item-card.selected { background: var(--accent-dim); }
.mobile-item-thumb { width: 50px; height: 70px; object-fit: contain; border-radius: 4px; flex-shrink: 0; }
.mobile-item-info { flex: 1; min-width: 0; }
.mobile-item-name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-item-sub { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-item-stats { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.mobile-item-gain { margin-left: auto; padding: 1px 8px; border: 1.5px solid var(--on-accent); border-radius: 999px; font-weight: 800; font-size: 11px; flex-shrink: 0; }
.gain-pos { background: var(--success); color: var(--on-accent); }
.gain-neg { background: var(--danger); color: var(--on-danger); }
.mobile-item-menu { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); }

/* Custom Checkbox */
.mobile-item-checkbox { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.custom-checkbox { width: 20px; height: 20px; border: 2px solid var(--ink); border-radius: 6px; position: relative; background: var(--bg-card); }
.custom-checkbox.checked { background: var(--accent); border-color: var(--on-accent); }
.custom-checkbox.checked::after { content: '✓'; position: absolute; color: var(--on-accent); font-size: 12px; font-weight: 900; top: 50%; left: 50%; transform: translate(-50%, -50%); }

/* Action Dropdown */
.action-dropdown { position: relative; }
/* Mobile more-actions trigger (entry to Copy link) — ≥44px touch target */
.shelf-more-actions-btn {
  min-height: 44px;
  min-width: 44px;
}
.dropdown-menu { position: absolute; top: 100%; right: 0; background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-sm); width: 200px; max-width: min(200px, calc(100vw - 32px)); z-index: 50; padding: 6px; display: flex; flex-direction: column; }
.dropdown-menu button {
  padding: 10px 14px;
  min-height: 44px;
  text-align: left;
  background: none;
  border: none;
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  font-size: 14px;
}
.dropdown-menu button:hover { background: var(--bg-hover); }
.dropdown-menu button:disabled { opacity: 0.55; cursor: not-allowed; }
.shelf-link-menu-item { min-height: 44px; }

/* Bulk Action Bar */
.bulk-action-bar { position: fixed; bottom: 20px; left: 16px; right: 16px; background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow); padding: 12px 16px; z-index: 80; }
.bulk-action-content { display: flex; align-items: center; justify-content: space-between; }
.bulk-info { display: flex; align-items: center; }
.bulk-label { font-size: 13px; font-weight: 700; }
.bulk-actions { display: flex; gap: 8px; }
.bulk-count { background: var(--accent); color: var(--on-accent); border: 1.5px solid var(--on-accent); padding: 2px 9px; border-radius: 10px; font-weight: 800; margin-right: 8px; }

/* Bottom Sheet */
.bottom-sheet-overlay { position: fixed; inset: 0; background: rgba(20, 20, 20, 0.45); z-index: 100; display: flex; align-items: flex-end; }
.bottom-sheet { background: var(--bg-primary); width: 100%; border-top: var(--bw) solid var(--ink); border-radius: 20px 20px 0 0; padding: 14px 16px 20px; animation: slideUp 0.3s ease; }
.bottom-sheet::before { content: ''; display: block; width: 44px; height: 4px; border-radius: 999px; background: var(--ink); margin: 0 auto 14px; }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.bottom-sheet-header { text-align: center; margin-bottom: 20px; }
.bottom-sheet-title { font-size: 16px; font-weight: 800; }
.bottom-sheet-subtitle { font-size: 12px; color: var(--text-muted); }
.bottom-sheet-actions { display: flex; flex-direction: column; gap: 8px; }
.bottom-sheet-actions button { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-pressed); color: var(--text-primary); font-size: 15px; font-weight: 600; text-align: left; cursor: pointer; }
.bottom-sheet-actions button:active { box-shadow: none; transform: translate(1px, 1px); }

.item-detail-panel { margin-top: 24px; }
.panel-grab-zone { display: none; } /* phones only — see the mobile block */
.panel-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel-header-row h3 { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
.panel-body-row { display: flex; gap: 24px; }
.panel-left { flex-shrink: 0; }
.panel-right { flex: 1; min-width: 0; }
/* 6.5: the art header is a framed mat, tilted like a card set down on paper */
.panel-art-frame {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 10px;
  transform: rotate(-2deg);
  margin: 4px auto 0;
  width: fit-content;
}
.panel-img { width: 100%; max-width: 200px; border-radius: 8px; margin: 0 auto; display: block; }
.keycap-row { display: flex; gap: 6px; flex-wrap: wrap; }
.keycap-sm { min-height: 42px; padding: 6px 11px; font-size: 12.5px; }
.panel-chart-section { margin-top: 20px; border-top: var(--bw) solid var(--border-subtle); padding-top: 16px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); font-size: 14px; }
.info-label { color: var(--text-secondary); font-weight: 600; }

/* PriceCharting fetch — scoped ≥44px targets (do not change global btn-sm) */
.pc-fetch-section { border-top: var(--bw) solid var(--border-subtle); padding-top: 14px; }
.pc-fetch-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 8px; }
.pc-fetch-row { align-items: stretch; }
.pc-fetch-btn,
.pc-apply-btn {
  flex-shrink: 0;
  min-height: 44px;
  min-width: 44px;
  padding: 10px 14px;
}
.pc-result-box { background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-xs); padding: 14px; }
.pc-result-price-main { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--accent-text); }
.pc-result-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

@media (max-width: 768px) {
  .portfolio-view { padding: 0; }
  .no-padding-mobile { border-radius: 0; border-left: none; border-right: none; box-shadow: none; padding: 0; }
  .px-mobile { padding-left: 16px; padding-right: 16px; }
  .mobile-full-width { width: 100%; }
  .hide-mobile { display: none !important; }
  .show-mobile { display: block !important; }
  .mobile-item-list.show-mobile { display: flex !important; }
  /* 6.5: card detail is a grab-handle bottom sheet, not a full takeover —
     the shelf stays visible above it and the handle says "swipe me away" */
  .item-detail-panel {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    z-index: 150;
    max-height: 92vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    border: none; border-top: var(--bw) solid var(--ink);
    border-radius: 20px 20px 0 0;
    box-shadow: none; margin: 0;
    background: var(--bg-primary);
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  }
  .panel-grab-zone {
    display: flex; align-items: center; justify-content: center;
    width: 100%; min-height: 28px; padding: 8px 0 4px;
    background: transparent; border: none; cursor: grab;
  }
  .panel-grab { display: block; width: 44px; height: 4px; border-radius: 999px; background: var(--ink); }
  .panel-body-row { flex-direction: column; gap: 24px; padding: 0 16px 24px; }
}
</style>
