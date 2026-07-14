# Step 1: Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package management files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Environment build-args for Vite compilation
ARG VITE_API_URL
ARG VITE_SIGNALING_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SIGNALING_URL=$VITE_SIGNALING_URL

# Compile static assets
RUN npm run build

# Step 2: Serve stage
FROM nginx:stable-alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
