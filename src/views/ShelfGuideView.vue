<template>
  <div class="guide-view">
    <header class="guide-hero">
      <RbIcon name="shelf" :size="56" class="guide-hero-icon" />
      <h1>How shelves work</h1>
      <p>
        Everything the dashboard and your shelves can do — adding cards, whole sets,
        sealed boxes, graded slabs, master sets, prices and charts. Five minutes,
        and you'll know all of it.
      </p>
    </header>

    <!-- ── 1. Dashboard ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="chart" :size="30" /></span>
        <h2>The dashboard</h2>
      </div>
      <p>
        The home screen totals every shelf you own: <strong>Total Shelf Value</strong> (live market),
        <strong>Cost Basis</strong> (what you actually paid), <strong>Gain/Loss</strong>, and your item count.
        Below that, each shelf shows its own value, item count and trend, and the combined chart
        draws your whole collection's value over time.
      </p>
      <p class="guide-tip">
        A <em>shelf</em> is just a container — make one per set, per game, per binder,
        or one big one. Each shelf gets a name and a color.
      </p>
    </section>

    <!-- ── 2. Creating shelves ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="shelf" :size="30" /></span>
        <h2>Creating a shelf</h2>
      </div>
      <ul>
        <li><strong>+ New Shelf</strong> on the dashboard, or <strong>New Shelf</strong> in the More menu.</li>
        <li>
          Straight from Browse: open any set, hit <strong>+ Add Set</strong>, and pick
          <strong>＋ New shelf…</strong> in the shelf dropdown. The set's name is pre-suggested
          as the shelf name — leave it empty to accept, or type your own.
        </li>
      </ul>
    </section>

    <!-- ── 3. Adding cards ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="card" :size="30" /></span>
        <h2>Adding single cards</h2>
      </div>
      <p>
        <strong>+ Add Card</strong> opens Search — every game, English and Japanese Pokémon both.
        Pick a card, choose its <strong>variant/finish</strong> (holo, reverse, 1st edition…),
        set the purchase price, date and quantity, and pick which shelf it lands on.
      </p>
      <p>
        From <router-link to="/sets">Browse</router-link>, every card has
        <strong>+ Add</strong> and <strong>Details</strong> — Details shows the full price-history
        chart before you buy. You can also set a <RbIcon name="bell" :size="13" />
        <strong>price alert</strong> on any card from Search and get flagged when it crosses your threshold.
      </p>
      <p class="guide-tip">
        Purchase price + date matter: they drive your gain/loss math and where your
        shelf's history chart starts.
      </p>
    </section>

    <!-- ── 4. Adding whole sets ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="download" :size="30" /></span>
        <h2>Adding a whole set at once</h2>
      </div>
      <p>
        In Browse, open a set and hit <strong>+ Add Set</strong>. Every card you don't already own
        comes pre-checked; cards already on the selected shelf are unchecked. The footer totals
        what completing the set costs at market today. Works for all games — Pokémon EN/JP, Magic,
        Yu-Gi-Oh!, Lorcana, One Piece, Riftbound.
      </p>
      <p>
        Prefer text lists? <strong>Import</strong> on a shelf accepts pasted deck/collection lists
        (e.g. PTCGL format: <code>4 Charizard ex OBF 125</code>).
      </p>
    </section>

    <!-- ── 5. Sealed & graded ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="box" :size="30" /></span>
        <h2>Sealed products &amp; graded slabs</h2>
      </div>
      <p>
        The add dialog has three types: <strong>Raw Card</strong>, <strong>Graded Slab</strong>
        and <strong>Sealed Product</strong>. Sealed (booster boxes, ETBs, tins) and graded slabs
        are priced through PriceCharting — search the product, tap a result, and the current
        market value fills in. Graded slabs track the company (PSA/BGS/CGC/ACE) and grade,
        with grade-specific pricing.
      </p>
      <p>
        On a shelf, <strong>+ Sealed</strong> jumps straight to the sealed flow. Tap any item later
        to re-fetch its value, edit details, or set quantities.
      </p>
    </section>

    <!-- ── 6. Master sets ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="binder" :size="30" /></span>
        <h2>Master sets — showcase &amp; hunt</h2>
      </div>
      <p>
        A master set collapses every single from one set into a single binder stack with combined
        value and a completion bar. Three ways in:
      </p>
      <ul>
        <li><strong>The nudge</strong> — own 80%+ of a set and the shelf suggests showcasing it.</li>
        <li><strong>★ Master Set</strong> on a shelf — adds every card of a set in one go (cards you own are skipped) and showcases it.</li>
        <li>Cards you already own group automatically once showcased.</li>
      </ul>
      <p>
        <strong>Show cards</strong> opens the Hunt gallery: the whole set in collector order, with cards
        you're missing dimmed and tagged <strong>NOT OWNED</strong>. Out hunting? Tap a missing card to
        mark it <strong>FOUND <RbIcon name="confetti" :size="13" /></strong> — then one button adds the
        day's finds to the shelf with today's date.
      </p>
      <p>
        <strong><RbIcon name="magnifier" :size="13" /> Show bigger</strong> opens any card full-size, and you can
        <strong>swipe left/right</strong> through every card you still need — hand the phone to a vendor
        and they can flip through your whole want-list. <strong>Unstack</strong> puts the singles back in
        the table any time.
      </p>
    </section>

    <!-- ── 7. Prices & charts ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="trend" :size="30" /></span>
        <h2>Prices &amp; history charts</h2>
      </div>
      <p>
        <strong>↻ Prices</strong> refreshes a shelf against live market data. Every card's detail
        view charts real TCGplayer market history — daily since Feb 2024 for all games, and back
        to Nov 2022 for English Pokémon — with variants charted separately (holo vs 1st edition…).
      </p>
      <p>
        Your shelf's value chart is rebuilt from that same per-card history <em>since the day you
        acquired each item</em> — it shows what your collection was actually worth last month,
        not just snapshots from days the app was open.
      </p>
    </section>

    <!-- ── 8. Backups, sync & offline ── -->
    <section class="guide-card">
      <div class="guide-card-head">
        <span class="guide-icon-chip"><RbIcon name="antenna" :size="30" /></span>
        <h2>Backups, device sync &amp; offline</h2>
      </div>
      <p>
        Shelves live on your device — nothing is uploaded. <strong>Export</strong> produces an Excel
        sheet of any shelf; Settings has full-collection backup &amp; restore; and
        <strong>Local Sync</strong> moves your whole collection to another device with a QR code,
        no internet needed.
      </p>
      <p>
        Everything you've opened once — sets, card lists, prices, charts — keeps working offline:
        card-shop basement, airplane, tournament dead zone.
      </p>
    </section>

    <div class="guide-cta">
      <router-link to="/" class="btn btn-primary">Open the dashboard</router-link>
      <router-link to="/sets" class="btn btn-secondary">Browse sets</router-link>
    </div>
  </div>
