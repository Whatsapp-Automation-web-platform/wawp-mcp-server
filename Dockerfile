# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Final stage
FROM node:20-slim

WORKDIR /app

# Copy built files and node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Ensure entrypoint is executable
RUN chmod +x dist/index.js

# Command to run the MCP server
ENTRYPOINT ["node", "dist/index.js"]
