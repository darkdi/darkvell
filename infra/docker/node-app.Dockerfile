FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY client/package.json client/package.json
COPY game-server/package.json game-server/package.json
COPY auth-server/package.json auth-server/package.json
COPY blockchain-service/package.json blockchain-service/package.json
COPY admin-panel/package.json admin-panel/package.json
RUN npm install

FROM deps AS build
ARG APP
WORKDIR /app
COPY . .
RUN npm run build -w @mmo/shared
RUN npm run build -w ${APP}

FROM node:20-alpine AS runtime
ARG APP
ENV APP=${APP}
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
CMD ["sh", "-c", "npm run start -w ${APP}"]
