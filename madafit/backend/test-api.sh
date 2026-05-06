#!/bin/bash
# Test script for API Platform endpoints
# Run from the Backend directory

echo "🔍 Testing API Platform Endpoints..."
echo ""

# Get the base URL from environment or use default
API_URL="https://127.0.0.1:8000/api"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2

    echo -n "Testing $description... "

    # Using curl to test (ignore SSL certificate for localhost)
    response=$(curl -s -w "\n%{http_code}" -k -X GET "$API_URL$endpoint" \
        -H "Accept: application/ld+json" \
        -H "Content-Type: application/ld+json")

    # Extract status code (last line)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ OK (200)${NC}"
        echo "  Response preview: $(echo "$body" | head -c 100)..."
    elif [ "$http_code" = "401" ]; then
        echo -e "${YELLOW}⚠ Unauthorized (401)${NC}"
        echo "  Your endpoint exists but requires authentication"
    elif [ "$http_code" = "404" ]; then
        echo -e "${RED}✗ Not Found (404)${NC}"
        echo "  Endpoint does not exist. Check:"
        echo "    1. Is the API configured correctly?"
        echo "    2. Does the entity have #[ApiResource]?"
        echo "    3. Is the entity mapped with Doctrine?"
    else
        echo -e "${RED}✗ Error (HTTP $http_code)${NC}"
        echo "  Response: $body"
    fi
    echo ""
}

# Test all endpoints
echo "=== Testing API Platform Endpoints ==="
echo "Base URL: $API_URL"
echo ""

test_endpoint "/users" "Users endpoint"
test_endpoint "/products" "Products endpoint"
test_endpoint "/subscription_plans" "Subscription Plans endpoint"
test_endpoint "/payments" "Payments endpoint"
test_endpoint "/attendance_records" "Attendance Records endpoint"
test_endpoint "/notification" "Notifications endpoint"
test_endpoint "/transactions" "Transactions endpoint"
test_endpoint "/visit_records" "Visit Records endpoint"
test_endpoint "/daily_summary_rows" "Daily Summary Rows endpoint"

echo "=== API Documentation ==="
echo "📚 Access API docs at:"
echo "   $API_URL/docs"
echo ""
echo "📋 Access OpenAPI specification at:"
echo "   $API_URL/openapi.json"
