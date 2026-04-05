#!/bin/bash
# Script to export .env file variables into the current shell session
# Usage: source load-env.sh [path/to/.env]
#
# NOTE: This script must be sourced, not executed, to export variables
# into your current shell session. Use:
#   source load-env.sh
#   . load-env.sh

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: File '$ENV_FILE' not found" >&2
    return 1 2>/dev/null || exit 1
fi

# Count exported variables
count=0

while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

    # Skip lines without '='
    [[ "$line" != *"="* ]] && continue

    # Extract key and value
    key="${line%%=*}"
    value="${line#*=}"

    # Remove leading/trailing whitespace from key
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"

    # Skip if key is empty or contains invalid characters
    [[ -z "$key" || "$key" =~ [^a-zA-Z0-9_] ]] && continue

    # Remove surrounding quotes from value if present
    if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
    fi

    # Export the variable
    export "$key=$value"
    ((count++))
done < "$ENV_FILE"

echo "Exported $count variables from $ENV_FILE"
