import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePortfolioStore } from './portfolio'
import { getMarketPrice } from '../services/pokemonApi'
import { multiSearch, resolveCard } from '../services/tcg/multiSearch'

const STORAGE_KEY = 'rarebox_decks'

function generateId() {
  return crypto.randomUUID()
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveToStorage(decks) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(decks)) } catch {}
}

export const useDeckStore = defineStore('decks', () => {
  const decks = ref(loadFromStorage())

  function persist() {
    saveToStorage(decks.value)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────

  function createDeck(name, game = 'pokemon') {
    const deck = {
      id: generateId(),
      name,
      game,
      cards: [],
      createdAt: new Date().toISOString(),
    }
    decks.value.push(deck)
    persist()
    return deck
  }

  function updateDeck(id, updates) {
    const idx = decks.value.findIndex(d => d.id === id)
    if (idx === -1) return
    decks.value[idx] = { ...decks.value[idx], ...updates }
    persist()
  }

  function deleteDeck(id) {
    decks.value = decks.value.filter(d => d.id !== id)
    persist()
  }

  // ── Card operations ───────────────────────────────────────────────────

  function addCardToDeck(deckId, card, quantity = 1) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return

    const existing = deck.cards.find(c => c.cardId === card.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      const rawSet = card.set
      const setName = typeof rawSet === 'object' ? (rawSet?.name || '') : (rawSet || '')
      const setCode = typeof rawSet === 'object' ? (rawSet?.id || '') : ''
      const price = card.price != null ? card.price : (getMarketPrice(card)?.price || null)
      const image = card.image || card.images?.small || ''
      const game = card.game || deck.game || 'pokemon'

      deck.cards.push({
        cardId: card.id,
        name: card.name,
        setName,
        setCode,
        number: card.number || '',
        quantity,
        price,
        image,
        game,
      })
    }
    persist()
  }

  function addCardRaw(deckId, cardData) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return

    const existing = deck.cards.find(c => c.cardId === cardData.cardId)
    if (existing) {
      existing.quantity += cardData.quantity || 1
    } else {
      deck.cards.push({
        cardId: cardData.cardId,
        name: cardData.name,
        setName: cardData.setName || '',
        setCode: cardData.setCode || '',
        number: cardData.number || '',
        quantity: cardData.quantity || 1,
        price: cardData.price || null,
        image: cardData.image || '',
        game: cardData.game || deck.game || 'pokemon',
      })
    }
    persist()
  }

  function updateCardQuantity(deckId, cardId, quantity) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return
    if (quantity <= 0) {
      deck.cards = deck.cards.filter(c => c.cardId !== cardId)
    } else {
      const card = deck.cards.find(c => c.cardId === cardId)
      if (card) card.quantity = quantity
    }
    persist()
  }

  function removeCardFromDeck(deckId, cardId) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return
    deck.cards = deck.cards.filter(c => c.cardId !== cardId)
    persist()
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  function getDeckStats(deckId) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return null

    const portfolioStore = usePortfolioStore()
    const ownedMap = {}
    for (const p of portfolioStore.portfolios) {
      for (const item of p.items) {
        if (item.type === 'card' && item.cardId) {
          ownedMap[item.cardId] = (ownedMap[item.cardId] || 0) + (item.quantity || 1)
        }
      }
    }

    let totalCost = 0
    let totalCards = 0
    let ownedCards = 0
    let neededCards = 0

    for (const card of deck.cards) {
      const needed = card.quantity || 1
      const owned = Math.min(ownedMap[card.cardId] || 0, needed)
      const stillNeeded = needed - owned

      totalCards += needed
      ownedCards += owned
      neededCards += stillNeeded
      totalCost += (card.price || 0) * stillNeeded
    }

    return {
      totalCards,
      ownedCards,
      neededCards,
      totalCost,
      completionPct: totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0,
      isComplete: neededCards === 0 && totalCards > 0,
    }
  }

  // ── Import from meta deck data ────────────────────────────────────────

  async function findRegularCard(name, setCode, game = 'pokemon') {
    const result = await multiSearch(name, { page: 1, pageSize: 50, providers: [game] })
    if (!result?.cards?.length) return null

    const q = (setCode || '').toLowerCase()

    const matches = result.cards.filter(c => {
      if (game === 'pokemon') {
        if (c.id && c.id.startsWith(q.replace(/[^a-z0-9]/g, ''))) return true
      }
      if (game === 'mtg') {
        if (c._raw?.set?.toLowerCase() === q) return true
      }
      if (game === 'lorcana') {
        if (c._raw?.set_code?.toLowerCase() === q) return true
        if (c._raw?.set_name?.toLowerCase().includes(q)) return true
      }
      if (game === 'one-piece') {
        if (c.id && c.id.startsWith(q)) return true
      }
      if (game === 'riftbound') {
        if (c._raw?.set?.set_id?.toLowerCase() === q) return true
        if ((c.set || '').toLowerCase().includes(q)) return true
      }
      if (game === 'yugioh') {
        if (c.number && c.number.toLowerCase().startsWith(q)) return true
      }
      return false
    })

    const candidates = matches.length > 0 ? matches : result.cards
    candidates.sort((a, b) => (a.price ?? 999) - (b.price ?? 999))

    return candidates[0] || null
  }

  async function importMetaDeck(metaDeck) {
    const deck = createDeck(metaDeck.name, metaDeck.game || 'pokemon')
    const promises = metaDeck.cards.map(async (card) => {
      if (card.cardId) {
        addCardRaw(deck.id, {
          cardId: card.cardId,
          name: card.name,
          setName: card.setName || '',
          setCode: card.setCode || '',
          number: card.number || '',
          quantity: card.quantity,
          price: card.price || null,
          image: card.image || '',
          game: card.game || metaDeck.game || 'pokemon',
        })
        return
      }

      let fullCard = null
      try {
        fullCard = await findRegularCard(card.name, card.setCode, metaDeck.game || 'pokemon')
      } catch {}

      if (fullCard) {
        addCardRaw(deck.id, {
          cardId: fullCard.id,
          name: card.name,
          setName: fullCard.set || card.setName || '',
          setCode: card.setCode || '',
          number: fullCard.number || '',
          quantity: card.quantity,
          price: fullCard.price ?? null,
          image: fullCard.image || '',
          game: metaDeck.game || 'pokemon',
        })
      } else {
        const game = metaDeck.game || 'pokemon'
        // Build a meaningful cardId fallback per TCG
        let fallbackId = `${card.setCode || ''}-${card.name}`
        if (game === 'pokemon' && card.number) {
          fallbackId = `${(card.setCode || '').toLowerCase()}-${card.number}`
        } else if (game === 'one-piece' && card.number) {
          fallbackId = `${card.setCode}-${card.number}`
        } else if (game === 'yugioh' && card.number) {
          fallbackId = `ygo-${card.number}`
        }
        addCardRaw(deck.id, {
          cardId: fallbackId,
          name: card.name,
          setName: card.setName || '',
          setCode: card.setCode || '',
          number: card.number || '',
          quantity: card.quantity,
          price: null,
          image: '',
          game,
        })
      }
    })
    await Promise.allSettled(promises)
    return deck
  }

  async function refreshDeckPrices(deckId) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return
    const promises = deck.cards.map(async (card) => {
      if (card.price) return
      try {
        const fullCard = await resolveCard(card.cardId, card.game)
        if (fullCard?.price != null) card.price = fullCard.price
      } catch {}
    })
    await Promise.allSettled(promises)
    persist()
  }

  return {
    decks,
    createDeck,
    updateDeck,
    deleteDeck,
    addCardToDeck,
    addCardRaw,
    updateCardQuantity,
    removeCardFromDeck,
    getDeckStats,
    importMetaDeck,
    refreshDeckPrices,
    persist,
  }
})
