FROM node:22.16-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
RUN apk update && apk add python3 make g++
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .
EXPOSE 6000
CMD [ "node", "index.js" ]