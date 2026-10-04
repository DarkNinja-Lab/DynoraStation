"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { validateLayoutPayload } = require("../src/domain/layout/validateLayoutPayload");
const { normalizeLayout } = require("../src/domain/layout/normalizeLayout");
const { queueWrite } = require("../src/services/storage/queuedWriter");
const { rateLimitFactory } = require("../src/app/middleware/rateLimit");

const sample = () => ({elemente:[{id:"a",typ:"track",x:0,y:0},{id:"b",typ:"track",x:90,y:0}],verbindungen:[]});
test("Layoutvalidierung weist beschädigte Pläne ohne stillen Datenverlust zurück", () => {
  assert.equal(validateLayoutPayload(sample()), null);
  for (const body of [[], {...sample(),elemente:[null]}, {...sample(),elemente:[{id:"a",typ:"unknown"}]}, {...sample(),elemente:[{id:"a",typ:"track",x:"Infinity"}]}, {...sample(),elemente:[{id:"a",typ:"track"},{id:"a",typ:"track"}]}, {...sample(),verbindungen:[{von:"a",nach:"missing"}]}, {...sample(),verbindungen:[{von:"a",nach:"b",vonPort:-1}]}]) assert.ok(validateLayoutPayload(body));
});
test("Rotation und Raster verwenden jeweils eine gemeinsame Quelle", () => {
  const result = normalizeLayout({...sample(),metadaten:{raster:10,rasterMm:50},elemente:[{id:"a",typ:"track",rotation:345,winkel:0}]});
  assert.equal(result.elemente[0].rotation,345);
  assert.equal(result.elemente[0].winkel,345);
  assert.equal(result.metadaten.raster,25);
});
test("Duplizieren trennt Hardware und behält die Geometrie", async () => {
  const { duplicateForPlacement, normalizedRotation } = await import("../public/app/builder/model.js");
  const source = {id:"a",typ:"switch",x:100,y:200,rotation:30,module:"ESP",relayStraight:1,relayBranch:2,sensorId:"S1",powerState:true,stromkreis:"A",linkedSignalId:"sig"};
  const copy = duplicateForPlacement(source,1600,900);
  assert.notEqual(copy.id,source.id);
  assert.equal(copy.rotation,30);
  assert.equal(copy.x,140);
  for(const key of ["module","sensorId","stromkreis","linkedSignalId"]) assert.equal(copy[key],"");
  assert.equal(copy.relayStraight,0); assert.equal(copy.relayBranch,0); assert.equal(copy.powerState,false);
  assert.equal(source.relayStraight,1);
  assert.equal(normalizedRotation(-15),345);
});
test("Schreibwarteschlange meldet Fehler und erholt sich beim nächsten Versuch", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),"dynora-writer-"));
  const runtimeState = {paths:{DATA_DIR:dir},writeState:{layout:{running:false,pending:false}}};
  const options = {kind:"layout",runtimeState,addEvent:()=>{},payloadFactory:()=>'{"ok":true}',file:path.join(dir,"missing","layout.json")};
  try {
    assert.equal((await queueWrite(options)).ok,false);
    assert.ok(runtimeState.writeState.layout.lastError);
    options.file=path.join(dir,"layout.json");
    assert.equal((await queueWrite(options)).ok,true);
    assert.deepEqual(JSON.parse(await fs.readFile(options.file,"utf8")),{ok:true});
    assert.equal(runtimeState.writeState.layout.lastError,null);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test("Gleichzeitige Schreibanfragen sichern den neuesten Stand", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),"dynora-writer-"));
  let version=1;
  const options={kind:"layout",file:path.join(dir,"layout.json"),payloadFactory:()=>JSON.stringify({version}),addEvent:()=>{},runtimeState:{paths:{DATA_DIR:dir},writeState:{layout:{running:false,pending:false}}}};
  try {
    const first=queueWrite(options);version=2;const second=queueWrite(options);
    await Promise.all([first,second]);
    assert.equal(JSON.parse(await fs.readFile(options.file,"utf8")).version,2);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test("Rate-Limit bleibt IP-basiert und entfernt abgelaufene Einträge", () => {
  const buckets = new Map([["old",{resetAt:0,count:10}]]);
  const middleware=rateLimitFactory(buckets)({keyPrefix:"test",windowMs:5000,max:2,key:(_req,ip)=>ip});
  const req={ip:"127.0.0.1",headers:{},socket:{remoteAddress:"127.0.0.1"}};
  const headers={};const res={setHeader:(key,value)=>headers[key]=value};
  const errors=[];
  for(let i=0;i<3;i++) middleware(req,res,error=>errors.push(error));
  assert.equal(buckets.has("old"),false);
  assert.equal(errors[0],undefined);assert.equal(errors[1],undefined);assert.equal(errors[2].status,429);
  assert.ok(Number(headers["Retry-After"])>0);
});
test("JSON-Import prüft Metadaten, IDs und Anschlussnummern vor dem Ersetzen", async () => {
  const {validateImport}=await import("../public/app/builder/model.js");
  assert.equal(validateImport(sample()).elemente.length,2);
  assert.throws(()=>validateImport({...sample(),metadaten:"invalid"}));
  assert.throws(()=>validateImport({...sample(),verbindungen:[{von:"a",nach:"b",vonPort:99}]}));
  assert.throws(()=>validateImport({...sample(),elemente:[{id:"a",typ:"track",x:NaN}]}));
});
