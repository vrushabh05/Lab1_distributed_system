FROM node:20-alpine

WORKDIR /app

# Copy shared core libraries and install dependencies
COPY services/shared ./shared
WORKDIR /app/shared
RUN npm install --production

# Copy service package files
WORKDIR /app
COPY services/traveler-service/package*.json ./
RUN npm install --production

# Copy service source code
COPY services/traveler-service/src ./src

EXPOSE 3001

CMD ["npm", "start"]
