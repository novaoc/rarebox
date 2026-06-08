<template>
  <div class="trade-landing">
    <div class="landing-card">
      <div class="landing-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left-right"><path d="M17 2 21 6 17 10"/><path d="M7 22 3 18 7 14"/><path d="M21 6H3"/><path d="M3 18h18"/></svg>
      </div>
      <h1 class="landing-title">Trade Analyzer</h1>
      <p class="landing-subtitle">Compare the value of cards you're trading to make sure every deal is fair.</p>

      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-num">1</div>
          <div class="feature-text">
            <strong>Add your cards</strong> to Side A — search by name from any TCG
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-num">2</div>
          <div class="feature-text">
            <strong>Add their cards</strong> to Side B the same way
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-num">3</div>
          <div class="feature-text">
            <strong>See the delta</strong> — green means you're winning, red means you're losing
          </div>
        </div>
      </div>

      <router-link to="/trade/analyzer" class="btn btn-primary landing-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        Run Trade Analyzer
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.trade-landing {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 140px);
  padding: 24px;
}

.landing-card {
  max-width: 480px;
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 48px 36px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.landing-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--accent-dim);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.landing-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.landing-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  max-width: 360px;
}

.feature-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 16px;
  background: var(--bg-hover);
  border-radius: 10px;
}

.feature-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.feature-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.feature-text strong {
  color: var(--text-primary);
}

.landing-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 600;
  margin-top: 8px;
  text-decoration: none;
}
</style>
