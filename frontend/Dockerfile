# 프런트 이미지 — Vite 정적 빌드 후 nginx 로 서빙.
# 브라우저가 직접 백엔드(localhost:8787)로 붙으므로(프런트 config 의 API_BASE/WS_URL 기본값) 프록시 불필요.
# 다른 호스트에 올릴 땐 빌드 시 VITE_API_BASE/VITE_WS_URL 을 넘긴다(기본은 127.0.0.1:8787).
FROM node:24-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
