FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies  
RUN npm install --only=production

# Copy application code
COPY . .

# Expose port for Cloud Run
EXPOSE 8080

# Cloud Run sets PORT environment variable
ENV PORT=8080

# Start the application
CMD ["node", "server.js"]
