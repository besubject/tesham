FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install dependencies
RUN npm install

# Copy source code
COPY backend ./backend
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Build TypeScript (optional for dev, required for prod)
# RUN npm run build --workspace=backend

EXPOSE 3000

WORKDIR /app/backend

CMD ["npm", "run", "dev"]
