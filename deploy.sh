#!/usr/bin/env bash

app=openaiplatform
ns=openaiplatform

kubectl config use-context europa
kubectl config set-context --current --namespace=${ns}

helm upgrade --install ${app} -f openaiplatform/values.yaml ./helm-chart
