FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production EDUMAP_READONLY=1 EDUMAP_DB=/tmp/edumap.db
EXPOSE 3000
CMD ["npx", "tsx", "server/index.ts"]
