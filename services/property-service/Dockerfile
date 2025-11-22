FROM node:20-alpine

WORKDIR /app

# Copy shared core libraries and install dependencies
COPY services/shared ./shared
WORKDIR /app/shared
RUN npm install --production

# Copy service package files
WORKDIR /app
COPY services/property-service/package*.json ./
RUN npm install --production

# Copy service source code
COPY services/property-service/src ./src

EXPOSE 3003

CMD ["npm", "start"]
