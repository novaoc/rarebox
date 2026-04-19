<template>
  <div class="terms-view">
    <router-link to="/" class="btn btn-ghost btn-sm mb-4">← Back</router-link>

    <div class="terms-card">
      <h1>Terms &amp; Conditions</h1>
      <p class="terms-updated">Last updated: April 2026</p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using Rarebox ("the Service"), you agree to be bound by these
          Terms &amp; Conditions. If you do not agree, do not use the Service.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          Rarebox is a free, client-side Pokémon TCG portfolio tracker. It allows you to
          track your card collection, monitor market values, build decks, browse sets,
          and view price history charts. The Service processes all data locally in your
          browser — there are no user accounts, no server-side storage, and no backend
          database.
        </p>
      </section>

      <section>
        <h2>3. How It Works</h2>
        <p>Rarebox is a Progressive Web App (PWA) that runs entirely in your browser:</p>
        <ul>
          <li><strong>Portfolio tracking</strong> — your portfolios, items, notes, and
            daily price snapshots are stored in your browser's IndexedDB and never
            leave your device unless you export or sync them.</li>
          <li><strong>Card data</strong> — card names, images, and set information are
            fetched from the pokemontcg.io API. Japanese sets use the tcgdex API.</li>
          <li><strong>Price data</strong> — current prices for graded and sealed products
            are fetched from PriceCharting. Card price history is fetched from tcgdex
            and PriceCharting's public JSON API.</li>
          <li><strong>Cross-device sync</strong> — optional sync to jsonbin.io uses an
            API key you provide. Data is transmitted directly from your browser to
            jsonbin.io. We do not intermediate or store your data.</li>
          <li><strong>Deck building</strong> — decks and meta deck data are stored
            locally. Meta deck data is fetched from our GitHub-hosted JSON files.</li>
        </ul>
      </section>

      <section>
        <h2>4. No Guarantee of Accuracy</h2>
        <p>
          Card prices, set information, and all other data are provided "as is" from
          third-party sources. We make no warranties regarding accuracy, completeness,
          or timeliness. Prices may be outdated, inaccurate, or unavailable. Do not
          make financial decisions based solely on data displayed by the Service.
        </p>
      </section>

      <section>
        <h2>5. Not a Financial Advisor</h2>
        <p>
          Rarebox is not a financial product, investment platform, or trading service.
          We do not provide financial advice, tax guidance, or investment recommendations.
          Card values fluctuate and past performance does not indicate future results.
          You are solely responsible for any buying, selling, or trading decisions.
        </p>
      </section>

      <section>
        <h2>6. Not an E-Commerce Platform</h2>
        <p>
          Rarebox does not facilitate buying, selling, or trading of Pokémon cards.
          We do not process payments, handle transactions, or connect buyers with sellers.
          Any trading or purchasing activity you engage in as a result of information
          found on the Service is entirely at your own risk.
        </p>
      </section>

      <section>
        <h2>7. Third-Party Services</h2>
        <p>The Service relies on the following third-party APIs and services:</p>
        <ul>
          <li><strong>pokemontcg.io</strong> — card data and English set information</li>
          <li><strong>tcgdex.net</strong> — Japanese card data, set information, and
            card images</li>
          <li><strong>PriceCharting</strong> — graded and sealed product pricing</li>
          <li><strong>Vercel</strong> — hosting and CDN</li>
          <li><strong>jsonbin.io</strong> — optional cross-device sync (only if you
            configure it)</li>
          <li><strong>GitHub</strong> — source code hosting and meta deck data</li>
        </ul>
        <p>
          We have no control over these services. Your browser makes direct requests
          to them, and they may log standard request data (IP address, user agent)
          according to their own privacy policies.
        </p>
      </section>

      <section>
        <h2>8. Local Storage &amp; Your Data</h2>
        <p>
          All portfolio data, deck data, settings, price snapshots, and preferences
          are stored exclusively in your browser's IndexedDB. This data never leaves
          your device unless you explicitly export it or configure cross-device sync.
          IndexedDB is more resilient than localStorage and is not cleared by standard
          page refreshes, but clearing your browser site data will permanently delete
          all your Rarebox data. We cannot recover it. We recommend using the backup
          export feature in Settings regularly.
        </p>
      </section>

      <section>
        <h2>9. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Rarebox and its developer(s) shall
          not be liable for any direct, indirect, incidental, special, consequential,
          or punitive damages arising from your use of the Service, including but not
          limited to:
        </p>
        <ul>
          <li>Financial losses from trading or collecting decisions</li>
          <li>Inaccurate price data or market information</li>
          <li>Loss of locally stored data</li>
          <li>Service unavailability or interruption</li>
          <li>Errors in third-party data sources</li>
          <li>Any damages from external links or third-party content</li>
        </ul>
      </section>

      <section>
        <h2>10. No Warranty</h2>
        <p>
          The Service is provided "as is" and "as available" without warranties of
          any kind, express or implied, including merchantability, fitness for a
          particular purpose, and non-infringement. We do not guarantee the Service
          will be uninterrupted, error-free, or secure.
        </p>
      </section>

      <section>
        <h2>11. External Links</h2>
        <p>
          The Service links to external websites (card marketplaces, set databases,
          etc.) that are not operated by us. We are not responsible for their content,
          privacy practices, or terms. You access external links at your own risk.
        </p>
      </section>

      <section>
        <h2>12. Age Restriction</h2>
        <p>
          Rarebox is not directed at children under the age of 13. The Service involves
          financial concepts (market values, portfolio tracking, price history) that are
          intended for users aged 13 and older. By using the Service, you confirm you
          are at least 13 years of age. If you are under 13, do not use the Service.
        </p>
      </section>

      <section>
        <h2>13. Intellectual Property</h2>
        <p>
          Pokémon and Pokémon character names are trademarks of Nintendo, The Pokémon
          Company, and/or Game Freak. Rarebox is not affiliated with, endorsed by, or
          sponsored by any of these entities. Card images and data are sourced from
          third-party APIs and are the property of their respective owners.
        </p>
      </section>

      <section>
        <h2>14. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Rarebox and its developer(s) from
          any claims, damages, losses, or expenses arising from your use of the Service
          or violation of these Terms.
        </p>
      </section>

      <section>
        <h2>15. Modifications</h2>
        <p>
          We reserve the right to modify these Terms at any time without prior notice.
          Continued use of the Service after changes constitutes acceptance of the
          updated Terms.
        </p>
      </section>

      <section>
        <h2>16. Governing Law</h2>
        <p>
          These Terms shall be governed by applicable laws. Any disputes shall be
          resolved in the appropriate jurisdiction.
        </p>
      </section>
    </div>

    <div class="terms-card" style="margin-top: 20px">
      <h1>Privacy Policy</h1>
      <p class="terms-updated">Last updated: April 2026</p>

      <section>
        <h2>1. Overview</h2>
        <p>
          Rarebox is a fully client-side application. It has no backend server, no
          database, and no user accounts. All data processing happens locally in your
          browser.
        </p>
      </section>

      <section>
        <h2>2. Data We Collect</h2>
        <p>
          <strong>We do not collect any personal data.</strong> Rarebox has no server,
          no user accounts, and no login systems. There are no cookies set by the
          application itself. However, we do use Vercel Analytics and Speed Insights for
          anonymized usage metrics — see Section 6 for details.
        </p>
      </section>

      <section>
        <h2>3. Local Storage</h2>
        <p>Rarebox uses your browser's IndexedDB to save:</p>
        <ul>
          <li><strong>Portfolios</strong> — your card collections, quantities, purchase
            prices, notes, and daily price snapshots</li>
          <li><strong>Decks</strong> — deck lists, card quantities, and meta deck
            imports</li>
          <li><strong>Settings</strong> — sync API keys, preferences, and theme
            selection</li>
          <li><strong>Cached data</strong> — API responses cached to reduce network
            requests</li>
        </ul>
        <p>
          This data never leaves your browser. You can export or delete it at any time
          from the Settings page. Existing users are automatically migrated from
          localStorage to IndexedDB.
        </p>
      </section>

      <section>
        <h2>4. Cross-Device Sync</h2>
        <p>
          If you configure cross-device sync, your portfolio data is transmitted
          directly from your browser to jsonbin.io using an API key you provide.
          Rarebox does not intermediate, log, or store this data. jsonbin.io's
          privacy policy governs how they handle your data.
        </p>
      </section>

      <section>
        <h2>5. Third-Party Services</h2>
        <p>Your browser makes direct requests to:</p>
        <ul>
          <li><strong>Vercel</strong> — hosting provider. May log standard
            request data (IP, user agent) per their privacy policy.</li>
          <li><strong>pokemontcg.io</strong> — card data API</li>
          <li><strong>tcgdex.net</strong> — Japanese card data and images</li>
          <li><strong>PriceCharting</strong> — pricing data</li>
          <li><strong>jsonbin.io</strong> — only if you configure sync</li>
          <li><strong>GitHub</strong> — source code and meta deck data</li>
        </ul>
      </section>

      <section>
        <h2>6. Analytics</h2>
        <p>
          Rarebox does not collect any analytics. No page views, no tracking,
          no cookies, no fingerprinting, no advertising networks. We do not
          track your searches, card views, portfolio contents, or any
          interaction within the app.
        </p>
      </section>

      <section>
        <h2>7. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy at any time. Changes will be reflected
          on this page with an updated date.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.terms-view { max-width: 720px; margin: 0 auto; }

.terms-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
}
.terms-card h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.terms-updated { font-size: 12px; color: var(--text-muted); margin-bottom: 24px; }

.terms-card section { margin-bottom: 24px; }
.terms-card h2 { font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary); }
.terms-card p { font-size: 13px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 8px; }
.terms-card ul { padding-left: 20px; margin: 8px 0; }
.terms-card li { font-size: 13px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 4px; }
.terms-card code { background: var(--bg-hover); padding: 1px 5px; border-radius: 3px; font-size: 12px; }

@media (max-width: 768px) {
  .terms-card { padding: 20px; }
}
</style>
