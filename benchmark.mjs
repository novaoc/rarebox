#!/usr/bin/env node

// TCG API Benchmark Script
// Tests: Pokemon, MTG (Scryfall), Lorcana, One Piece, Yu-Gi-Oh, Riftbound

const results = [];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(ms) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'RareboxBenchmark/1.0' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`  Retry ${i + 1} for ${url}: ${e.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ============================================================
// 1. Pokemon (pokemontcg.io)
// ============================================================
async function benchmarkPokemon() {
  console.log('=== Pokemon (pokemontcg.io) ===');
  const start = Date.now();
  let totalBytes = 0;
  let totalCards = 0;
  const pageSize = 250;
  let page = 1;
  let totalCount = null;

  try {
    // Get total count
    const firstRes = await fetchWithRetry(`https://api.pokemontcg.io/v2/cards?page=1&pageSize=1`);
    const firstData = await firstRes.json();
    totalCount = firstData.totalCount;
    console.log(`  Total cards: ${totalCount}`);
    totalBytes += new TextEncoder().encode(JSON.stringify(firstData)).length;

    // Fetch all pages
    const totalPages = Math.ceil(totalCount / pageSize);
    for (let p = 1; p <= totalPages; p++) {
      const res = await fetchWithRetry(`https://api.pokemontcg.io/v2/cards?page=${p}&pageSize=${pageSize}`);
      const data = await res.json();
      const body = new TextEncoder().encode(JSON.stringify(data));
      totalBytes += body.length;
      totalCards += data.data?.length || 0;
      if (p % 10 === 0) console.log(`  Page ${p}/${totalPages} (${totalCards} cards so far)`);
    }

    const elapsed = Date.now() - start;
    results.push({
      name: 'Pokemon',
      cards: totalCount,
      time: formatTime(elapsed),
      size: formatSize(totalBytes),
      rawBytes: totalBytes,
      rawMs: elapsed
    });
    console.log(`  Done: ${totalCount} cards in ${formatTime(elapsed)}, ${formatSize(totalBytes)}\n`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}\n`);
    results.push({ name: 'Pokemon', cards: 'ERROR', time: 'ERROR', size: 'ERROR', rawBytes: 0, rawMs: 0 });
  }
}

// ============================================================
// 2. MTG (Scryfall)
// ============================================================
async function benchmarkMTG() {
  console.log('=== MTG (Scryfall) ===');
  const start = Date.now();
  let totalBytes = 0;
  let totalCards = 0;
  const pageSize = 175;
  let hasMore = true;
  let page = 1;
  let totalCount = null;

  try {
    // Get total count
    const firstRes = await fetchWithRetry(`https://api.scryfall.com/cards/search?q=*`);
    const firstData = await firstRes.json();
    totalCount = firstData.total_cards;
    console.log(`  Total cards: ${totalCount}`);
    totalBytes += new TextEncoder().encode(JSON.stringify(firstData)).length;
    totalCards += firstData.data?.length || 0;
    hasMore = firstData.has_more;
    page++;

    while (hasMore) {
      const res = await fetchWithRetry(`https://api.scryfall.com/cards/search?q=*&page=${page}`);
      const data = await res.json();
      const body = new TextEncoder().encode(JSON.stringify(data));
      totalBytes += body.length;
      totalCards += data.data?.length || 0;
      hasMore = data.has_more;
      page++;
      if (page % 10 === 0) console.log(`  Page ${page} (${totalCards} cards so far)`);
    }

    const elapsed = Date.now() - start;
    results.push({
      name: 'MTG (Scryfall)',
      cards: totalCount,
      time: formatTime(elapsed),
      size: formatSize(totalBytes),
      rawBytes: totalBytes,
      rawMs: elapsed
    });
    console.log(`  Done: ${totalCount} cards in ${formatTime(elapsed)}, ${formatSize(totalBytes)}\n`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}\n`);
    results.push({ name: 'MTG (Scryfall)', cards: 'ERROR', time: 'ERROR', size: 'ERROR', rawBytes: 0, rawMs: 0 });
  }
}

// ============================================================
// 3. Lorcana (lorcast.com)
// ============================================================
async function benchmarkLorcana() {
  console.log('=== Lorcana (lorcast.com) ===');
  const start = Date.now();
  let totalBytes = 0;
  let totalCards = 0;

  try {
    // Get sets
    const setsRes = await fetchWithRetry(`https://api.lorcast.com/v0/sets`);
    const setsData = await setsRes.json();
    const sets = setsData.data || setsData.results || setsData;
    console.log(`  Found ${sets.length} sets`);

    const setsArr = Array.isArray(sets) ? sets : Object.values(sets);
    totalBytes += new TextEncoder().encode(JSON.stringify(setsData)).length;

    for (const set of setsArr) {
      const code = set.code || set.id || set;
      const res = await fetchWithRetry(`https://api.lorcast.com/v0/sets/${code}/cards`);
      const data = await res.json();
      const body = new TextEncoder().encode(JSON.stringify(data));
      totalBytes += body.length;
      const cards = data.data || data.results || data;
      totalCards += Array.isArray(cards) ? cards.length : 0;
      console.log(`  Set ${code}: ${Array.isArray(cards) ? cards.length : '?'} cards`);
    }

    const elapsed = Date.now() - start;
    results.push({
      name: 'Lorcana',
      cards: totalCards,
      time: formatTime(elapsed),
      size: formatSize(totalBytes),
      rawBytes: totalBytes,
      rawMs: elapsed
    });
    console.log(`  Done: ${totalCards} cards in ${formatTime(elapsed)}, ${formatSize(totalBytes)}\n`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}\n`);
    results.push({ name: 'Lorcana', cards: 'ERROR', time: 'ERROR', size: 'ERROR', rawBytes: 0, rawMs: 0 });
  }
}

// ============================================================
// 4. One Piece (optcgapi.com)
// ============================================================
async function benchmarkOnePiece() {
  console.log('=== One Piece (optcgapi.com) ===');
  const start = Date.now();
  let totalBytes = 0;
  let totalCards = 0;

  try {
    const res = await fetchWithRetry(`https://optcgapi.com/api/allSetCards/`);
    const data = await res.json();
    const body = new TextEncoder().encode(JSON.stringify(data));
    totalBytes = body.length;
    
    // Count cards from response
    if (Array.isArray(data)) {
      totalCards = data.length;
    } else if (data.data) {
      totalCards = data.data.length;
    } else if (data.cards) {
      totalCards = data.cards.length;
    } else {
      // Try to count nested
      totalCards = Object.keys(data).reduce((acc, key) => {
        return acc + (Array.isArray(data[key]) ? data[key].length : 0);
      }, 0);
    }

    const elapsed = Date.now() - start;
    results.push({
      name: 'One Piece',
      cards: totalCards,
      time: formatTime(elapsed),
      size: formatSize(totalBytes),
      rawBytes: totalBytes,
      rawMs: elapsed
    });
    console.log(`  Done: ${totalCards} cards in ${formatTime(elapsed)}, ${formatSize(totalBytes)}\n`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}\n`);
    results.push({ name: 'One Piece', cards: 'ERROR', time: 'ERROR', size: 'ERROR', rawBytes: 0, rawMs: 0 });
  }
}

// ============================================================
// 5. Yu-Gi-Oh (ygoprodeck.com)
// ============================================================
async function benchmarkYugioh() {
  console.log('=== Yu-Gi-Oh (ygoprodeck.com) ===');
  const start = Date.now();
  let totalBytes = 0;
  let totalCards = 0;
  const pageSize = 5000;
  let offset = 0;

  try {
    while (true) {
      const res = await fetchWithRetry(`https://db.ygoprodeck.com/api/v7/cardinfo.php?num=${pageSize}&offset=${offset}`);
      const data = await res.json();
      const body = new TextEncoder().encode(JSON.stringify(data));
      totalBytes += body.length;
      const cards = data.data || data;
      const count = Array.isArray(cards) ? cards.length : 0;
      totalCards += count;
      console.log(`  Offset ${offset}: ${count} cards (total: ${totalCards})`);
      
      if (count < pageSize) break;
      offset += pageSize;
    }

    const elapsed = Date.now() - start;
    results.push({
      name: 'Yu-Gi-Oh',
      cards: totalCards,
      time: formatTime(elapsed),
      size: formatSize(totalBytes),
      rawBytes: totalBytes,
      rawMs: elapsed
    });
    console.log(`  Done: ${totalCards} cards in ${formatTime(elapsed)}, ${formatSize(totalBytes)}\n`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}\n`);
    results.push({ name: 'Yu-Gi-Oh', cards: 'ERROR', time: 'ERROR', size: 'ERROR', rawBytes: 0, rawMs: 0 });
  }
}

// ============================================================
// 6. Riftbound (riftcodex.com)
// ============================================================
async function benchmarkRiftbound() {
  console.log('=== Riftbound (riftcodex.com) ===');
  const start = Date.now();
  let totalBytes = 0;
  let totalCards = 0;

  try {
    // Get sets
    const setsRes = await fetchWithRetry(`https://api.riftcodex.com/sets`);
    const setsData = await setsRes.json();
    const sets = setsData.data || setsData.results || setsData;
    console.log(`  Found ${sets.length} sets`);
    totalBytes += new TextEncoder().encode(JSON.stringify(setsData)).length;

    const setsArr = Array.isArray(sets) ? sets : Object.values(sets);

    for (const set of setsArr) {
      const setId = set.id || set.code || set;
      let page = 1;
      let setCards = 0;

      while (true) {
        const res = await fetchWithRetry(`https://api.riftcodex.com/cards?set_id=${setId}&limit=50&page=${page}`);
        const data = await res.json();
        const body = new TextEncoder().encode(JSON.stringify(data));
        totalBytes += body.length;
        const cards = data.data || data.results || data;
        const count = Array.isArray(cards) ? cards.length : 0;
        setCards += count;
        if (count < 50) break;
        page++;
      }

      totalCards += setCards;
      console.log(`  Set ${set.name || set.id}: ${setCards} cards`);
    }

    const elapsed = Date.now() - start;
    results.push({
      name: 'Riftbound',
      cards: totalCards,
      time: formatTime(elapsed),
      size: formatSize(totalBytes),
      rawBytes: totalBytes,
      rawMs: elapsed
    });
    console.log(`  Done: ${totalCards} cards in ${formatTime(elapsed)}, ${formatSize(totalBytes)}\n`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}\n`);
    results.push({ name: 'Riftbound', cards: 'ERROR', time: 'ERROR', size: 'ERROR', rawBytes: 0, rawMs: 0 });
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('TCG API Benchmark - Starting...\n');
  
  await benchmarkPokemon();
  await benchmarkMTG();
  await benchmarkLorcana();
  await benchmarkOnePiece();
  await benchmarkYugioh();
  await benchmarkRiftbound();

  // Generate markdown table
  let md = '# TCG API Benchmarks\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += '| TCG | Total Cards | Download Time | Response Size |\n';
  md += '|-----|-------------|---------------|---------------|\n';
  
  for (const r of results) {
    md += `| ${r.name} | ${r.cards} | ${r.time} | ${r.size} |\n`;
  }

  md += '\n## Notes\n\n';
  md += '- All measurements taken sequentially\n';
  md += '- Response size is total JSON body size across all pages/requests\n';
  md += '- Times include network latency\n';

  const fs = await import('fs');
  fs.writeFileSync('/tmp/tcg-benchmarks.md', md);
  console.log('Results written to /tmp/tcg-benchmarks.md');
  console.log('\nSummary:');
  console.log(md);
}

main().catch(console.error);
