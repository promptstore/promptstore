
Install the packages:

1. `cd backend & npm i`
2. `cd ../frontend & npm i --legacy-peer-deps`
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



curl -vL -H 'Content-Type: application/json' "http://localhost:5001/api/executions/emojify" --data '{"args":{"text": "The conservative supreme court justice Clarence Thomas is under renewed scrutiny after the Washington Post found that an activist with interests in the court's decisions funneled tens of thousands of dollars to Thomas's wife, with instructions not to mention her name."}, "modelKey":"emotion"}'

curl -vL -H 'Content-Type: application/json' "http://localhost:5001/api/executions/summarize" --data '{"args":{"text": "The conservative supreme court justice Clarence Thomas is under renewed scrutiny after the Washington Post found that an activist with interests in the court's decisions funneled tens of thousands of dollars to Thomas's wife, with instructions not to mention her name."}, "modelKey":"gpt-3.5-turbo"}'

curl -vL -H 'Content-Type: application/json' "http://localhost:5001/api/executions/sentiment" --data '{"args":{"text": "The conservative supreme court justice Clarence Thomas is under renewed scrutiny after the Washington Post found that an activist with interests in the court's decisions funneled tens of thousands of dollars to Thomas's wife, with instructions not to mention her name."}, "modelKey":"Sentiment"}'
