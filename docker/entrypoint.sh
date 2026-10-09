#!/bin/sh
set -eu

: "${PUID:=99}"
: "${PGID:=100}"
: "${DYNORA_DATA_DIR:=/data}"

case "$PUID" in
  ''|*[!0-9]*) echo "PUID muss numerisch sein" >&2; exit 1 ;;
esac
case "$PGID" in
  ''|*[!0-9]*) echo "PGID muss numerisch sein" >&2; exit 1 ;;
esac

mkdir -p "$DYNORA_DATA_DIR"

if [ "$(id -u)" = 0 ]; then
  chown -R "$PUID:$PGID" "$DYNORA_DATA_DIR"
  exec gosu "$PUID:$PGID" "$@"
fi

if [ ! -w "$DYNORA_DATA_DIR" ]; then
  echo "Datenverzeichnis nicht schreibbar: $DYNORA_DATA_DIR" >&2
  exit 1
fi

exec "$@"