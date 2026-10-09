FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim
ARG ARDUINO_CLI_VERSION=1.2.2
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils gosu tzdata python3 make g++ && \
    curl -fsSL "https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz" -o /tmp/arduino-cli.tar.gz && \
    tar -xzf /tmp/arduino-cli.tar.gz -C /usr/local/bin arduino-cli && rm /tmp/arduino-cli.tar.gz && \
    mkdir -p /opt/arduino/data /opt/arduino/user /data && \
    printf 'directories:\n  data: /opt/arduino/data\n  user: /opt/arduino/user\n  downloads: /data/.arduino/staging\nboard_manager:\n  additional_urls:\n    - https://arduino.esp8266.com/stable/package_esp8266com_index.json\n' > /etc/arduino-cli.yaml && \
    arduino-cli core update-index --config-file /etc/arduino-cli.yaml && \
    arduino-cli core install esp8266:esp8266@3.1.2 --config-file /etc/arduino-cli.yaml && \
    arduino-cli lib install ArduinoJson@7.4.2 --config-file /etc/arduino-cli.yaml && \
    arduino-cli lib install "Adafruit BME280 Library" --config-file /etc/arduino-cli.yaml && \
    arduino-cli lib install "Adafruit Unified Sensor" --config-file /etc/arduino-cli.yaml && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    DYNORA_DATA_DIR=/data \
    SERVER_PORT=8181 \
    DISCOVERY_PORT=8182 \
    PUID=99 \
    PGID=100 \
    TZ=Europe/Berlin \
    ARDUINO_DIRECTORIES_DATA=/opt/arduino/data \
    ARDUINO_DIRECTORIES_USER=/opt/arduino/user

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY esp8266_code ./esp8266_code
COPY docker/entrypoint.sh /usr/local/bin/dynora-entrypoint

RUN chmod 755 /usr/local/bin/dynora-entrypoint && mkdir -p /data

EXPOSE 8181/tcp 8182/udp

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const r=require('http').get({host:'127.0.0.1',port:process.env.SERVER_PORT||8181,path:'/healthz'},s=>{s.resume();process.exitCode=s.statusCode===200?0:1});r.on('error',()=>process.exit(1));r.setTimeout(4000,()=>{r.destroy();process.exit(1)})"

ENTRYPOINT ["/usr/local/bin/dynora-entrypoint"]
CMD ["node", "src/server.js"]