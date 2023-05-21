#!/usr/bin/env bash

ENV_FILE=${1:-.env}

grep -v '^#' "${ENV_FILE}" | while read -r line; do echo "export $line"; done
