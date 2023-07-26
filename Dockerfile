FROM node:16

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY ./backend/package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY ./backend/src/agents ./agents
COPY ./backend/src/plugins ./plugins
COPY ./backend/src/routes ./routes
COPY ./backend/src/services ./services
COPY ./backend/src/workflow ./workflow
COPY ./backend/src/app.js .
COPY ./backend/src/utils.js .
COPY ./frontend/build/ ./build/

ENV FRONTEND_DIR=.
EXPOSE 5000

CMD [ "node", "app.js" ]