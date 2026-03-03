# Change from node:18 to node:20
FROM node:20-alpine 

WORKDIR /app
COPY package*.json ./
# RUN npm install
RUN npm install && npm cache clean --force
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]