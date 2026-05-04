#!/bin/bash
# Quick Fix Script for YEEKEE_VIP Rounds

echo "=== YEEKEE_VIP Rounds Diagnostic & Fix ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Docker
echo "Step 1: Checking Docker containers..."
if docker ps | grep -q "postgres"; then
    echo -e "${GREEN}✓ PostgreSQL container is running${NC}"
else
    echo -e "${RED}✗ PostgreSQL container is NOT running${NC}"
    echo "Starting containers..."
    cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws
    docker-compose up -d
    sleep 5
fi
echo ""

# Step 2: Check Category
echo "Step 2: Checking YEEKEE_VIP category..."
CATEGORY_CHECK=$(docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -t -c "SELECT id, is_active FROM lotto_categories WHERE code = 'YEEKEE_VIP';")
if [ -z "$CATEGORY_CHECK" ]; then
    echo -e "${RED}✗ YEEKEE_VIP category does NOT exist${NC}"
    echo "Please create the category first!"
    exit 1
else
    echo -e "${GREEN}✓ YEEKEE_VIP category exists${NC}"
    echo "   $CATEGORY_CHECK"
fi
echo ""

# Step 3: Check Rounds
echo "Step 3: Checking rounds for today..."
TODAY=$(date +%Y-%m-%d)
ROUNDS_COUNT=$(docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -t -c "SELECT COUNT(*) FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = '$TODAY';")
ROUNDS_COUNT=$(echo $ROUNDS_COUNT | tr -d ' ')

if [ "$ROUNDS_COUNT" -eq 0 ]; then
    echo -e "${RED}✗ No rounds found for $TODAY${NC}"
    echo "Generating 88 rounds..."
    docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT generate_yeekee_rounds('$TODAY'::DATE);" > /dev/null
    
    # Verify
    NEW_COUNT=$(docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -t -c "SELECT COUNT(*) FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = '$TODAY';")
    NEW_COUNT=$(echo $NEW_COUNT | tr -d ' ')
    echo -e "${GREEN}✓ Generated $NEW_COUNT rounds${NC}"
else
    echo -e "${GREEN}✓ Found $ROUNDS_COUNT rounds for $TODAY${NC}"
fi
echo ""

# Step 4: Check Sample Data
echo "Step 4: Sample round data..."
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT round_no, name_th, status, is_active, TO_CHAR(open_at, 'HH24:MI') as open, TO_CHAR(close_at, 'HH24:MI') as close FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = '$TODAY' ORDER BY round_no LIMIT 5;"
echo ""

# Step 5: Check Round Config
echo "Step 5: Round configuration..."
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT rounds_per_day, round_interval_minutes, betting_duration_minutes, is_active FROM lotto_category_round_config WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP');"
echo ""

# Step 6: Status Summary
echo "=== Status Summary ==="
OPEN_COUNT=$(docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -t -c "SELECT COUNT(*) FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = '$TODAY' AND status = 'OPEN';")
CLOSED_COUNT=$(docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -t -c "SELECT COUNT(*) FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = '$TODAY' AND status = 'CLOSED';")
PENDING_COUNT=$(docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -t -c "SELECT COUNT(*) FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = '$TODAY' AND status = 'PENDING';")

echo "Total Rounds: $ROUNDS_COUNT"
echo "Open:         $(echo $OPEN_COUNT | tr -d ' ')"
echo "Closed:       $(echo $CLOSED_COUNT | tr -d ' ')"
echo "Pending:      $(echo $PENDING_COUNT | tr -d ' ')"
echo ""

# Step 7: Test GraphQL Query
echo "Step 7: Testing GraphQL query..."
echo "Query: yeeKeeRounds(date: \"$TODAY\")"
echo ""
echo "Run this in your browser console or test the API:"
echo "  Navigate to: http://localhost:3000/play/YEEKEE_VIP/rounds"
echo "  Open DevTools Console"
echo "  Look for [yeeKeeRounds] and [YeeKee Rounds] logs"
echo ""

echo -e "${GREEN}=== Diagnostic Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws/apps/lotto"
echo "  2. npm run dev"
echo "  3. Open http://localhost:3000/play/YEEKEE_VIP/rounds"
echo "  4. Check browser console for detailed logs"
echo ""
