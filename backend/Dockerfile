# Base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy dependency configuration
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project source files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built app and dependencies
COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Expose API port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
