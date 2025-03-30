FROM node:20

# Install build essentials and Python
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory and set permissions
RUN mkdir -p /workspace/app && chown -R node:node /workspace

# Install pnpm
RUN npm install -g pnpm

# Set pnpm store directory and permissions
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN mkdir -p /pnpm/store && chown -R node:node /pnpm

# Switch to non-root user
USER node
WORKDIR /workspace

# Configure pnpm
RUN pnpm config set store-dir /pnpm/store

# Expose application port
EXPOSE 3001

# The command will be overridden by docker-compose.yml
CMD ["sh", "-c", "cd /workspace/app && rm -rf node_modules && pnpm install && pnpm run dev"] 