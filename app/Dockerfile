FROM node:20

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies (this will create pnpm-lock.yaml if it doesn't exist)
RUN pnpm install

# Copy all source files (dockerignore will exclude node_modules etc)
COPY . .

# Ensure proper permissions
RUN chown -R node:node /app
USER node

# Expose dev port
EXPOSE 3001

# Start dev server with host set to 0.0.0.0
ENV VITE_HOST=0.0.0.0
ENV VITE_PORT=3001

# Start dev server
CMD ["pnpm", "run", "dev"] 