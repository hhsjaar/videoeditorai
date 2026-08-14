# Base node image
FROM node:20-slim

# Install FFmpeg and ImageMagick for SVG/image rendering on Linux
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start Next.js server
CMD ["npm", "start"]
