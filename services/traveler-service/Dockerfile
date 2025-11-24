FROM node:20-alpine

# -----------------------------------------------------------------------------
# Shared core (installed once and reused by all services)
# -----------------------------------------------------------------------------
WORKDIR /app/services/shared
COPY services/shared/package*.json ./
RUN npm install --production
COPY services/shared ./

# -----------------------------------------------------------------------------
# Traveler service
# -----------------------------------------------------------------------------
WORKDIR /app/services/traveler-service
COPY services/traveler-service/package*.json ./
RUN npm install --production
COPY services/traveler-service/src ./src

EXPOSE 3001

CMD ["npm", "start"]
