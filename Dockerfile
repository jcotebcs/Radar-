FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create app directory and user
WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S radar -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Change ownership of the app directory
RUN chown -R radar:nodejs /app

# Switch to non-root user
USER radar

# Expose port
EXPOSE 8080

# Set environment variable for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "server.js"]