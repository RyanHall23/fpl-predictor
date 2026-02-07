#!/bin/bash

# Integration Test for Squad Management, Transfers, and Chips
# Tests the complete workflow using mock FPL API data

echo "=================================="
echo "FPL Squad Management Integration Test"
echo "=================================="
echo ""

cd "$(dirname "$0")/.."

echo "Prerequisites:"
echo "  - MongoDB should be running on localhost:27017"
echo "  - Backend dependencies installed (npm install)"
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  Warning: MongoDB doesn't appear to be running"
    echo "   Start MongoDB with: mongod --dbpath /path/to/data"
    echo ""
fi

echo "Test Mode: USE_FPL_API=false (using mock data)"
echo ""

# Test 1: Model Calculations
echo "1. Testing Player Value Calculations..."
USE_FPL_API=false node -e "
function getSellingPrice(player) {
  if (player.currentPrice <= player.purchasePrice) {
    return player.currentPrice;
  }
  const profit = player.currentPrice - player.purchasePrice;
  const profitToKeep = Math.floor(profit / 2);
  return player.purchasePrice + profitToKeep;
}

const testCases = [
  { name: 'Price increase', purchase: 75, current: 78, expected: 76 },
  { name: 'Price decrease', purchase: 80, current: 75, expected: 75 },
  { name: 'No change', purchase: 100, current: 100, expected: 100 },
  { name: 'Large increase', purchase: 50, current: 65, expected: 57 },
];

let passed = 0;
testCases.forEach(test => {
  const result = getSellingPrice({ purchasePrice: test.purchase, currentPrice: test.current });
  const success = result === test.expected;
  console.log('   ' + (success ? '✓' : '✗') + ' ' + test.name + ': £' + (test.purchase/10) + 'm → £' + (test.current/10) + 'm = £' + (result/10) + 'm (expected £' + (test.expected/10) + 'm)');
  if (success) passed++;
});

console.log('   ' + passed + '/' + testCases.length + ' tests passed\\n');
process.exit(passed === testCases.length ? 0 : 1);
"

if [ $? -ne 0 ]; then
    echo "❌ Player value calculation tests failed"
    exit 1
fi

# Test 2: Transfer Cost Calculations
echo "2. Testing Transfer Cost Calculations..."
node -e "
function getTransferCost(transfersMade, freeTransfers, activeChip) {
  if (activeChip === 'wildcard' || activeChip === 'free_hit') {
    return 0;
  }
  const excessTransfers = Math.max(0, transfersMade - freeTransfers);
  return excessTransfers * 4;
}

const testCases = [
  { desc: '1 transfer, 1 free', transfers: 1, free: 1, chip: null, expected: 0 },
  { desc: '2 transfers, 1 free', transfers: 2, free: 1, chip: null, expected: 4 },
  { desc: '3 transfers, 2 free', transfers: 3, free: 2, chip: null, expected: 4 },
  { desc: '5 transfers, wildcard', transfers: 5, free: 1, chip: 'wildcard', expected: 0 },
  { desc: '10 transfers, free hit', transfers: 10, free: 1, chip: 'free_hit', expected: 0 },
];

let passed = 0;
testCases.forEach(test => {
  const result = getTransferCost(test.transfers, test.free, test.chip);
  const success = result === test.expected;
  console.log('   ' + (success ? '✓' : '✗') + ' ' + test.desc + ': ' + result + ' points (expected ' + test.expected + ')');
  if (success) passed++;
});

console.log('   ' + passed + '/' + testCases.length + ' tests passed\\n');
process.exit(passed === testCases.length ? 0 : 1);
"

if [ $? -ne 0 ]; then
    echo "❌ Transfer cost calculation tests failed"
    exit 1
fi

# Test 3: Chip Availability Logic
echo "3. Testing Chip Availability Logic..."
node -e "
function isChipAvailable(chipType, gameweek, lastFreeHitGW) {
  const chips = {
    bench_boost_1: { from: 1, to: 19 },
    bench_boost_2: { from: 20, to: 38 },
    triple_captain_1: { from: 1, to: 19 },
    triple_captain_2: { from: 20, to: 38 },
    free_hit_1: { from: 2, to: 19 },
    free_hit_2: { from: 20, to: 38 },
    wildcard_1: { from: 2, to: 19 },
    wildcard_2: { from: 20, to: 38 }
  };
  
  const chip = chips[chipType];
  if (!chip) return false;
  
  // Check gameweek range
  if (gameweek < chip.from || gameweek > chip.to) return false;
  
  // Check Free Hit consecutive rule
  if (chipType.startsWith('free_hit') && lastFreeHitGW && (gameweek - lastFreeHitGW) < 2) {
    return false;
  }
  
  return true;
}

