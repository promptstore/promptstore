#!/usr/bin/env bash

app=openaiplatform
ns=openaiplatform

kubectl config use-context europa
kubectl config set-context --current --namespace=${ns}

helm3 upgrade --install ${app} ./helm-chart
