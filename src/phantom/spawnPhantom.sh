#!/bin/bash

if [ $# -eq 0 ]; then
  echo "Usage: $0 <master-host> <master-port> [<additional-options>]"
  exit 1
fi

if ! command -v "phantomjs" >/dev/null ; then
  echo "PhantomJS is required but not installed."
  exit 2
fi

SCRIPT="phantom-bridge.js"
HOST=$1
PORT=$2
OPTS=${*:3}

echo phantomjs $OPTS "$SCRIPT" "$HOST" $PORT

