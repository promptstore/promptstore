# Installation options

1. Docker Compose
2. Kubernetes
3. Local

## Local install

Install the packages:

1. `cd backend & npm i --legacy-peer-deps`
2. `cd ../frontend & npm i --legacy-peer-deps`
3. `cd ..`

In Dev mode:

1. Start services (requires Docker Compose): `docker-compose -f docker-compose-dev.yml up`
2. Start background job processing: In separate window/tab, `cd backend & npm run worker`
3. Create Temporal namespace: In separate window/tab `docker exec -it --env TEMPORAL_CLI_ADDRESS=temporal:7233 temporal-admin-tools tctl --namespace promptstore namespace register`
4. Start app server: In separate window/tab, `cd backend & npm start`
5. Start client: In separate window/tab, `cd frontend & npm start`
6. Navigate to `http://localhost:3001`

Alernatively, use ngrok to use HTTPS (required by third party auth services):

In separate window/tab, `ngrok http 5001 --host-header localhost --domain <custom-domain>`

(or use the automatically assigned domain)

The proxy setting in frontend/package.json will direct any locations not recognized by react-router to the backend address.

In Prod mode:

As above, except instead of running the front-end in dev mode:

1. Build the frontend: `cd frontend & npm run build`
2. Start app server: `cd ../backend & npm run start-prod`
3. Navigate to `http://localhost:5001` or use ngrok as above

This time, the backend server will serve the built frontend apps via the default route `/`.

### Context

Prompt Store consists of a frontend React SPA, and a backend Express server using TypeScript and JavaScript. TypeScript is
used for core models while, currently, JavaScript is used for routes and services.

The Temporal workflow server is used to run background jobs. Currently, these jobs include uploading and processing
documents, and for sending emails if the Email tool is used.

PostgreSQL is used to store application metadata. Currently, MinIO is used for object storage. Redis Stack is used as a
session and token cache, and also used to support Temporal.

Finally, Elasticsearch is used to support Temporal and may be used for application metadata search later.

Other components such as Vector Stores are integrated using plugins.

As an alternative to running Temporal as a container using Docker Compose, Temporal may be installed as a local service.
See the Temporal documentation. On OS X, Temporal can be installed using Homebrew:

    brew install temporal

To create the promptstore namespace, use temporal as the host:

    docker exec -it --env TEMPORAL_CLI_ADDRESS=temporal:7233 temporal-admin-tools tctl --namespace promptstore namespace register

### Connecting to the database

    docker exec -it promptstore-postgresql-1 bash
    psql -h localhost -U postgres

default password: changeme

## Docker Compose

1. Build the frontend: `cd frontend & npm run build`
2. `cd ..`
3. `docker-compose up --build`

To rebuild completely, you may need to delete the data directory and start again

1. `sudo rm -rf data`
2. `docker-compose up --build`

Start up postgresql first to avoid issues while waiting for postgresql first-time startup to complete. A fresh 
database is built and populated on starting postgresql for the first time.

In Dev mode:

    docker-compose -f docker-compose-dev.yml up postgresql
    Ctrl-C
    docker-compose -f docker-compose-dev.yml up

In Prod mode:

    docker-compose up postgresql
    Ctrl-C
    docker-compose up

## Kubernetes

Prompt Store uses Helm for Kubernetes deployment.

1. Update the variables in .env
2. Export the environment variables. You can use the following script: `eval $(frontend/export-env.sh .env)`
3. Build the image: `./build.sh`
4. Deploy the image using Helm. You can use the following script: `./deploy.sh`

The Helm Chart doesn't specify ingress as this is usually specific to your Kubernetes setup. If you use
Istio, which is what I use, then you can use the additional yaml files under k8s/. You will need to
create ingress-cert if terminating TLS at Kubernetes.

### Installing supporting infrastructure

#### Chroma

See https://github.com/amikos-tech/chromadb-chart

    helm repo add chroma https://amikos-tech.github.io/chromadb-chart/
    helm repo update
    helm install chroma chroma/chromadb --set chromadb.allowReset="true" --set chromadb.dataVolumeStorageClass="local-path"

This uses token authentication by default. To get the token and header key:

    kubectl --namespace <chroma-namespace> get secret chromadb-auth -o jsonpath="{.data.token}" | base64 --decode
    kubectl --namespace <chroma-namespace> get secret chromadb-auth -o jsonpath="{.data.header}" | base64 --decode

For example, if installing into a namespace called "chroma", set the following 
values in `values.yaml`:

    ## Vector store plugins ########
    vector_stores:

    # Chroma
    chroma:
        host: "http://chroma-chromadb.chroma.svc.cluster.local:8000"
        token: "<from above>"
