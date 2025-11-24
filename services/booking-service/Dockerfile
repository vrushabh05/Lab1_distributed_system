FROM node:20-alpine

# -----------------------------------------------------------------------------
# Shared core (installed once and reused by all services)
# -----------------------------------------------------------------------------
WORKDIR /app/services/shared
COPY services/shared/package*.json ./
RUN npm install --production
COPY services/shared ./

# -----------------------------------------------------------------------------
# Booking service
# -----------------------------------------------------------------------------
WORKDIR /app/services/booking-service
COPY services/booking-service/package*.json ./
RUN npm install --production
COPY services/booking-service/src ./src

EXPOSE 3004

CMD ["npm", "start"]
