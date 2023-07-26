#!/usr/bin/env bash

app=promptstore

kubectl config use-context europa
kubectl config set-context --current --namespace=${app}

helm3 upgrade --install ${app} ./helm-chart