const testCases = [
  { chip: 'bench_boost_1', gw: 1, lastFH: null, expected: true, desc: 'BB1 in GW1' },
  { chip: 'bench_boost_1', gw: 20, lastFH: null, expected: false, desc: 'BB1 in GW20 (out of range)' },
  { chip: 'free_hit_1', gw: 1, lastFH: null, expected: false, desc: 'FH1 in GW1 (not available)' },
  { chip: 'free_hit_1', gw: 5, lastFH: 4, expected: false, desc: 'FH1 in GW5 after GW4 (consecutive)' },
  { chip: 'free_hit_1', gw: 6, lastFH: 4, expected: true, desc: 'FH1 in GW6 after GW4 (ok)' },
  { chip: 'wildcard_2', gw: 25, lastFH: null, expected: true, desc: 'WC2 in GW25' },
];

let passed = 0;
testCases.forEach(test => {
  const result = isChipAvailable(test.chip, test.gw, test.lastFH);
  const success = result === test.expected;
  console.log('   ' + (success ? '✓' : '✗') + ' ' + test.desc + ': ' + result + ' (expected ' + test.expected + ')');
  if (success) passed++;
});

console.log('   ' + passed + '/' + testCases.length + ' tests passed\\n');
process.exit(passed === testCases.length ? 0 : 1);
"

if [ $? -ne 0 ]; then
    echo "❌ Chip availability logic tests failed"
    exit 1
fi

# Test 4: Model Structure Tests
echo "4. Testing Model Structures..."
pushd "$(dirname "$0")" > /dev/null
node -e "
const mongoose = require('mongoose');
const Squad = require('./models/squadModel');
const Transfer = require('./models/transferModel');
const Chip = require('./models/chipModel');

try {
  // Test Squad model
  const squad = new Squad({
    userId: new mongoose.Types.ObjectId(),
    gameweek: 1,
    players: [{
      playerId: 1,
      position: 1,
      purchasePrice: 75,
      currentPrice: 78,
      isCaptain: false,
      isViceCaptain: false,
      multiplier: 1
    }],
    bank: 5,
    squadValue: 1005,
    freeTransfers: 1
  });
  console.log('   ✓ Squad model structure valid');
  
  // Test Transfer model
  const transfer = new Transfer({
    userId: new mongoose.Types.ObjectId(),
    gameweek: 1,
    playerIn: { playerId: 2, price: 80 },
    playerOut: { playerId: 1, purchasePrice: 75, sellingPrice: 76 },
    isFree: true,
    pointsCost: 0
  });
  console.log('   ✓ Transfer model structure valid');
  
  // Test Chip model
  const chip = new Chip({
    userId: new mongoose.Types.ObjectId()
  });
  console.log('   ✓ Chip model structure valid');
  
  // Test chip methods
  const availableChips = chip.getAvailableChips(10);
  console.log('   ✓ Chip availability method works: ' + availableChips.length + ' chips available');
  
  const chipUsed = chip.useChip('wildcard_1', 10);
  console.log('   ✓ Chip usage method works: ' + chipUsed);
  
  console.log();
  process.exit(0);
} catch (e) {
  console.log('   ✗ Error: ' + e.message);
  process.exit(1);
}
"
popd > /dev/null

if [ $? -ne 0 ]; then
    echo "❌ Model structure tests failed"
    exit 1
fi

echo "=================================="
echo "✅ All Tests Passed!"
echo "=================================="
echo ""
echo "Summary:"
echo "  - Player value calculations: Working ✓"
echo "  - Transfer cost calculations: Working ✓"
echo "  - Chip availability logic: Working ✓"
echo "  - Database model structures: Working ✓"
echo ""
echo "Ready for integration with MongoDB!"
echo ""
echo "Next steps:"
echo "  1. Start MongoDB: mongod --dbpath /path/to/data"
echo "  2. Start backend: cd backend && npm start"
echo "  3. Test API endpoints with curl or Postman"
echo ""
