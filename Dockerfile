FROM node:20.9

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY ./backend/package*.json ./
COPY ./backend/tsconfig.json ./
COPY ./backend/scripts/wait-for-it.sh ./
RUN chmod +x wait-for-it.sh

RUN npx playwright install-deps
RUN npx playwright install

RUN npm install --legacy-peer-deps
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY ./backend/src/agents ./agents
COPY ./backend/src/config ./config
COPY ./backend/src/core ./core
COPY ./backend/src/plugins ./plugins
COPY ./backend/src/routes ./routes
COPY ./backend/src/services ./services
COPY ./backend/src/workflow ./workflow
COPY ./backend/src/app.js .
COPY ./backend/src/db.js .
COPY ./backend/src/initSearchIndex.js .
COPY ./backend/src/logger.js .
COPY ./backend/src/searchableObjects.js .
COPY ./backend/src/searchFunctions.js .
COPY ./backend/src/utils.js .
COPY ./frontend/build/ ./build/

ENV FRONTEND_DIR=.
EXPOSE 5000

ENV NODE_OPTIONS="--experimental-modules --es-module-specifier-resolution=node"

CMD [ "node", "--loader", "ts-node/esm", "--enable-source-maps", "app.js" ]