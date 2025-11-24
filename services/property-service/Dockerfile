FROM node:20-alpine

# -----------------------------------------------------------------------------
# Shared core (installed once and reused by all services)
# -----------------------------------------------------------------------------
WORKDIR /app/services/shared
COPY services/shared/package*.json ./
RUN npm install --production
COPY services/shared ./

# -----------------------------------------------------------------------------
# Property service
# -----------------------------------------------------------------------------
WORKDIR /app/services/property-service
COPY services/property-service/package*.json ./
RUN npm install --production
COPY services/property-service/src ./src

EXPOSE 3003

CMD ["npm", "start"]
