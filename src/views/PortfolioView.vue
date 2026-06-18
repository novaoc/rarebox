<template>
  <div class="portfolio-view" v-if="portfolio">
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
            <button class="btn btn-secondary btn-icon" @click="showActionsMenu = !showActionsMenu">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <transition name="fade">
              <div v-if="showActionsMenu" class="dropdown-menu" @click="showActionsMenu = false">
                <button @click="showBulkImport = true">↑ Bulk Import</button>
                <button :disabled="refreshing" @click="refreshPrices">↻ Refresh Prices</button>
                <button @click="exportPortfolio">↓ Export Excel</button>
                <button class="text-danger" @click="confirmDelete = true">Delete Shelf</button>
              </div>
            </transition>
          </div>
          
          <template v-else>
            <button class="btn btn-secondary btn-sm" @click="showBulkImport = true">↑ Import</button>
            <button class="btn btn-secondary btn-sm" :disabled="refreshing" @click="refreshPrices">
              <span v-if="refreshing" class="spinner spinner-sm"></span>
              <span v-else>↻ Prices</span>
            </button>
            <button class="btn btn-secondary btn-sm" @click="exportPortfolio">↓ Export</button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete = true">Delete</button>
          </template>
        </div>
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
          <template v-if="msSuggestion.total === null || msSuggestion.total === undefined">You have <strong>{{ msSuggestion.owned }} cards</strong> from <strong>{{ msSuggestion.name }}</strong> — showcase the stack as a master set?</template>
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
                <th>Signal</th>
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
                <td class="font-mono">{{ item.quantity ?? 1 }}</td>
                <td class="font-mono">${{ ((item.purchasePrice ?? 0) * (item.quantity ?? 1)).toFixed(2) }}</td>
                <td class="font-mono"><span class="text-accent">${{ (getCurrentValue(item) * (item.quantity ?? 1)).toFixed(2) }}</span></td>
                <td>
                  <span class="badge" :class="indicatorClass(store.getItemIndicator(item))">
                    {{ store.getItemIndicator(item) }}
                  </span>
                </td>
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
                  <span class="text-accent font-bold">${{ (getCurrentValue(item) * (item.quantity ?? 1)).toFixed(2) }}</span>
                  <span class="text-muted">· {{ item.quantity ?? 1 }} qty</span>
                  <div class="indicator-dot ml-auto" :class="indicatorClass(store.getItemIndicator(item))">
                    <RbIcon v-if="store.getItemIndicator(item) === 'BUY'" name="arrow-down-circle" :size="14" />
                    <RbIcon v-else-if="store.getItemIndicator(item) === 'SELL'" name="arrow-up-circle" :size="14" />
                    <span v-else class="dot-neutral"></span>
                  </div>
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

    <!-- Item detail panel — Refined for mobile as a bottom sheet -->
    <transition name="slide-up">
      <div v-if="selectedItem" class="item-detail-panel card">
        <div class="panel-header-row">
          <h3>{{ getItemName(selectedItem) }}</h3>
          <button class="btn btn-ghost btn-icon" @click="selectedItem = null" aria-label="Close details">✕</button>
        </div>
        <div class="panel-body-row">
          <div class="panel-left" v-if="selectedItem.cardData?.images?.small || selectedItem.imageUrl">
            <img :src="selectedItem.cardData?.images?.large || selectedItem.cardData?.images?.small || selectedItem.imageUrl" class="panel-img" @error="$event.target.style.display='none'" />
          </div>
          <div class="panel-right">
            <div class="panel-info-grid">
              <div class="info-row"><span class="info-label">Type</span><span class="badge" :class="typeBadgeClass(selectedItem.type)">{{ selectedItem.type }}</span></div>
              <div class="info-row" v-if="selectedItem.gradingCompany"><span class="info-label">Grade</span><span>{{ selectedItem.gradingCompany }} {{ selectedItem.grade }}</span></div>
              <div class="info-row" v-if="selectedItem.priceVariant"><span class="info-label">Variant</span><span>{{ selectedItem.priceVariant }}</span></div>
              <div class="info-row"><span class="info-label">Quantity</span><span>{{ selectedItem.quantity ?? 1 }}</span></div>
              <div class="info-row"><span class="info-label">Paid (each)</span><span>${{ (selectedItem.purchasePrice ?? 0).toFixed(2) }}</span></div>
              <div class="info-row"><span class="info-label">Current Value</span><span class="text-accent font-bold">${{ getCurrentValue(selectedItem).toFixed(2) }}</span></div>
              <div class="info-row"><span class="info-label">Purchased</span><span>{{ selectedItem.purchaseDate || '—' }}</span></div>
            </div>

            <div v-if="selectedItem.type === 'graded' || selectedItem.type === 'sealed'" class="mt-4">
              <div class="form-group">
                <label class="form-label">Update Current Value ($)</label>
                <div class="flex gap-2">
                  <input v-model.number="editCurrentValue" class="input input-sm" type="number" step="0.01" :placeholder="getCurrentValue(selectedItem).toFixed(2)" />
                  <button class="btn btn-primary btn-sm" @click="saveCurrentValue">Save</button>
                </div>
              </div>

              <!-- eBay price fetch -->
              <div class="pc-fetch-section mt-4">
                <div class="pc-fetch-label">Fetch from PriceCharting</div>
                <div class="flex gap-2">
                  <input v-model="pcQuery" class="input input-sm" placeholder="Search query…" @keyup.enter="searchPC" />
                  <button class="btn btn-secondary btn-sm" :disabled="pcSearching || !pcQuery.trim()" @click="searchPC">
                    <span v-if="pcSearching" class="spinner spinner-sm"></span>
                    <span v-else>Fetch</span>
                  </button>
                </div>
                <div v-if="pcError" class="text-danger mt-2" style="font-size:12px">{{ pcError }}</div>
                <div v-if="pcResult" class="pc-result-box mt-3">
                  <div class="pc-result-price-main">${{ pcResult.price.toFixed(2) }}</div>
                  <div class="pc-result-meta">{{ pcResult.product_name }} · PriceCharting</div>
                  <button class="btn btn-primary btn-sm w-full mt-3" @click="applyPCPrice">Apply Price</button>
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
                <option v-for="s in msForm.sets" :key="s.id" :value="s.id">{{ s.name }}{{ (s.total !== null && s.total !== undefined) ? ` · ${s.total} cards` : '' }}</option>
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
                <input v-model.number="editForm.quantity" class="input" type="number" min="1" />
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
import { ref, computed, watch, nextTick, onMounted, reactive } from 'vue'
import { tokenMatch } from '../utils/search.js'
import { useRoute, useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import { exportPortfolioToExcel } from '../utils/excel'
import { getCard, getMarketPrice } from '../services/pokemonApi'
// (master-set helpers from pokemonApi/providers/cardCache imported below)
import { fetchPrice } from '../services/priceServer'
import { itemHistoryRef } from '../services/priceHistory'
import { getPrice as getTcgPrice } from '../services/priceFeedService'
import { checkAlerts, notifyTriggered } from '../utils/alerts'
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

// Set totals + logos, filled lazily from the cached set lists (no extra
// network beyond what Browse already caches)
const msSetMeta = ref({})
async function loadMsSetMeta() {
  const meta = {}
  const games = new Set(['pokemon'])
  for (const g of getTcgPrefs() || []) games.add(g)
  for (const item of portfolio.value?.items || []) if (item.game) games.add(item.game)
  await Promise.allSettled([...games].map(async (g) => {
    if (g === 'pokemon') {
      const [en, jp] = await Promise.allSettled([getPokemonSets(), getJapaneseSets()])
      // EN and JP keyed separately — lowercased ids collide (sv3 ≠ SV3)
      // and merged keys gave EN sets JP logos and totals
      if (en.status === 'fulfilled') {
        for (const s of en.value || []) {
          meta[`pokemon:${String(s.id).toLowerCase()}`] = { id: s.id, total: s.total ?? s.printedTotal ?? null, logo: s.images?.logo || '', name: s.name }
        }
      }
      if (jp.status === 'fulfilled') {
        for (const s of jp.value || []) {
          meta[`pokemon:ja:${String(s.id).toLowerCase()}`] = { id: s.id, total: s.total ?? s.printedTotal ?? null, logo: s.images?.logo || '', name: s.name, _lang: 'ja' }
        }
      }
    } else {
      const sets = await getProvider(g)?.getSets() || []
      for (const s of sets) {
        // YGOPRODeck's num_of_cards counts rarity printings (Metal Raiders:
        // 432 vs 144 real cards) — an inflated denominator makes the 80%
        // suggestion unreachable. Treat as unknown; the gallery backfills
        // the true count the first time the set list is fetched.
        const total = g === 'yugioh' ? null : (s.total ?? null)
        const m = { id: s.id, total, logo: s.logo || '', name: s.name }
        meta[`${g}:${String(s.id).toLowerCase()}`] = m
        meta[`${g}:${String(s.name).toLowerCase()}`] = m
      }
    }
  }))
  msSetMeta.value = meta
  migrateMasterSetKeys()
}
onMounted(loadMsSetMeta)

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
    g.value += getCurrentValue(item) * (item.quantity ?? 1)
    g.count += item.quantity ?? 1
  }
  for (const g of groups.values()) {
    g.owned = g.ids.size || g.items.length
    const meta = msSetMeta.value[g.key]
    g.total = meta?.total ?? null
    g.logo = meta?.logo || ''
    if (!g.name && meta?.name) g.name = meta.name
    // Items grouped by set name carry no unusable set id — the gallery would
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
      total: saved.total ?? g.total ?? null,
      logo: g.logo || saved.logo || '',
      setId: g.setId || saved.setId || '',
      lang: g.lang || saved.lang || null,
      hunt: saved.hunt || {},
      gameLabel: MS_GAME_LABELS[g.game] || g.game,
      complete: !!((g.total !== null && g.total !== undefined) && g.owned >= g.total),
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
  const score = (g) => (g.total !== null && g.total !== undefined) ? 1 + g.owned / g.total : g.owned / 1000
  let best = null
  for (const g of msGroups.value.values()) {
    if (showcased[g.key] || dismissed.has(g.key)) continue
    if (g.total !== null && g.total !== undefined) {
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
  if (!saved || (count === null || count === undefined) || saved.total === count) return
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
      msForm.sets = sets.map(s => ({ id: s.id, name: s.name + (s._lang === 'ja' ? ' (JP)' : ''), total: s.total ?? s.printedTotal ?? null, logo: s.images?.logo || '', _lang: s._lang }))
    } else {
      const sets = await getProvider(msForm.game)?.getSets() || []
      msForm.sets = sets.map(s => ({ id: s.id, name: s.name, total: s.total ?? null, logo: s.logo || '' }))
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

const route = useRoute()
const router = useRouter()
const store = usePortfolioStore()

const portfolio = computed(() => store.portfolios.find(p => p.id === route.params.id))
const stats = computed(() => store.getPortfolioStats(route.params.id) || { totalValue: 0, totalCost: 0, gain: 0, gainPct: 0, itemCount: 0 })

const activeFilter = ref('all')
const itemSearch = ref('')
const editingName = ref(false)
const editName = ref('')
const nameInputRef = ref(null)
const selectedItem = ref(null)
const showAddSealed = ref(false)
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

const isMobile = ref(window.innerWidth <= 768)
let _resizeTimer
window.addEventListener('resize', () => { clearTimeout(_resizeTimer); _resizeTimer = setTimeout(() => { isMobile.value = window.innerWidth <= 768 }, 150) })

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
  if (item.type === 'graded') pcQuery.value = `${item.cardData?.name || ''} PSA ${item.grade || ''}`.trim()
  else if (item.type === 'sealed') pcQuery.value = item.name || ''
})

async function searchPC() {
  if (!pcQuery.value.trim()) return
  pcSearching.value = true; pcError.value = ''; pcResult.value = null
  try {
    const grade = selectedItem.value?.type === 'graded' ? (selectedItem.value.grade || '10') : 'ungraded'
    pcResult.value = await fetchPrice(pcQuery.value, grade)
  } catch (e) {
    pcError.value = e?.message === 'no_graded_data'
      ? 'No graded market data for that grade — the slab may trade too thinly. Set the value manually below.'
      : 'Fetch failed'
  }
  finally { pcSearching.value = false }
}

function applyPCPrice() {
  if (!selectedItem.value || !pcResult.value) return
  const price = pcResult.value.price
  const key = selectedItem.value.type === 'card' ? 'currentMarketPrice' : 'currentValue'
  store.updateItem(portfolio.value.id, selectedItem.value.id, { [key]: price })
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

const GAME_LABELS = { magic: 'Magic', yugioh: 'Yu-Gi-Oh!', 'one-piece': 'One Piece', lorcana: 'Lorcana' }
function getItemSub(item) {
  if (item.type === 'graded') return `${item.gradingCompany || 'PSA'} ${item.grade || ''} · ${item.cardData?.set?.name || item.setName || ''}`
  if (item.game && item.game !== 'pokemon') return `${item.type === 'sealed' ? item.setName : item.cardData?.set?.name} · ${GAME_LABELS[item.game] || item.game}`
  if (item.type === 'card') return `${item.cardData?.set?.name || ''} #${item.cardData?.number || ''} · ${item.priceVariant || ''}`
  return item.setName || ''
}

function getCurrentValue(item) { return item.type === 'card' ? (item.currentMarketPrice ?? item.purchasePrice ?? 0) : (item.currentValue ?? item.purchasePrice ?? 0) }
function getGain(item) { return (getCurrentValue(item) - (item.purchasePrice ?? 0)) * (item.quantity ?? 1) }
function getGainPct(item) { return (item.purchasePrice !== null && item.purchasePrice !== undefined && item.purchasePrice !== 0) ? ((getCurrentValue(item) - item.purchasePrice) / item.purchasePrice) * 100 : 0 }
function typeBadgeClass(type) { return { card: 'badge-info', graded: 'badge-accent', sealed: 'badge-success' }[type] || 'badge-info' }
function formatDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }

function startEditName() { editName.value = portfolio.value.name; editingName.value = true; nextTick(() => nameInputRef.value?.focus()) }
function saveName() { if (editName.value.trim()) store.updatePortfolio(portfolio.value.id, { name: editName.value.trim() }); editingName.value = false }
function selectItem(item) { selectedItem.value = selectedItem.value?.id === item.id ? null : item; editCurrentValue.value = getCurrentValue(item) }
function editItem(item) { editingItem.value = item; editForm.value = { ...item, notes: item.notes || '' } }
function saveEditItem() { store.updateItem(portfolio.value.id, editingItem.value.id, editForm.value); editingItem.value = null }
function saveCurrentValue() { if (selectedItem.value) store.updateItem(portfolio.value.id, selectedItem.value.id, { [selectedItem.value.type === 'card' ? 'currentMarketPrice' : 'currentValue']: editCurrentValue.value }) }
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
    const name = item.cardData?.name || item.name || ''
    const set = item.cardData?.set?.name || ''
    return `${name} ${set}`.trim()
  }
  if (item.type === 'sealed') {
    // Include set name so PriceCharting returns the right product, not just the most popular one
    const name = item.name || ''
    const set = item.setName || ''
    return `${set} ${name}`.trim()
  }
  return null
}
function pcGradeForItem(item) {
  if (item.type === 'graded') {
    const company = (item.gradingCompany || 'PSA').toLowerCase()
    const grade = item.grade || '10'
    if (company === 'psa') return grade === '10' ? 'psa10' : grade
    if (company === 'bgs') return grade === '10' ? 'bgs10' : grade
    if (company === 'cgc') return grade === '10' ? 'cgc10' : grade
    if (company === 'sgc') return grade === '10' ? 'sgc10' : grade
    return grade
  }
  return 'ungraded'
}

