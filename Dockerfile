FROM node:20-alpine

# Install build dependencies for node-libcurl
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl-dev \
    libcurl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY src ./src

# Remove the cookies symlink if it exists (will be mounted as volume)
RUN rm -rf /app/src/cookies && mkdir -p /app/src/cookies

# Build TypeScript
RUN npm run build

# Copy .env file to dist directory for runtime
RUN cp -r /app/src/.env.production /app/dist/.env 2>/dev/null || echo ".env.production will be loaded from volume"

# Create storage directory
RUN mkdir -p /app/storage

# Remove dev dependencies and TypeScript after build
RUN npm prune --production

# Set environment
ENV NODE_ENV=production
ENV TS_NODE_BASEURL=/app/dist

# Run the application
CMD ["npm", "start"]
