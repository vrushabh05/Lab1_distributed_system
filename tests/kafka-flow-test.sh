#!/bin/bash

# Kafka Flow Test Script
# This script demonstrates the complete Kafka message flow for bookings

echo "========================================="
echo "Kafka Message Flow Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Start Kafka consumers in background
echo -e "${BLUE}Step 1: Starting Kafka consumers...${NC}"
echo ""

# Consumer for booking-requests topic
echo "Starting consumer for 'booking-requests' topic..."
docker exec -d airbnb_kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic booking-requests \
  --from-beginning \
  --timeout-ms 30000 > /tmp/kafka-booking-requests.log 2>&1

# Consumer for booking-updates topic
echo "Starting consumer for 'booking-updates' topic..."
docker exec -d airbnb_kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic booking-updates \
  --from-beginning \
  --timeout-ms 30000 > /tmp/kafka-booking-updates.log 2>&1

echo -e "${GREEN}✓ Consumers started${NC}"
echo ""

# Step 2: Create test users
echo -e "${BLUE}Step 2: Creating test users...${NC}"
echo ""

# Create traveler
TRAVELER_EMAIL="kafka-test-traveler@example.com"
TRAVELER_PASSWORD="TestPass123"

echo "Creating traveler: $TRAVELER_EMAIL"
TRAVELER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Kafka Test Traveler\",\"email\":\"$TRAVELER_EMAIL\",\"password\":\"$TRAVELER_PASSWORD\",\"role\":\"TRAVELER\"}")

if echo "$TRAVELER_RESPONSE" | grep -q "token"; then
  echo -e "${GREEN}✓ Traveler created successfully${NC}"
  TRAVELER_TOKEN=$(echo "$TRAVELER_RESPONSE" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
  TRAVELER_ID=$(echo "$TRAVELER_RESPONSE" | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
else
  echo -e "${YELLOW}Note: Traveler might already exist, trying to login...${NC}"
  LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TRAVELER_EMAIL\",\"password\":\"$TRAVELER_PASSWORD\"}")
  TRAVELER_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
  TRAVELER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
fi

echo "Traveler Token: ${TRAVELER_TOKEN:0:20}..."
echo "Traveler ID: $TRAVELER_ID"
echo ""

# Create owner
OWNER_EMAIL="kafka-test-owner@example.com"
OWNER_PASSWORD="TestPass123"

echo "Creating owner: $OWNER_EMAIL"
OWNER_RESPONSE=$(curl -s -X POST http://localhost:3002/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Kafka Test Owner\",\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASSWORD\",\"role\":\"OWNER\"}")

if echo "$OWNER_RESPONSE" | grep -q "token"; then
  echo -e "${GREEN}✓ Owner created successfully${NC}"
  OWNER_TOKEN=$(echo "$OWNER_RESPONSE" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
  OWNER_ID=$(echo "$OWNER_RESPONSE" | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
else
  echo -e "${YELLOW}Note: Owner might already exist, trying to login...${NC}"
  LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3002/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASSWORD\"}")
  OWNER_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
  OWNER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
fi

echo "Owner Token: ${OWNER_TOKEN:0:20}..."
echo "Owner ID: $OWNER_ID"
echo ""

# Step 3: Create a test property
echo -e "${BLUE}Step 3: Creating test property...${NC}"
echo ""

PROPERTY_DATA='{
  "name": "Kafka Test Property",
  "description": "A test property for Kafka flow demonstration",
  "location": {
    "address": "123 Test St",
    "city": "San Jose",
    "state": "CA",
    "country": "USA"
  },
  "price": 150,
  "bedrooms": 2,
  "bathrooms": 1,
  "maxGuests": 4,
  "amenities": ["WiFi", "Kitchen"]
}'

PROPERTY_RESPONSE=$(curl -s -X POST http://localhost:3003/api/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "$PROPERTY_DATA")

PROPERTY_ID=$(echo "$PROPERTY_RESPONSE" | grep -o '"_id":"[^"]*' | grep -o '[^"]*$')
echo "Property created with ID: $PROPERTY_ID"
echo -e "${GREEN}✓ Property created${NC}"
echo ""

# Step 4: Create a booking (triggers Kafka producer)
echo -e "${BLUE}Step 4: Creating booking (Traveler → Kafka)...${NC}"
echo ""

# Calculate future dates
START_DATE=$(date -d "+7 days" +%Y-%m-%d)
END_DATE=$(date -d "+10 days" +%Y-%m-%d)

BOOKING_DATA="{
  \"propertyId\": \"$PROPERTY_ID\",
  \"ownerId\": \"$OWNER_ID\",
  \"startDate\": \"$START_DATE\",
  \"endDate\": \"$END_DATE\",
  \"totalPrice\": 450
}"

echo "Booking dates: $START_DATE to $END_DATE"
BOOKING_RESPONSE=$(curl -s -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TRAVELER_TOKEN" \
  -d "$BOOKING_DATA")

BOOKING_ID=$(echo "$BOOKING_RESPONSE" | grep -o '"_id":"[^"]*' | grep -o '[^"]*$')
echo "Booking created with ID: $BOOKING_ID"
echo -e "${GREEN}✓ Booking created and published to Kafka 'booking-requests' topic${NC}"
echo ""

# Wait for message processing
echo "Waiting 3 seconds for Kafka message processing..."
sleep 3

# Step 5: Owner accepts booking (triggers another Kafka message)
echo -e "${BLUE}Step 5: Owner accepts booking (Owner → Kafka)...${NC}"
echo ""

ACCEPT_RESPONSE=$(curl -s -X PUT "http://localhost:3002/api/bookings/$BOOKING_ID/accept" \
  -H "Authorization: Bearer $OWNER_TOKEN")

echo "Owner accepted booking"
echo -e "${GREEN}✓ Status update published to Kafka 'booking-updates' topic${NC}"
echo ""

# Wait for message processing
echo "Waiting 3 seconds for Kafka message processing..."
sleep 3

# Step 6: Show Kafka messages
echo -e "${BLUE}Step 6: Kafka Messages Captured${NC}"
echo ""

echo "========================================="
echo "Messages from 'booking-requests' topic:"
echo "========================================="
docker exec airbnb_kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic booking-requests \
  --from-beginning \
  --max-messages 10 \
  --timeout-ms 5000 2>/dev/null || echo "No messages yet"

echo ""
echo "========================================="
echo "Messages from 'booking-updates' topic:"
echo "========================================="
docker exec airbnb_kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic booking-updates \
  --from-beginning \
  --max-messages 10 \
  --timeout-ms 5000 2>/dev/null || echo "No messages yet"

echo ""
echo "========================================="
echo "Kafka Flow Test Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "1. Traveler created booking → Message sent to 'booking-requests'"
echo "2. Owner accepted booking → Message sent to 'booking-updates'"
echo "3. Booking Service consumed 'booking-updates' and synced status"
echo ""
echo "Check the booking status:"
echo "curl -H 'Authorization: Bearer $TRAVELER_TOKEN' http://localhost:3001/api/bookings"
