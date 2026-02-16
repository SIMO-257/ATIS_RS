FROM node:20-slim

WORKDIR /app

COPY package*.json ./
# RUN npm install --omit=dev --no-audit
RUN npm install --omit=dev --no-audit && npm cache clean --force
COPY . .

EXPOSE 5000
CMD ["node", "app.js"]
