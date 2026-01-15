# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
# ADDED: cmake, git, and other build tools for raknet-native
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    node-gyp \
    pkg-config \
    python-is-python3 \
    cmake \
    git \
    g++ \
    make \
    python3 \
    curl \
    ca-certificates

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --verbose

# Copy application code
COPY . .

# RUN npm run build if you have a build step
# RUN npm run build


# Final stage for app image
FROM base

# Install ONLY runtime dependencies (no build tools)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=build /app /app

# DO NOT EXPOSE 3000 - Your bot doesn't need HTTP
# Start the bot directly
CMD [ "npm", "start" ]