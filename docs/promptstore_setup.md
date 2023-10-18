# Prompt Store Setup

Prerequisites:

- Docker
- docker-compose

## Start Prompt Store.

    git clone git@github.com:promptstore/promptstore.git
    cd promptstore
    cp .env.template .env
    cp .env.vecsearch.template .env.vecsearch
    cp backend/.env.template backend/.env

Edit `backend/.env`, set `OPENAI_API_KEY`.

    cp frontend/.env.template frontend/.env
    cd frontend
    npm i --legacy-peer-deps
    npm run build
    cd ..
    docker-compose up postgresql

Once postgresql has fully started:

    Ctrl+C
    docker-compose up --build

In a separate window/tab:

    docker exec -it --env TEMPORAL_CLI_ADDRESS=temporal:7233 temporal-admin-tools tctl --namespace promptstore namespace register

## Open the Prompt Store UI

Open the UI at http://localhost:5001.