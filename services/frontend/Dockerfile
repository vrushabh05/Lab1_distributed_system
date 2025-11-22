FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY services/frontend/package*.json ./
RUN npm install

# Copy service source code
COPY services/frontend/src ./src
COPY services/frontend/index.html ./
COPY services/frontend/nginx.conf ./
COPY services/frontend/postcss.config.js ./
COPY services/frontend/tailwind.config.js ./
COPY services/frontend/vite.config.js ./


EXPOSE 5173
CMD ["npm","run","dev","--","--host"]
