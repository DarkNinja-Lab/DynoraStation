/*
  DynoraStation: eigene Relais-/Sensorvariante.
  MCP 1 nutzt 1 bis 16 Kanaele an 0x20; MCP 2 optional 0 bis 16 an 0x21.
  Fuer Sensoren sind 0 bis 3 Kanaele an D5, D6 und D7 moeglich.
*/
#define DYNORA_MCP1_RELAY_COUNT 16
#define DYNORA_MCP2_RELAY_COUNT 0
#define DYNORA_SENSOR_COUNT 3
#define DYNORA_HARDWARE_TYPE "ESP8266_NODEMCU_MCP23017_CUSTOM"
#include "relays_und_sensoren.ino"
