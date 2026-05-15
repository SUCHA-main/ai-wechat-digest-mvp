FROM node:24-alpine

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3090

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/src ./src
COPY backend/data ./data
COPY frontend ../frontend

EXPOSE 3090

CMD ["npm", "start"]
