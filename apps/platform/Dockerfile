# --------------> The compiler image
FROM node:22 AS compile
WORKDIR /usr/src/app
RUN corepack enable
COPY . .
WORKDIR /usr/src/app/apps/platform
RUN pnpm install --frozen-lockfile
RUN pnpm build

# --------------> The build image
FROM node:22 AS build
WORKDIR /usr/src/app
RUN corepack enable
COPY --from=compile /usr/src/app/apps/platform/package*.json ./
COPY --from=compile /usr/src/app/apps/platform/build ./build
COPY --from=compile /usr/src/app/apps/platform/db ./db
COPY --from=compile /usr/src/app/apps/platform/public ./public 
RUN pnpm install -r --config.platform=linux --config.architecture=x64

# --------------> The production image
FROM node:22-alpine
RUN apk add dumb-init
ENV NODE_ENV="production"
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=build /usr/src/app ./
EXPOSE 3001
CMD ["dumb-init", "node", "build/boot.js"]
