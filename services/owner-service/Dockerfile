FROM node:20-alpine

WORKDIR /app

# Copy shared core libraries and install dependencies
COPY services/shared ./shared
WORKDIR /app/shared
RUN npm install --production

# Copy service package files
WORKDIR /app
COPY services/owner-service/package*.json ./
RUN npm install --production

# Copy service source code
COPY services/owner-service/src ./src

EXPOSE 3002

CMD ["npm", "start"]
