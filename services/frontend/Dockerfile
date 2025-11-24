FROM node:20-alpine AS builder

ARG VITE_TRAVELER_API_URL=http://localhost:7001
ARG VITE_OWNER_API_URL=http://localhost:7002
ARG VITE_PROPERTY_API_URL=http://localhost:7003
ARG VITE_AGENT_API_URL=http://localhost:7000

ENV VITE_TRAVELER_API_URL=${VITE_TRAVELER_API_URL} \
    VITE_OWNER_API_URL=${VITE_OWNER_API_URL} \
    VITE_PROPERTY_API_URL=${VITE_PROPERTY_API_URL} \
    VITE_AGENT_API_URL=${VITE_AGENT_API_URL}
WORKDIR /app

# Install dependencies
COPY services/frontend/package*.json ./
RUN npm install

# Copy application code and build for production
COPY services/frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

# Copy custom nginx config and build artifacts
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
