# Price Display Fallback Mechanism

## Overview

The purchase/selling/current price feature now works **without requiring squad initialization** in the database. This document explains the multi-tier fallback system that ensures price data is always available.

## Problem Statement

Previously, the price display feature required:
1. User to be registered in MongoDB (`User` model)
2. Squad to be initialized (`Squad` model)
3. Squad history to exist (`SquadHistory` model)

Without these, users only saw the current price, not the full breakdown of purchase/sell/current prices.

## Solution: Three-Tier Fallback System

### Tier 1: Database (Most Accurate) ✅

**Source:** MongoDB Squad and SquadHistory models

**When Used:** User has initialized their squad via `POST /api/squad/initialize`

**Accuracy:** ⭐⭐⭐⭐⭐ (Exact)

**How It Works:**
1. Query `User` model by `teamid` (FPL entry ID)
2. Query `Squad` model for user's current squad
3. Query `SquadHistory` to find most recent purchase for each player
4. Handle in/out/in scenarios correctly (e.g., bought GW1, sold GW5, rebought GW10 → uses GW10 price)

**Example:**
```javascript
// Player bought in GW1 at £4.5m, sold GW3, rebought GW8 at £4.8m
purchasePrice: 48  // Uses GW8 price (most recent addition)
currentPrice: 52   // Current market price
sellingPrice: 50   // £4.8m + £0.2m profit/2 = £5.0m
```

### Tier 2: FPL API Estimation (Good) ✅ NEW!

**Source:** FPL's element-summary and history endpoints

**When Used:** Squad not initialized in database

