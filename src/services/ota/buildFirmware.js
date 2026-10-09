"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const appVersion = require("../../../package.json").version;

const SKETCHES = {
  ESP8266_NODEMCU_LED_DIRECT: "led_signalleuchten",
  ESP8266_NODEMCU_MCP23017_BME280: "relays_und_sensoren"
};

function cppString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, "");
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

async function buildFirmware(hardwareType, secret, dataDir, onProgress) {
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
  const workRoot = path.join(dataDir, ".ota-work");
  await fs.mkdir(workRoot, { recursive: true });
  const work = await fs.mkdtemp(path.join(workRoot, "build-"));
  const sketchDir = path.join(work, sketchName);
  const buildDir = path.join(work, "build");
  const outputDir = path.join(work, "output");
  await fs.mkdir(sketchDir, { recursive: true });
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  let code = await fs.readFile(source, "utf8");
  code = code.replace(/const char\* FIRMWARE_VERSION = "[^"]*";/, `const char* FIRMWARE_VERSION = "${version}";`);
  code = code.replace(/const char\* OTA_SHARED_SECRET = "[^"]*";/, `const char* OTA_SHARED_SECRET = "${cppString(secret)}";`);
  if (!code.includes(`const char* FIRMWARE_VERSION = "${version}";`) || !code.includes(`const char* OTA_SHARED_SECRET = "${cppString(secret)}";`)) {
    await fs.rm(work, { recursive: true, force: true });
    throw new Error("Firmware-Vorlage hat nicht die erwarteten OTA-Konfigurationsfelder.");
  }
  await fs.writeFile(path.join(sketchDir, `${sketchName}.ino`), code);
  try {
    const env = { ...process.env, ARDUINO_DIRECTORIES_DATA: "/opt/arduino/data", ARDUINO_DIRECTORIES_USER: "/opt/arduino/user", ARDUINO_DIRECTORIES_DOWNLOADS: path.join(dataDir, ".arduino", "staging") };
    await fs.mkdir(env.ARDUINO_DIRECTORIES_DOWNLOADS, { recursive: true });
    await run(cli, ["compile", "--config-file", "/etc/arduino-cli.yaml", "--fqbn", "esp8266:esp8266:nodemcuv2:FlashSize=4M1M", "--build-path", buildDir, "--output-dir", outputDir, sketchDir], env, percent => onProgress?.(percent));
    const bins = (await fs.readdir(outputDir)).filter(name => name.endsWith(".bin"));
    const binName = bins.find(name => name.endsWith(".ino.bin")) || bins.find(name => !name.includes("eep"));
    if (!binName) throw new Error("Arduino CLI hat keine Firmware-BIN erzeugt.");
    const firmware = await fs.readFile(path.join(outputDir, binName));
    if (firmware.length < 8 || !firmware.includes(Buffer.from(hardwareType)) || !firmware.includes(Buffer.from(version))) {
      throw new Error("Erzeugte Firmware enthält nicht die erwarteten Metadaten.");
    }
    return { version, firmware };
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

module.exports = { buildFirmware, SKETCHES };
