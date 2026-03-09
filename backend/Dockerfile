FROM node:20-alpine

WORKDIR /usr/src/app

# Ajuda muito em VPS com DNS/IPv6 instável
ENV NODE_OPTIONS=--dns-result-order=ipv4first
RUN npm config set prefer-online true \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set registry https://registry.npmjs.org/

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002

CMD ["node", "src/server.js"]