async function refreshPrices() {
  if (!portfolio.value || refreshing.value) return
  refreshing.value = true
  refreshStatus.value = 'Refreshing prices…'

  const isPokemonItem = i => !i.game || i.game === 'pokemon'
  const cardItems = portfolio.value.items.filter(i => i.type === 'card' && i.cardId && isPokemonItem(i))
  const ebayItems = portfolio.value.items.filter(i => (i.type === 'graded' || i.type === 'sealed') && isPokemonItem(i))
  // Non-Pokémon TCG items (cards + sealed) — priced via priceFeedService by name.
  const otherTcgItems = portfolio.value.items.filter(i => i.game && i.game !== 'pokemon')
  let updated = 0

  await Promise.allSettled([
    // Raw EN cards — pokemontcg.io (bulk-friendly)
    ...cardItems.filter(i => !store.isJPCard(i)).map(async item => {
      try {
        const card = await getCard(item.cardId, item._lang)
        const priceResult = getMarketPrice(card, item.priceVariant)
        const price = priceResult?.price ?? priceResult
        if (price !== null && price !== undefined) {
          store.updateItem(portfolio.value.id, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
          updated++
        }
      } catch {}
    }),
    // JP cards — tcgdex (one request per card, stagger)
    ...cardItems.filter(i => store.isJPCard(i)).map(async (item, idx) => {
      await new Promise(r => setTimeout(r, idx * 500))
      try {
        const card = await getCard(item.cardId, item._lang)
        const priceResult = getMarketPrice(card, item.priceVariant)
        const price = priceResult?.price ?? priceResult
        if (price !== null && price !== undefined) {
          store.updateItem(portfolio.value.id, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
          updated++
        }
      } catch {}
    }),
    // Graded slabs + sealed — PriceCharting (direct browser API)
    ...ebayItems.map(async item => {
      const query = pcQueryForItem(item)
      const grade = pcGradeForItem(item)
      if (!query) return
      const result = await fetchPrice(query, grade)
      if (result?.price !== null && result?.price !== undefined) {
        const updates = { currentValue: result.price }
        // Always update image for sealed items on refresh — corrects wrong images from generic queries
        if (result.image) updates.imageUrl = result.image
        store.updateItem(portfolio.value.id, item.id, updates)
        updated++
      }
    }),
    // Non-Pokémon TCGs (Magic, One Piece, Riftbound, …) — priceFeedService routes per game
    ...otherTcgItems.map(async item => {
      const query = item.name || item.cardData?.name
      if (!query) return
      const price = await getTcgPrice(query, item.game)
      if (price !== null && price !== undefined) {
        const updates = item.type === 'card' ? { currentMarketPrice: price } : { currentValue: price }
        store.updateItem(portfolio.value.id, item.id, updates)
        updated++
      }
    })
  ])

  if (updated > 0) store.recordSnapshot(portfolio.value.id)

  // Check price alerts
  const priceMap = new Map()
  for (const item of portfolio.value.items) {
    if (item.type === 'card' && item.cardId) {
      priceMap.set(item.cardId, item.currentMarketPrice ?? item.purchasePrice ?? 0)
    }
  }
  const triggered = checkAlerts(priceMap)
  if (triggered.length > 0) notifyTriggered(triggered)

  refreshStatus.value = updated > 0 ? `Updated ${updated} item${updated > 1 ? 's' : ''}` : 'No updates'
  setTimeout(() => { refreshStatus.value = '' }, 3000)
  refreshing.value = false
}

function indicatorClass(sig) {
  return {
    BUY: 'badge-info',
    SELL: 'badge-danger',
    HOLD: 'badge-ghost'
  }[sig]
}

onMounted(() => { refreshPrices() })
function exportPortfolio() { if (portfolio.value) exportPortfolioToExcel(portfolio.value) }
function deletePortfolio() { store.deletePortfolio(portfolio.value.id); router.push('/') }
</script>

<style scoped>
.portfolio-view { max-width: 1200px; margin: 0 auto; padding-bottom: 80px; }

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

/* Signal Badges */
.badge-ghost { background: transparent; border-color: var(--border-subtle); color: var(--text-muted); }

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
.mobile-item-gain { padding: 1px 8px; border: 1.5px solid var(--on-accent); border-radius: 999px; font-weight: 800; font-size: 11px; flex-shrink: 0; }
.gain-pos { background: var(--success); color: var(--on-accent); }
.gain-neg { background: var(--danger); color: var(--on-danger); }
.mobile-item-menu { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); }

/* Compact Signal Icons for Mobile */
.indicator-dot { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.indicator-dot.badge-info { color: var(--info); border: none; background: transparent; }
.indicator-dot.badge-danger { color: var(--danger); border: none; background: transparent; }
.dot-neutral { width: 6px; height: 6px; background: var(--border-subtle); border-radius: 50%; }

/* Custom Checkbox */
.mobile-item-checkbox { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.custom-checkbox { width: 20px; height: 20px; border: 2px solid var(--ink); border-radius: 6px; position: relative; background: var(--bg-card); }
.custom-checkbox.checked { background: var(--accent); border-color: var(--on-accent); }
.custom-checkbox.checked::after { content: '✓'; position: absolute; color: var(--on-accent); font-size: 12px; font-weight: 900; top: 50%; left: 50%; transform: translate(-50%, -50%); }

/* Action Dropdown */
.action-dropdown { position: relative; }
.dropdown-menu { position: absolute; top: 100%; right: 0; background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-sm); width: 200px; z-index: 50; padding: 6px; display: flex; flex-direction: column; }
.dropdown-menu button { padding: 10px 14px; text-align: left; background: none; border: none; color: var(--text-primary); font-weight: 600; cursor: pointer; border-radius: 8px; font-size: 14px; }
.dropdown-menu button:hover { background: var(--bg-hover); }

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
.panel-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel-header-row h3 { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
.panel-body-row { display: flex; gap: 24px; }
.panel-left { flex-shrink: 0; }
.panel-right { flex: 1; min-width: 0; }
.panel-img { width: 100%; max-width: 200px; border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow); margin: 0 auto; display: block; }
.panel-chart-section { margin-top: 20px; border-top: var(--bw) solid var(--border-subtle); padding-top: 16px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); font-size: 14px; }
.info-label { color: var(--text-secondary); font-weight: 600; }

/* PriceCharting fetch */
.pc-fetch-section { border-top: var(--bw) solid var(--border-subtle); padding-top: 14px; }
.pc-fetch-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 8px; }
.pc-result-box { background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-xs); padding: 14px; }
.pc-result-price-main { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pc-result-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

@media (max-width: 768px) {
  .portfolio-view { padding: 0; }
  .no-padding-mobile { border-radius: 0; border-left: none; border-right: none; box-shadow: none; padding: 0; }
  .px-mobile { padding-left: 16px; padding-right: 16px; }
  .mobile-full-width { width: 100%; }
  .hide-mobile { display: none !important; }
  .show-mobile { display: block !important; }
  .mobile-item-list.show-mobile { display: flex !important; }
  .item-detail-panel { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 150; max-height: 100vh; overflow-y: auto; border: none; border-radius: 0; box-shadow: none; margin: 0; background: var(--bg-primary); }
  .panel-body-row { flex-direction: column; gap: 24px; padding: 0 16px 24px; }
}
</style>
