"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const originalFetch=global.fetch;
const storage=new Map();
global.document={getElementById:()=>null};
global.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
test.after(()=>{global.fetch=originalFetch;delete global.document;delete global.localStorage;});

test("API unterscheidet ungültiges JSON, Serverfehler und Aufrufer-Abbruch",async()=>{
  const {apiCall}=await import("../public/app/core/api.js?v=workspace-v11");
  global.fetch=async()=>new Response("<html>Proxy</html>",{status:200});
  await assert.rejects(apiCall("/layout"),{code:"INVALID_RESPONSE"});
  global.fetch=async()=>new Response(JSON.stringify({message:"Disk full",code:"SAVE_FAILED"}),{status:500});
  await assert.rejects(apiCall("/layout"),{code:"SAVE_FAILED",status:500});
  global.fetch=async()=>{throw new DOMException("Cancelled","AbortError")};
  const controller=new AbortController();controller.abort();
  await assert.rejects(apiCall("/layout",{signal:controller.signal}),{name:"AbortError"});
});
test("Änderungen während einer Speicheranfrage bleiben ungespeichert und im Entwurf",async()=>{
  const {state}=await import("../public/app/core/state.js?v=workspace-v11");
  const {layoutSpeichern}=await import("../public/app/layout/layout.js");
  state.layout={metadaten:{name:"A"},elemente:[],verbindungen:[]};state.layoutDirty=true;
  let finish;let requests=0;
  global.fetch=()=>{requests++;return new Promise(resolve=>{finish=resolve;});};
  const first=layoutSpeichern();const duplicate=layoutSpeichern();
  assert.equal(requests,1);assert.equal(first,duplicate);
  state.layout.metadaten.name="B";
  finish(new Response(JSON.stringify({ok:true,warnings:{relayConflicts:[]}})));
  await first;
  assert.equal(state.layoutDirty,true);
  assert.equal(JSON.parse(storage.get("dynora.layoutDraft")).layout.metadaten.name,"B");
  global.fetch=async()=>new Response(JSON.stringify({ok:true}));
  await layoutSpeichern();
  assert.equal(state.layoutDirty,false);assert.equal(storage.has("dynora.layoutDraft"),false);
});
test("Lokaler Entwurf wird auch bei ausgefallener Station geladen",async()=>{
  const {state}=await import("../public/app/core/state.js?v=workspace-v11");
  const {layoutLaden}=await import("../public/app/layout/layout.js");
  storage.set("dynora.layoutDraft",JSON.stringify({layout:{metadaten:{name:"Offline"},elemente:[],verbindungen:[]}}));
  global.fetch=async()=>{throw new Error("offline")};
  await layoutLaden();
  assert.equal(state.layout.metadaten.name,"Offline");assert.equal(state.layoutDirty,true);
});