**Accuracy:** ⭐⭐⭐⭐ (Estimated based on user's first gameweek)

**How It Works:**
1. Fetch user's history: `GET /api/entry/{entryId}/history/`
2. Identify first gameweek user was active
3. For each player in current team:
   - Fetch element-summary: `GET /api/element-summary/{playerId}/`
   - Find player's price in user's first gameweek
   - Use that as estimated purchase price
4. Calculate selling price using FPL rules

**Example:**
```javascript
// User started GW1, has Gabriel (element 21) in their team
// Gabriel's price history from element-summary:
// GW1: £4.5m, GW5: £4.7m, GW10: £5.0m, Current: £5.2m

// Since user started GW1, estimate purchase at GW1 price
purchasePrice: 45   // £4.5m (estimated from GW1)
currentPrice: 52    // £5.2m (current from last history entry)
sellingPrice: 48    // £4.5m + (£5.2m - £4.5m)/2 = £4.8m
```

**Limitations:**
- Doesn't account for actual transfers (assumes player owned since start)
- May overestimate profit if player was added later
- Still reasonable estimate for most users

### Tier 3: Current Price Only (Fallback) ✅

**Source:** Bootstrap-static current prices

**When Used:** FPL API unavailable or errors occur

**Accuracy:** N/A (No purchase/sell data)

**How It Works:**
- Display only current market price
- No purchase or selling price shown
- Graceful degradation

**Example:**
```
Gabriel
5.2 pts
£5.2m
```

## Implementation Details

### Backend Code Flow

```javascript
// In getRecommendedTransfers (fplController.js)

let purchasePriceMap = {};

try {
  // TIER 1: Try database first
  const user = await User.findOne({ teamid: entryId });
  if (user) {
    const squadData = await Squad.findOne({ userId: user._id });
    if (squadData) {
      // Use squad history for most accurate prices
      for (const player of squadData.players) {
        const historyData = await findMostRecentPurchasePrice(...);
        purchasePriceMap[player.playerId] = historyData;
      }
    }
  }
} catch (squadError) {
  // TIER 2: Fallback to FPL API estimation
  try {
    const userHistory = await dataProvider.fetchHistory(entryId);
    const firstGameweek = userHistory.current[0].event;
    
    for (const playerId of playerIds) {
      const elementSummary = await dataProvider.fetchElementSummary(playerId);
      const relevantHistory = elementSummary.history.filter(h => h.round >= firstGameweek);
      
      purchasePriceMap[playerId] = {
        purchasePrice: relevantHistory[0].value,
        currentPrice: elementSummary.history[elementSummary.history.length - 1].value
      };
    }
  } catch (historyError) {
    // TIER 3: Final fallback - no purchase prices
    console.warn('Could not estimate purchase prices');
  }
}

// Later when building response:
if (purchaseInfo) {
  playerOut.purchase_price = purchaseInfo.purchasePrice;
  playerOut.selling_price = calculateSellingPrice(...);
} else {
  // Will show current price only in UI
  playerOut.purchase_price = null;
  playerOut.selling_price = null;
}
```

### Frontend Display Logic

```javascript
// In RecommendedTransfers.js

{rec.playerOut.purchase_price != null ? (
  // Show full price breakdown
  <Typography>
    Current: £{(rec.playerOut.now_cost / 10).toFixed(1)}m | 
    Sell: £{(rec.playerOut.selling_price / 10).toFixed(1)}m | 
    Purchase: £{(rec.playerOut.purchase_price / 10).toFixed(1)}m
  </Typography>
) : (
  // Fallback: show current price only
  <Typography>
    £{(rec.playerOut.now_cost / 10).toFixed(1)}m
  </Typography>
)}
```

## FPL Pricing Rules

The selling price is calculated using official FPL rules:

```javascript
profit = currentPrice - purchasePrice
profitToKeep = profit > 0 ? Math.floor(profit / 2) : 0
sellingPrice = purchasePrice + profitToKeep
```

**Examples:**

| Purchase | Current | Profit | Keep | Selling | Notes |
|----------|---------|--------|------|---------|-------|
| £4.5m    | £5.0m   | £0.5m  | £0.2m| £4.7m   | Keep 50% of profit |
| £4.6m    | £5.2m   | £0.6m  | £0.3m| £4.9m   | Rounded down to £0.1m |
| £7.5m    | £7.8m   | £0.3m  | £0.1m| £7.6m   | Small profit |
| £8.0m    | £7.5m   | -£0.5m | £0   | £7.5m   | Loss - no profit kept |

## API Endpoints Used

### Database Tier
- MongoDB queries (no external API)
- Models: User, Squad, SquadHistory

### FPL API Tier
- `GET /api/entry/{entryId}/history/` - User's gameweek history
- `GET /api/element-summary/{playerId}/` - Player's price history

**Element Summary Response Structure:**
```json
{
  "history": [
    {
      "element": 21,
      "fixture": 9,
      "round": 1,
      "value": 65,  // Price in units (£6.5m)
      "total_points": 6,
      ...
    }
  ]
}
```

## Performance Considerations

### Tier 1 (Database)
- **API Calls:** 0 external
- **Database Queries:** 3 (User, Squad, SquadHistory)
- **Speed:** ⚡⚡⚡ Very Fast

### Tier 2 (FPL API)
- **API Calls:** 1 + N (where N = number of players, typically 15)
- **Database Queries:** 0
- **Speed:** ⚡⚡ Moderate (depends on FPL API response time)
- **Caching:** Results cached in purchasePriceMap for request duration

### Optimization
When Tier 2 is used, consider:
1. Caching element-summary responses (future enhancement)
2. Rate limiting to respect FPL API limits
3. Parallel fetching of player data (already implemented)

## User Experience

### Before (Without Fallback)
```
Gabriel
5.2 pts
£5.2m
```
❌ No indication of purchase price or potential profit/loss

### After (With Fallback)
```
Gabriel
5.2 pts
Current: £5.2m | Sell: £4.9m | Purchase: £4.6m
```
✅ Full price breakdown visible immediately
✅ Color-coded profit (green) or loss (red)
✅ Works without database initialization

## Testing

### Test Tier 1 (Database)
```bash
# Initialize squad first
POST /api/squad/initialize
{
  "userId": "user123",
  "entryId": 123456,
  "gameweek": 1
}

# Then fetch recommendations
GET /api/entry/123456/event/1/recommended-transfers?gameweeksAhead=1
```

### Test Tier 2 (FPL API Fallback)
```bash
# Without initializing squad
GET /api/entry/123456/event/1/recommended-transfers?gameweeksAhead=1

# Check logs for:
# "Squad data not found for entryId 123456 - attempting to estimate purchase prices"
# "Estimated purchase prices for 15 players from FPL API"
```

### Test Tier 3 (Final Fallback)
```bash
# With USE_FPL_API=false and no squad data
USE_FPL_API=false node server.js

GET /api/entry/123456/event/1/recommended-transfers?gameweeksAhead=1

# Should show current prices only
```

## Troubleshooting

### Prices Not Showing

**Symptom:** Only seeing current price, not full breakdown

**Possible Causes:**
1. ✅ FPL API rate limiting → Wait and retry
2. ✅ Invalid entry ID → Check entryId is correct
3. ✅ Network issues → Check internet connection
4. ✅ Mock mode enabled → Set `USE_FPL_API=true`

**Solution:** Check backend logs for specific error messages

### Incorrect Purchase Prices (Tier 2)

**Symptom:** Purchase price seems wrong with FPL API fallback

**Explanation:** 
- Tier 2 estimates based on user's first gameweek
- Doesn't account for actual transfer history
- For accurate prices, initialize squad in database (Tier 1)

**Solution:**
```bash
POST /api/squad/initialize
{
  "userId": "user123",
  "entryId": 123456,
  "gameweek": 1
}
```

## Future Enhancements

### Potential Improvements
1. **Transfer History Analysis** - Parse user's transfer history from FPL API
2. **Caching** - Cache element-summary responses for performance
3. **Batch Fetching** - Optimize multiple player lookups
4. **Background Sync** - Auto-initialize squads in background
5. **Price Change Alerts** - Notify users of significant price changes

### Transfer History Endpoint
FPL provides transfer history at:
```
GET /api/entry/{entryId}/transfers/
```

This could be used to get exact purchase prices without database, but requires additional API call and parsing.

## Conclusion

The three-tier fallback system ensures:
✅ Price data always available
✅ Best accuracy when possible
✅ Graceful degradation
✅ Works out of the box
✅ No breaking changes

Users can now see purchase, current, and selling prices immediately without any setup required!
