# ---------- Builder ----------
  FROM node:20-alpine AS builder
  WORKDIR /app
  
  # Install server deps (include dev if any build tools exist)
  COPY package.json package-lock.json* ./
  RUN npm ci || npm i
  
  # Copy source
  COPY . .
  
  # Build client (needs devDependencies like vite)
  WORKDIR /app/client
  RUN npm ci --include=dev || npm i
  RUN npm run build
  
  # Clean up client dev deps to shrink final image
  RUN rm -rf /app/client/node_modules
  
  # Prune server to production-only
  WORKDIR /app
  RUN npm prune --production || true
  
  # ---------- Runtime ----------
  FROM node:20-alpine
  ENV NODE_ENV=production \
      PORT=3000
  WORKDIR /app
  
  # Copy built app from builder
  COPY --from=builder /app ./
  
  EXPOSE 3000
  
  # Simple healthcheck that hits the API using the admin key
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT||3000) + '/api/voice', {headers:{'x-admin-key':process.env.ADMIN_SHARED_SECRET||'change-me'}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  
  CMD ["npm", "start"]
  