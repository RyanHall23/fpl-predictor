# Purchase/Current/Selling Price Display - Feature Documentation

## Overview

This feature displays purchase price, current market price, and selling price for players in the recommended transfers view. This helps users understand the financial implications of transfers.

## Implementation

### Backend Changes

**File:** `backend/controllers/fplController.js`

**Changes Made:**
1. Added imports for User and Squad models
2. Modified `getRecommendedTransfers` function to:
   - Fetch user by entryId (teamid field in User model)
   - Load user's squad from database
   - Create purchasePriceMap for quick lookup
   - Calculate selling price for each playerOut using FPL rules

**Selling Price Calculation:**
```javascript
const profit = currentPrice - purchasePrice;
const profitToKeep = profit > 0 ? Math.floor(profit / 2) : 0;
const sellingPrice = purchasePrice + profitToKeep;
```

**API Response Format:**
```json
{
  "playerOut": {
    "id": 21,
    "web_name": "Gabriel",
    "now_cost": 75,
    "purchase_price": 65,
    "selling_price": 70,
    "predicted_points": 5.2
  }
}
```

### Frontend Changes

**File:** `frontend/src/components/RecommendedTransfers/RecommendedTransfers.js`

**Changes Made:**
1. Enhanced playerOut display to show three price fields when available
2. Added color-coded profit/loss indicators
3. Fallback to simple current price when squad data unavailable

**Display Logic:**
- **Bought:** Shows original purchase price
- **Current:** Shows current market value
- **Sell:** Shows selling price with profit/loss
  - Green text and amount for profit
  - Red text and amount for loss

## FPL Pricing Rules

### Price Changes
- Player prices rise/fall based on transfer market activity
- Prices don't change until season starts
- Changes happen multiple times per week during season

### Profit Calculation
When selling a player:
- If price increased: Keep 50% of profit (rounded down to £0.1m)
- If price decreased: Sell at current (lower) price

**Examples:**

| Purchase | Current | Profit | Keep | Sell Price |
|----------|---------|--------|------|------------|
| £7.5m    | £7.8m   | £0.3m  | £0.1m| £7.6m      |
| £8.0m    | £7.5m   | -£0.5m | £0   | £7.5m      |
| £10.0m   | £10.0m  | £0     | £0   | £10.0m     |
| £6.5m    | £7.2m   | £0.7m  | £0.3m| £6.8m      |

## Usage

### Prerequisites
1. User must have initialized their squad in the database
2. Squad must contain purchase price data for players

### Display Behavior

**With Squad Data:**
```
Player Name
5.2 pts
Bought: £6.5m
Current: £7.2m
Sell: £6.8m (+£0.3m)
```

**Without Squad Data:**
```
Player Name
5.2 pts
£7.2m
```

## Testing

### Manual Testing

1. **Initialize a squad:**
   ```bash
   POST /api/squad/initialize
   {
     "userId": "user_mongo_id",
     "entryId": 123456,
     "gameweek": 1
   }
   ```

2. **View recommended transfers:**
   ```bash
   GET /api/entry/123456/event/1/recommended-transfers
   ```

3. **Check response includes:**
   - `purchase_price` field on playerOut
   - `selling_price` field on playerOut
   - Correct calculations

### Calculation Tests

```javascript
// Test case 1: Price increase
purchasePrice = 75  // £7.5m
currentPrice = 78   // £7.8m
expectedSell = 76   // £7.6m (kept £0.1m profit)

// Test case 2: Price decrease
purchasePrice = 80  // £8.0m
currentPrice = 75   // £7.5m
expectedSell = 75   // £7.5m (no profit to keep)
```

## Future Enhancements

1. **Price History Chart:** Show price change over time using element-summary API
2. **Profit Indicators:** Visual badges for "Rising" or "Falling" price
3. **Best Value Suggestions:** Highlight players with good price momentum
4. **Transfer Budget Calculator:** Show remaining budget after proposed transfers
5. **Historical Purchase Records:** Track all historical purchase prices

## API Integration

The feature uses the element-summary endpoint for future enhancements:

```
GET /api/element-summary/:playerId
```

Response includes:
- `history[]` - Past gameweek performance with value field
- `fixtures[]` - Upcoming fixtures

The `value` field in history shows price at that gameweek (in £0.1m units).

## Notes

- Prices are stored in units of £0.1m (e.g., 75 = £7.5m)
- All price calculations round down to nearest £0.1m
- Purchase prices are only available for players in initialized squads
- Fallback to current price display if squad not found
- Profit calculation follows official FPL rules exactly

## Dependencies

- User model (`teamid` field links to FPL entryId)
- Squad model (stores purchase prices)
- MongoDB connection (for squad data persistence)

## Error Handling

If squad data is unavailable:
- Logs: "Squad data not found, showing current prices only"
- Falls back to displaying only current price
- No error shown to user
- Recommendations still work normally
