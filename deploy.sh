#!/usr/bin/env bash

eval $(./frontend/export-env.sh .env)
app=$HELM_APP_NAME
ns=$K8S_NAMESPACE
context=$K8S_CONTEXT

kubectl config use-context $context
kubectl config set-context --current --namespace="${ns}"

helm upgrade --install $app  -n $ns -f $HELM_VALUES_FILE ./helm-chart
