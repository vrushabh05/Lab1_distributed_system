FROM node:20-alpine

# -----------------------------------------------------------------------------
# Shared core (installed once and reused by all services)
# -----------------------------------------------------------------------------
WORKDIR /app/services/shared
COPY services/shared/package*.json ./
RUN npm install --production
COPY services/shared ./

# -----------------------------------------------------------------------------
# Owner service
# -----------------------------------------------------------------------------
WORKDIR /app/services/owner-service
COPY services/owner-service/package*.json ./
RUN npm install --production
COPY services/owner-service/src ./src

EXPOSE 3002

CMD ["npm", "start"]
