# Prompt Store

Install the packages:

1. `cd backend & npm i`
2. `cd ../frontend & npm i`
3. `cd ..`

In Dev mode:

1. Start server: `cd backend & npm start`
2. Start client: In separate window, `cd frontend & npm start`
3. Navigate to `http://localhost:3000`

The proxy setting in frontend/package.json will direct any locations not recognized by react-router to the backend address.

In Prod mode:

1. Build the frontend: `cd frontend & npm run build`
2. Start server: `cd ../backend & npm start`
3. Navigate to `http://localhost:5000`

This time, the backend server will serve the built frontend apps via the default route `/`.

Docker Compose

1. Build the frontend: `cd frontend & npm run build`
2. `cd ..`
3. `docker-compose up --build`

To rebuild, you may need to delete the data directory and start again

1. `sudo rm -rf data`
2. `docker-compose up --build`



curl -vL -H 'Content-Type: application/json' "http://localhost:5555/api/executions/emojify" --data '{"args":{"text": "The conservative supreme court justice Clarence Thomas is under renewed scrutiny after the Washington Post found that an activist with interests in the court’s decisions funneled tens of thousands of dollars to Thomas’s wife, with instructions not to mention her name."}, "modelKey":"emotion"}'

curl -vL -H 'Content-Type: application/json' "http://localhost:5555/api/executions/summarize" --data '{"args":{"text": "The conservative supreme court justice Clarence Thomas is under renewed scrutiny after the Washington Post found that an activist with interests in the court’s decisions funneled tens of thousands of dollars to Thomas’s wife, with instructions not to mention her name."}, "modelKey":"gpt-3.5-turbo"}'

curl -vL -H 'Content-Type: application/json' "http://localhost:5555/api/executions/sentiment" --data '{"args":{"text": "The conservative supreme court justice Clarence Thomas is under renewed scrutiny after the Washington Post found that an activist with interests in the court’s decisions funneled tens of thousands of dollars to Thomas’s wife, with instructions not to mention her name."}, "modelKey":"Sentiment"}'

curl -vL -H 'Content-Type: application/json' "http://localhost:5555/api/executions/ner" --data '{"args":{"text": "The conservative supreme court justice Clarence Thomas is under renewed scrutiny after the Washington Post found that an activist with interests in the court’s decisions funneled tens of thousands of dollars to Thomas’s wife, with instructions not to mention her name."}, "modelKey":"ner"}'

curl -vL -H 'Content-Type: application/json' https://feast.devsheds.io/get-online-features -d '{"features":["driver_hourly_stats:conv_rate"],"entities":{"driver_id":[1001]}}'

curl -vL -H 'Content-Type: application/json' https://feast.devsheds.io/get-online-features -d '{"feature_service":"driver_activity","entities":{"driver_id":[1001]}}'

curl -vL -H 'Content-Type: application/json' https://feast.devsheds.io/get-online-features -d '{"feature_service":"health_scores","entities":{"customer_id":['1234]}}'

curl -vL -H 'Content-Type: application/json' "http://localhost:5556/api/executions/get_driver_stats" --data '{"args":{"entityId":1001},"modelKey":"gpt-3.5-turbo"}'

curl -vL -H 'Content-Type: application/json' "https://promptstore.devsheds.io/api/executions/generate_health_report" --data '{"args":{"entityId":'1234'},"modelKey":"gpt-4"}'

ALTER TABLE models ADD COLUMN workspace_id INTEGER;

ALTER TABLE data_sources ADD COLUMN workspace_id INTEGER;

ALTER TABLE file_uploads ADD COLUMN created TIMESTAMP(0) NOT NULL DEFAULT NOW();

ALTER TABLE file_uploads ADD COLUMN created_by character varying(255) COLLATE pg_catalog."default";

ALTER TABLE file_uploads ADD COLUMN modified TIMESTAMP(0) NOT NULL DEFAULT NOW();

ALTER TABLE file_uploads ADD COLUMN modified_by character varying(255) COLLATE pg_catalog."default";

ALTER TABLE chat_sessions ADD COLUMN type character varying(255) COLLATE pg_catalog."default";

Temporal
Create namespace


docker run --rm -it --entrypoint tctl --network host --env TEMPORAL_CLI_ADDRESS=localhost:7233 temporalio/admin-tools:1.14.0 --namespace promptstore namespace register
