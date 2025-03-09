#!/usr/bin/env bash

eval $(./frontend/export-env.sh .env)
export DOCKER_DEFAULT_PLATFORM=linux/amd64
app=$APP_IMAGE_NAME
ver=$(cat ./VERSION)
cr=$CONTAINER_REGISTRY

docker buildx build --platform linux/amd64 . -t "${cr}/${app}:${ver}"
docker push "${cr}/${app}:${ver}"
