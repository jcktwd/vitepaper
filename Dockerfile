FROM node:24-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@latest

# Copy package manifests first for layer caching
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy project source
COPY . .

# Create directories for synced posts and cached attachments
RUN mkdir -p content/posts content/public/attachments

# Build initial static bundle (will re-sync on container startup or webhook)
RUN pnpm docs:build

EXPOSE 3000

# Sync from Outline on startup (if OUTLINE_API_KEY is provided), rebuild, and start the webhook + static server
CMD ["sh", "-c", "if [ -n \"$OUTLINE_API_KEY\" ]; then pnpm sync && pnpm docs:build; fi && pnpm serve"]
