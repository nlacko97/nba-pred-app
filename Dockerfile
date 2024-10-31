FROM node:23-alpine AS build_box

WORKDIR /app
COPY package*.json ./
RUN NODE_ENV=dev npm install
COPY . /app
RUN npm run build

# Make final image
FROM node:23-alpine

WORKDIR /app
COPY src/main.js ./
COPY package*.json ./
COPY --from=build_box /app/dist ./dist
RUN npm install --production

EXPOSE 80
CMD [ "npm", "dev" ]