</template>

<script setup>
import RbIcon from '../components/icons/RbIcon.vue'
</script>

<style scoped>
.guide-view { max-width: 760px; margin: 0 auto; padding-bottom: 80px; }

.guide-hero { text-align: center; padding: 28px 16px 8px; }
.guide-hero-icon { margin-bottom: 6px; }
.guide-hero h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 8px; }
.guide-hero p { color: var(--text-secondary); font-size: 14px; line-height: 1.6; max-width: 540px; margin: 0 auto; }

.guide-card {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 20px 22px;
  margin: 18px 12px;
}
.guide-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.guide-card-head h2 { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
.guide-icon-chip {
  display: inline-flex;
  width: 46px;
  height: 46px;
  padding: 7px;
  background: var(--bg-secondary);
  border: 2px solid var(--ink);
  border-radius: 12px;
  box-shadow: 3px 3px 0 var(--ink);
  flex-shrink: 0;
}
.guide-card p, .guide-card li { font-size: 13.5px; line-height: 1.65; color: var(--text-primary); }
.guide-card p + p, .guide-card ul { margin-top: 10px; }
.guide-card ul { padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.guide-card code { font-size: 12px; background: var(--bg-secondary); border: 1px solid var(--ink); border-radius: 5px; padding: 1px 5px; }
.guide-tip {
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--accent-dim);
  border: 1.5px solid var(--ink);
  border-radius: var(--radius);
  font-size: 12.5px !important;
}
.guide-cta { display: flex; justify-content: center; gap: 12px; margin-top: 26px; }
</style>
