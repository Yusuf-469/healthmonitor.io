# Use Node.js LTS
FROM node:22-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies without Prisma
RUN npm ci --only=production --no-audit --no-fund || npm install --production --no-audit --no-fund

# Copy application code
COPY . .

# Expose port
EXPOSE $PORT

# Start the application
CMD ["node", "backend/server.js"]
