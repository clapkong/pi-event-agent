# 백엔드 이미지 — pi --mode rpc 서브프로세스 + Fastify(WS/REST) 브리지.
# 빌드 컨텍스트는 레포 루트(.). pi 의 "뇌"(.pi·AGENTS.md·CLAUDE.md)가 cwd=/app 에서 읽혀야 하므로
# 레포 루트를 통째로 /app 에 굽는다.
#
# node:24-bookworm(full) — pi-local-rag 의 네이티브 SQLite 를 컨테이너 안에서 빌드하기 위해
# build tools/git 가 포함된 풀 이미지를 쓴다(slim 은 네이티브 빌드 도구가 없음).
FROM node:24-bookworm

# pi CLI 전역 설치 (호스트와 동일 버전 고정 — Pi 는 컷오프 이후 도구라 버전 고정이 안전)
RUN npm install -g @earendil-works/pi-coding-agent@0.79.8

WORKDIR /app

# 1) 백엔드 의존성만 먼저 (소스보다 덜 바뀜 → 레이어 캐시)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# 2) Pi 설정·확장·skill·agents 복원 후, 확장 4개를 컨테이너 안에서 설치.
#    .dockerignore 가 .pi/npm(호스트 darwin 바이너리)·.pi/rag 를 제외하므로 여기서 linux native 로 새로 깐다.
#    ⚠️ 버전 고정 필수 — 최신 pi-web-access 는 pi 0.79.8 번들 pi-ai 에 없는 서브패스를 import 해 로드 실패한다.
#    호스트에서 검증된 작동 버전으로 핀(host .pi/npm 기준).
COPY .pi ./.pi
RUN pi install npm:@tintinweb/pi-subagents@0.10.3 -l -a \
 && pi install npm:pi-mcp-adapter@2.10.0 -l -a \
 && pi install npm:pi-web-access@0.10.7 -l -a \
 && pi install npm:pi-local-rag@0.4.1 -l -a

# 3) 앱 본체 + pi 컨텍스트 + 데이터(없으면 compose 가 볼륨으로 덮음)
COPY AGENTS.md CLAUDE.md ./
COPY backend ./backend
COPY data ./data

# pi 가 쓰는 HOME — mcp.json 의 ${HOME}, 세션·MCP 캐시 기준. OAuth 는 compose 볼륨으로 마운트.
ENV HOME=/home/app
RUN mkdir -p /home/app/.gmail-mcp /home/app/.config /home/app/.pi/agent

ENV PORT=8787
EXPOSE 8787

# REPO_ROOT = backend/../.. = /app. server 는 여기서 pi 를 cwd=/app 으로 띄운다.
WORKDIR /app/backend
CMD ["npm", "start"]
