FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package management files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy remaining source code
COPY . .

# Set default production environment
ENV NODE_ENV=production
ENV PORT=5001

# Expose port
EXPOSE 5001

# Start signaling server
CMD ["node", "server.js"]
