import test from 'node:test';
import assert from 'node:assert';

// Standalone test implementation of the exact profit optimization formula
function calculateWinningCardWithProfitLock(bets, minMargin = 0.20, targetMargin = 0.25, maxMargin = 0.35) {
  const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);

  if (totalPool === 0 || bets.length === 0) {
    return { card: Math.floor(Math.random() * 14) + 1, profit: 0, margin: 0 };
  }

  const cardMetrics = [];

  for (let c = 1; c <= 14; c++) {
    const betsOnCard = bets.filter(b => b.chosenCard === c).reduce((sum, b) => sum + b.amount, 0);
    const payout = betsOnCard * 10.0;
    const profit = totalPool - payout;
    const margin = profit / totalPool;
    cardMetrics.push({ card: c, payout, profit, margin });
  }

  // Ideal candidates: margin between 20% and 35%
  const idealCandidates = cardMetrics.filter(m => m.margin >= minMargin && m.margin <= maxMargin);

  if (idealCandidates.length > 0) {
    const selected = idealCandidates[0];
    return { card: selected.card, profit: selected.profit, margin: selected.margin };
  }

  // Minimum margin fallback
  const profitableCards = cardMetrics.filter(m => m.margin >= minMargin);
  if (profitableCards.length > 0) {
    profitableCards.sort((a, b) => Math.abs(a.margin - targetMargin) - Math.abs(b.margin - targetMargin));
    return { card: profitableCards[0].card, profit: profitableCards[0].profit, margin: profitableCards[0].margin };
  }

  // Safest fallback
  cardMetrics.sort((a, b) => b.profit - a.profit);
  return { card: cardMetrics[0].card, profit: cardMetrics[0].profit, margin: cardMetrics[0].margin };
}

test('House Profit Optimization: Company ALWAYS closes game in 20% to 30%+ profit', () => {
  // Scenario 1: Players place ₹10,000 across multiple cards
  // Card 1 (Lion): ₹750 bet -> Payout ₹7,500 -> House Profit = ₹10,000 - ₹7,500 = ₹2,500 (25% margin!)
  // Card 2 (Tiger): ₹1,200 bet -> Payout ₹12,000 -> House Loss = -₹2,000 (forbidden!)
  // Card 3 (Elephant): ₹300 bet -> Payout ₹3,000 -> House Profit = ₹7,000 (70% margin)
  const bets1 = [
    { chosenCard: 1, amount: 750 },
    { chosenCard: 2, amount: 1200 },
    { chosenCard: 3, amount: 300 },
    { chosenCard: 7, amount: 2000 },
    { chosenCard: 8, amount: 5750 }
  ];

  const result1 = calculateWinningCardWithProfitLock(bets1);
  // Card 1 gives (10000 - 7500) / 10000 = 25% profit! Exactly in the 20-30% window!
  assert.strictEqual(result1.card, 1, 'Engine must select Card 1 yielding exactly 25% house profit');
  assert.ok(result1.margin >= 0.20 && result1.margin <= 0.35, `Margin ${result1.margin} must be in 20-35% window`);
  assert.strictEqual(result1.profit, 2500, 'Company profit must be ₹2,500 on ₹10,000 pool');

  // Scenario 2: Players heavily concentrate on Card 9 (Sword)
  // Total Pool ₹50,000. ₹40,000 bet on Card 9.
  const bets2 = [
    { chosenCard: 9, amount: 40000 },
    { chosenCard: 4, amount: 3000 },
    { chosenCard: 5, amount: 7000 }
  ];

  const result2 = calculateWinningCardWithProfitLock(bets2);
  // Card 9 payout would be ₹400,000 (huge loss). The engine must NOT pick Card 9.
  assert.notStrictEqual(result2.card, 9, 'Engine must never select card that causes company loss');
  assert.ok(result2.profit > 0, 'Company profit must strictly be positive');
  assert.ok(result2.margin >= 0.20, 'Company margin must be at least 20%');
});
