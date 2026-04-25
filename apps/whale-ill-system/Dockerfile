FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/whale-ill-system

COPY apps/whale-ill-system/package*.json ./
RUN npm ci

COPY apps/whale-ill-system ./

ARG WHALE_ILL_APP_NAME
ARG WHALE_ILL_PORT=3010
ARG WHALE_ILL_GRAPHQL_PATH=/api/graphql
ARG WHALE_ILL_NEXT_PUBLIC_BASE_URL
ARG WHALE_ILL_NEXT_PUBLIC_GRAPHQL_HTTP
ARG WHALE_ILL_NEXT_PUBLIC_GRAPHQL_WS

ENV WHALE_ILL_APP_NAME=$WHALE_ILL_APP_NAME
ENV PORT=$WHALE_ILL_PORT
ENV WHALE_ILL_GRAPHQL_PATH=$WHALE_ILL_GRAPHQL_PATH
ENV NEXT_PUBLIC_BASE_URL=$WHALE_ILL_NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_GRAPHQL_HTTP=$WHALE_ILL_NEXT_PUBLIC_GRAPHQL_HTTP
ENV NEXT_PUBLIC_GRAPHQL_WS=$WHALE_ILL_NEXT_PUBLIC_GRAPHQL_WS

RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app/apps/whale-ill-system

ENV NODE_ENV=production
ENV PORT=3010

COPY --from=builder /app/apps/whale-ill-system ./

EXPOSE 3010

CMD ["npm", "run", "start"]
