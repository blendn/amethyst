FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/protocol/package.json packages/protocol/package.json
RUN npm ci
COPY packages/protocol packages/protocol
COPY apps/api apps/api
RUN npm run build -w @amethyst/protocol && npm run build -w @amethyst/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/protocol packages/protocol
COPY --from=build /app/apps/api/dist apps/api/dist
COPY database database
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

