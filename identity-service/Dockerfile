# use the official node.js 18 image with alpine linux as the base image

FROM node:22-alpine

WORKDIR /use/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "src/server.js"]