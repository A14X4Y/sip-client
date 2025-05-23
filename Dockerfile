# 1. Установка всех зависимостей (включая dev)
FROM node:18-alpine as deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# 2. Сборка приложения
FROM node:18-alpine as builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Production-слой — запускаем только собранное приложение
FROM node:18-alpine as production
WORKDIR /app

# Копируем только нужные файлы
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

# Порт, который слушает next start
EXPOSE 3000

# Запуск
CMD ["npx", "next", "start"]
