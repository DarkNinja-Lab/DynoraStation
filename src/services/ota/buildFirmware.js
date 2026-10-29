"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const appVersion = require("../../../package.json").version;
const FIRMWARE_FQBN = "esp8266:esp8266:nodemcuv2:eesz=4M1M";

const SKETCHES = {
  ESP8266_NODEMCU_LED_DIRECT: "led_signalleuchten",
  ESP8266_NODEMCU_MCP23017_BME280: "relays_und_sensoren"
};

function cppString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function replaceStringConstant(code, name, value) {
  const pattern = new RegExp(`(const char\\s*\\*\\s*${name}\\s*=\\s*)"[^"\\r\\n]*";`);
  if (!pattern.test(code)) throw new Error(`Firmware-Vorlage fehlt: ${name}`);
  return code.replace(pattern, (_match, prefix) => `${prefix}"${cppString(value)}";`);
}

function replaceNumericConstant(code, name, value) {
  const pattern = new RegExp(`(const uint16_t\\s+${name}\\s*=\\s*)\\d+;`);
  if (!pattern.test(code)) throw new Error(`Firmware-Vorlage fehlt: ${name}`);
  return code.replace(pattern, (_match, prefix) => `${prefix}${Number(value)};`);
}

function configureSketch(code, { version, secret, wifiSsid, wifiPassword, serverHost, serverPort }) {
  code = replaceStringConstant(code, "FIRMWARE_VERSION", version);
  code = replaceStringConstant(code, "OTA_SHARED_SECRET", secret);
  if (wifiSsid !== undefined) code = replaceStringConstant(code, "WIFI_SSID", wifiSsid);
  if (wifiPassword !== undefined) code = replaceStringConstant(code, "WIFI_PASS", wifiPassword);
  if (serverHost !== undefined) code = replaceStringConstant(code, "SERVER_HOST", serverHost);
  if (serverPort !== undefined) code = replaceNumericConstant(code, "SERVER_PORT", serverPort);
  return code;
}

function run(command, args, env, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const collect = chunk => {
      const text = chunk.toString();
      output = (output + text).slice(-12000);
      for (const match of text.matchAll(/\[\s*(\d{1,3})%\]/g)) onProgress(Number(match[1]));
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve(output) : reject(new Error(`Firmware-Build fehlgeschlagen (Exit ${code}): ${output.slice(-5000)}`)));
  });
}

async function buildFirmware(hardwareType, secret, dataDir, onProgress, configuration = {}) {
  const sketchName = SKETCHES[hardwareType];
  if (!sketchName) throw new Error(`Für Hardwaretyp ${hardwareType} gibt es keine Server-Firmware.`);
  if (!secret || secret.length < 24) throw new Error("OTA_SHARED_SECRET muss mindestens 24 Zeichen lang sein.");
  const cli = process.env.ARDUINO_CLI || "arduino-cli";
  const root = path.resolve(__dirname, "../../../esp8266_code");
  const sourceRoot = path.join(dataDir, "firmware-source");
  await fs.mkdir(sourceRoot, { recursive: true });
  const source = path.join(sourceRoot, `${sketchName}.ino`);
  try { await fs.access(source); } catch { await fs.copyFile(path.join(root, `${sketchName}.ino`), source); }
  const version = `${appVersion}-ota-${Date.now()}`;
  let code = await fs.readFile(source, "utf8");
  code = configureSketch(code, { ...configuration, version, secret });
  const workRoot = path.join(dataDir, ".ota-work");
  await fs.mkdir(workRoot, { recursive: true });
  const work = await fs.mkdtemp(path.join(workRoot, "build-"));
  const sketchDir = path.join(work, sketchName);
  const buildDir = path.join(work, "build");
  const outputDir = path.join(work, "output");
  try {
    await fs.mkdir(sketchDir, { recursive: true });
    await fs.mkdir(buildDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(sketchDir, `${sketchName}.ino`), code);
    const env = { ...process.env, ARDUINO_DIRECTORIES_DATA: "/opt/arduino/data", ARDUINO_DIRECTORIES_USER: "/opt/arduino/user", ARDUINO_DIRECTORIES_DOWNLOADS: path.join(dataDir, ".arduino", "staging") };
    await fs.mkdir(env.ARDUINO_DIRECTORIES_DOWNLOADS, { recursive: true });
    await run(cli, ["compile", "--config-file", "/etc/arduino-cli.yaml", "--fqbn", FIRMWARE_FQBN, "--build-path", buildDir, "--output-dir", outputDir, sketchDir], env, percent => onProgress?.(percent));
    const bins = (await fs.readdir(outputDir)).filter(name => name.endsWith(".bin"));
    const binName = bins.find(name => name.endsWith(".ino.bin")) || bins.find(name => !name.includes("eep"));
    if (!binName) throw new Error("Arduino CLI hat keine Firmware-BIN erzeugt.");
    const firmware = await fs.readFile(path.join(outputDir, binName));
    if (firmware.length < 8 || !firmware.includes(Buffer.from(hardwareType)) || !firmware.includes(Buffer.from(version)) || !firmware.includes(Buffer.from(secret))) {
      throw new Error("Erzeugte Firmware enthält nicht die erwarteten Metadaten.");
    }
    return { version, firmware };
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

module.exports = { buildFirmware, SKETCHES, configureSketch, FIRMWARE_FQBN };
