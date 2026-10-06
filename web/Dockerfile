FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ARG VITE_APP_ENV=staging
ARG VITE_RELEASE=local
ARG VITE_SENTRY_DSN
ARG VITE_GOOGLE_ANALYTICS_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_RELEASE=$VITE_RELEASE
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_GOOGLE_ANALYTICS_ID=$VITE_GOOGLE_ANALYTICS_ID
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/health/live || exit 1
