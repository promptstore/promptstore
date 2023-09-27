#!/usr/bin/env bash

app=$APP_IMAGE_NAME
ver=$(cat ./VERSION)
cr=$CONTAINER_REGISTRY

docker build . -t "${cr}/${app}:${ver}"
docker push "${cr}/${app}:${ver}"
