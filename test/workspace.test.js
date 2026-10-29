"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM,VirtualConsole}=require("jsdom");

test("Builder-Arbeitsablauf: Start, Suche, Platzieren, Kopie, Undo, Import und Speichern",async()=>{
  const errors=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on("jsdomError",error=>errors.push(error.message));
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,"../public/index.html"),"utf8"),{url:"http://dynora.test",pretendToBeVisual:true,virtualConsole});
  const saved={};
  for(const key of ["window","document","localStorage","Event","CustomEvent","Option","XMLSerializer","confirm","requestAnimationFrame","cancelAnimationFrame"]) saved[key]=global[key];
  for(const key of ["window","document","localStorage","Event","CustomEvent","Option","XMLSerializer"]) global[key]=key==="window"?dom.window:dom.window[key];
  global.confirm=()=>true;
  global.requestAnimationFrame=fn=>{fn();return 1;};
  global.cancelAnimationFrame=()=>{};
  window.matchMedia=()=>({matches:false});
  Object.defineProperty(window.SVGElement.prototype,"viewBox",{get(){return{baseVal:{width:1600,height:900}}}});
  window.SVGElement.prototype.getScreenCTM=()=>null;
  window.SVGElement.prototype.getBBox=()=>({x:100,y:100,width:500,height:200});
  window.SVGElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1600,height:900});
  const originalFetch=global.fetch;
  const timers=[];const originalTimeout=global.setTimeout;
  global.setTimeout=(fn,ms,...args)=>{const timer=originalTimeout(fn,ms,...args);timers.push(timer);return timer;};
  const catalog=require("../src/domain/trackCatalog");
  let persisted=null;
  let savedSettings=null;
  global.fetch=async(url,options={})=>{
    let payload={};
    if(url.includes("track-catalog")) payload=Object.fromEntries([["tracks","track"],["curves","curve"],["switches","switch"],["crossings","xtrack"],["bumpers","bumper"]].map(([group,kind])=>[group,Object.entries(catalog.TRACK_CATALOG).filter(([,item])=>item.kind===kind).map(([code,item])=>({code,...item}))]));
    else if(url==="/api/status") payload={layout:{version:32,metadaten:{name:"Testanlage",raster:12.5,rasterMm:25,plateWidthMm:3200,plateHeightMm:1800},elemente:[],verbindungen:[]},hardware:{modules:{},relays:[],sensors:[],leds:[]},modules:[],events:[],rules:[],connection:{},revisions:{layout:1,events:1}};
    else if(url==="/api/control/settings") { savedSettings=JSON.parse(options.body); payload={ok:true,hardware:{lightButtons:(savedSettings.lightButtons||[]).map((button,index)=>({id:index+1,name:button.name,icon:button.icon,module:button.moduleId,relay:button.relayIndex}))}}; }
    else if(url==="/api/layout" && options.method==="POST") {persisted=JSON.parse(options.body);payload={ok:true,layout:persisted,warnings:{relayConflicts:[]}};}
    else if(url.includes("light-buttons")) payload={lightButtons:[]};
    else if(url.includes("rules")) payload={rules:[]};
    return new Response(JSON.stringify(payload),{status:200});
  };
  let state;
  try {
    const {startApp}=await import("../public/app/bootstrap.js");
    ({state}=await import("../public/app/core/state.js?v=workspace-v11"));
    // Catalog module exposes its individual lists rather than a response object.
    await startApp();
    clearTimeout(state.statusTimer);
    assert.ok(document.querySelectorAll(".component-card").length>4,"Katalog geladen");
    document.querySelector('[data-page-link="builder"]').click();
    assert.ok(document.getElementById("page-builder").classList.contains("active"));
    assert.equal(document.getElementById("builderLibrary").hidden,false);
    assert.equal(document.getElementById("inspector").hidden,true);
    assert.equal(document.querySelector('.nav-button[data-page="builder"]').classList.contains("active"),true);
    assert.equal(document.querySelector('.nav-button[data-page="track"]').classList.contains("active"),false);
    document.getElementById("openLibraryButton").click();
    assert.equal(document.getElementById("builderLibrary").hidden,true,"Artikelleiste lässt sich schließen");
    document.getElementById("openLibraryButton").click();
    assert.equal(document.getElementById("builderLibrary").hidden,false);
    assert.equal(document.getElementById("openLibraryButton").getAttribute("aria-expanded"),"true");
    const category=document.getElementById("libraryCategory");
    category.value="all";category.dispatchEvent(new Event("change"));
    const images=[...document.querySelectorAll('.component-card img')];
    assert.ok(images.length>=18,"Vorhandene Artikelbilder sind wieder eingebunden");
    for (const img of images) {
      if (img.src.startsWith("data:")) continue;
      assert.ok(fs.existsSync(path.join(__dirname, "../public", new URL(img.src).pathname)), img.src);
    }
    const search=document.getElementById("componentSearch");
    search.value="5202";search.dispatchEvent(new Event("input"));
    assert.equal(document.querySelectorAll(".component-card").length,0,"5202 ist ein Weichenpaar, kein einzelnes platzierbares Gleis");
    search.value="5203";search.dispatchEvent(new Event("input"));
    assert.equal(document.querySelectorAll(".component-card").length,1,"Einzelweiche 5203 ist als linke R2-Weiche auffindbar");
    search.value="5106";search.dispatchEvent(new Event("input"));
    assert.equal(document.querySelectorAll(".component-card").length,1);
    document.querySelector(".component-card").click();
    assert.equal(state.selectedTool,"place");
    assert.equal(document.getElementById("builderLibrary").hidden,false,"Artikelleiste bleibt beim Platzieren erreichbar");
    const photo=document.querySelector('.component-card img');
    assert.ok(photo.src.includes('/assets/track/5106.jpg') || photo.src.startsWith('data:image/'));
    if (!photo.src.startsWith('data:')) assert.ok(fs.existsSync(path.join(__dirname,'../public',new URL(photo.src).pathname)));
    photo.dispatchEvent(new Event("error"));
    assert.equal(document.querySelector('.component-picture').classList.contains('has-photo'),false,"Fehlendes Bild zeigt Ersatzsymbol");
    const svg=document.getElementById("builderSvg");
    svg.dispatchEvent(new window.MouseEvent("pointerdown",{bubbles:true,button:0,clientX:400,clientY:300}));
    assert.equal(state.layout.elemente.length,1);
    assert.ok(document.querySelector('#builderElementLayer .schematic-rail'));
    const unchanged=JSON.stringify(state.layout);
    document.querySelector('[data-builder-view="rails"]').click();
    assert.equal(document.querySelector('#builderElementLayer .schematic-rail'),null);
    assert.equal(JSON.stringify(state.layout),unchanged,"Ansichtswechsel verändert keine Plandaten");
    document.querySelector('[data-builder-view="schematic"]').click();
    assert.ok(document.querySelector('#builderElementLayer .schematic-rail'));
    document.getElementById("placementDone").click();
    assert.equal(state.placement,null);

    const { renderCanvas: renderBuilderCanvas, snapCanvasPoint, canvasSize } = await import("../public/app/builder/render.js?v=workspace-v17");
    const board = canvasSize();
    const edgePoints = [
      { x: 0, y: 0 }, { x: board.width, y: 0 },
      { x: board.width, y: board.height }, { x: 0, y: board.height }
    ];
    for (const point of edgePoints) assert.deepEqual(snapCanvasPoint(point), point, "Rasterfang darf die Plattenränder nicht sperren");
    const dragTrackTo = (x, y) => {
      const track = state.layout.elemente[0];
      const group = document.querySelector(`#builderElementLayer [data-id="${track.id}"]`);
      group.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: track.x, clientY: track.y }));
      group.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
      group.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, button: 0, clientX: x, clientY: y }));
    };
    dragTrackTo(0, 0);
    assert.equal(state.layout.elemente[0].x, 0, "Gleis lässt sich bis an den linken Rand ziehen");
    assert.equal(state.layout.elemente[0].y, 0, "Gleis lässt sich bis an den oberen Rand ziehen");
    dragTrackTo(board.width, 0);
    assert.equal(state.layout.elemente[0].x, board.width, "Gleis lässt sich bis an den rechten Rand ziehen");
    dragTrackTo(board.width, board.height);
    assert.equal(state.layout.elemente[0].y, board.height, "Gleis lässt sich bis an den unteren Rand ziehen");

    const previousLayout = state.layout;
    state.layout = { ...state.layout, elemente: [
      { id: "branch-switch", typ: "switch", x: 600, y: 350, rotation: 0, winkel: 0, switchCode: "5118", switchState: "gerade" },
      { id: "branch-track-a", typ: "track", x: 900, y: 500, rotation: 0, winkel: 0, trackCode: "5106" },
      { id: "branch-track-b", typ: "track", x: 1050, y: 560, rotation: 0, winkel: 0, trackCode: "5106" }
    ], verbindungen: [] };
    state.selectedTool = "connect";
    state.connectFrom = null;
    renderBuilderCanvas();
    assert.match(document.querySelector("#page-builder .pan-hint").textContent, /zuerst ein Gleis anklicken/i);
    const clickBuilderElement = id => document.querySelector(`#builderElementLayer [data-id="${id}"]`).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    clickBuilderElement("branch-switch");
    assert.match(document.querySelector("#page-builder .pan-hint").textContent, /das nächste gleis anklicken/i);
    clickBuilderElement("branch-track-a");
    assert.equal(state.layout.verbindungen.length, 1, "Erster Weichenanschluss wird hergestellt");
    clickBuilderElement("branch-switch");
    clickBuilderElement("branch-track-b");
    assert.equal(state.layout.verbindungen.length, 2, JSON.stringify({ links: state.layout.verbindungen, connectFrom: state.connectFrom, selectedTool: state.selectedTool }));
    const switchPorts = state.layout.verbindungen.map(link => link.von === "branch-switch" ? link.vonPort : link.nachPort);
    assert.equal(new Set(switchPorts).size, 2, "Verwendet zwei verschiedene Weichenanschlüsse");
    const { analyzePlan } = await import("../public/app/builder/validation.js?v=workspace-v11");
    assert.equal(analyzePlan(state.layout).some(issue => issue.code === "GAP"), false, "Der erste Anschluss bleibt beim Verbinden des zweiten Zweigs erhalten");
    state.selectedTool = "select";
    document.querySelector(`#builderElementLayer [data-id="branch-switch"]`).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(document.querySelector(".builder-layout").dataset.panel, "inspector", "Inspector opens beside the plan");
    assert.equal(document.getElementById("inspector").hidden, false);
    assert.equal(document.getElementById("inspector").dataset.elementId, "branch-switch");
    const testSignal = { id: "direction-signal", typ: "espSignal", x: 400, y: 400, rotation: 0, signalAspectMode: "rgy", espState: "halt", signalDirection: "forward" };
    state.layout = { ...state.layout, elemente: [testSignal], verbindungen: [] };
    renderBuilderCanvas();
    document.querySelector(`#builderElementLayer [data-id="${testSignal.id}"]`).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    const direction = document.getElementById("inspSignalDirection");
    assert.ok(direction, "Signale bieten eine Fahrtrichtungsauswahl");
    direction.value = "reverse";
    direction.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(testSignal.signalDirection, "reverse");
    assert.equal(document.getElementById("inspector").dataset.elementId, testSignal.id);
    state.layout = previousLayout;
    state.selectedElement = previousLayout.elemente[0]?.id || null;

    renderBuilderCanvas();
    assert.equal(state.placement,null);
    const {exportBuildPlan}=await import('../public/app/builder/export.js?v=workspace-v11');
    exportBuildPlan();
    const exportDocument=document.querySelector('#buildPlanPreview iframe').srcdoc;
    assert.ok(exportDocument.includes('schematic-rail'));
    assert.ok(exportDocument.includes('stroke="#343d42"'),"Stellpultlinien bleiben im eigenständigen Druckdokument sichtbar");
    document.querySelector('[data-export-close]').click();

    document.getElementById("duplicateButton").click();
    assert.equal(state.layout.elemente.length,2);
    document.dispatchEvent(new window.KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true}));
    assert.equal(state.layout.elemente.length,1);
    document.dispatchEvent(new window.KeyboardEvent("keydown",{key:"z",ctrlKey:true,shiftKey:true,bubbles:true}));
    assert.equal(state.layout.elemente.length,2);
    state.selectedElement=state.layout.elemente[0].id;
    const {renderCanvas}=await import("../public/app/builder/render.js?v=workspace-v17");
    renderCanvas();
    // Drag-and-drop uses the same placement path, including history and snapping.
    const transfer={getData:type=>type==='application/x-dynora-component'?document.querySelector('[data-component]').dataset.component:''};
    const drop=new window.MouseEvent('drop',{bubbles:true,clientX:700,clientY:500});
    Object.defineProperty(drop,'dataTransfer',{value:transfer});
    const beforeDrop=state.layout.elemente.length;
    svg.dispatchEvent(drop);
    assert.equal(state.layout.elemente.length,beforeDrop+1);
    assert.equal(state.placement,null,"Ziehen platziert genau einen Artikel");
    document.dispatchEvent(new window.KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true}));
    assert.equal(state.layout.elemente.length,beforeDrop,"Gezogener Artikel lässt sich rückgängig machen");
    state.selectedElement=state.layout.elemente[0].id;
    renderCanvas();
    document.getElementById("rotateLeftButton").click();
    assert.equal(state.layout.elemente[0].rotation,345);
    assert.equal(document.getElementById("inspRotation").value,"345");
    const name=document.getElementById("layoutName");name.value="Neuer Plan";name.dispatchEvent(new Event("change"));
    document.getElementById("saveLayoutButton").click();
    await new Promise(resolve=>originalTimeout(resolve,20));
    assert.equal(persisted.metadaten.name,"Neuer Plan");assert.equal(state.layoutDirty,false);
    document.getElementById("centerLayoutButton").click();assert.notEqual(state.zoom,1);
    document.querySelector('[data-page-link="dashboard"]').click();
    document.dispatchEvent(new window.KeyboardEvent("keydown",{key:"Delete",bubbles:true}));
    assert.equal(state.layout.elemente.length,2,"Globale Shortcuts löschen außerhalb des Builders nichts");
    document.querySelector('[data-page-link="builder"]').click();
    const imported={metadaten:{name:"Import"},elemente:[{id:"imported",typ:"track",x:0,y:0}],verbindungen:[]};
    const input=document.getElementById("importLayoutInput");
    Object.defineProperty(input,"files",{value:[{size:100,name:"plan.json",text:async()=>JSON.stringify(imported)}],configurable:true});
    input.dispatchEvent(new Event("change"));
    await new Promise(resolve=>originalTimeout(resolve,20));
    assert.equal(state.layout.metadaten.name,"Import");assert.equal(state.layoutDirty,true);
    document.getElementById("undoButton").click();assert.equal(state.layout.metadaten.name,"Neuer Plan");
    if (document.querySelector(".builder-layout").dataset.panel !== "library") document.querySelector('[data-builder-panel="library"]').click();
    assert.equal(document.querySelector(".builder-layout").dataset.mobilePanel,"library");
    document.querySelector('[data-builder-panel="inspector"]').click();
    assert.equal(document.querySelector(".builder-layout").dataset.mobilePanel,"inspector");
    const {showInspector}=await import("../public/app/builder/inspect.js?v=workspace-v14");
    const offline=state.layout.elemente[0];
    Object.assign(offline,{module:"OFFLINE_ESP",relay:5,sensorId:"S1",x:-10,y:20});
    state.hardware.modules={other:{id:"other",name:"Testmodul",kind:"RELAY_SENSOR",capabilities:["relay"],relays:[false],sensors:[],leds:[]}};
    renderCanvas();
    assert.equal(offline.x,-10,"Rendern verändert keine gespeicherten Positionen");
    showInspector(offline);
    assert.equal(offline.module,"OFFLINE_ESP","Öffnen des Inspectors löscht keine Zuordnung");
    const inspectorName=document.getElementById("inspName");
    inspectorName.value="Offline-Gleis";inspectorName.dispatchEvent(new Event("change"));
    assert.equal(offline.module,"OFFLINE_ESP");assert.equal(offline.relay,5);assert.equal(offline.sensorId,"S1");
    document.querySelector('.nav-button[data-page="settings"]').click();
    assert.equal(state.settingsView,"overview");
    assert.equal(document.querySelector('[data-settings-section="overview"]').hidden,false);
    assert.equal(document.querySelectorAll('[data-settings-section]:not([hidden])').length,1);
    document.querySelector('[data-settings-view="modules"]').click();
    assert.equal(state.settingsView,"modules");
    assert.equal(document.querySelector('[data-settings-section="overview"]').hidden,true);
    assert.equal(document.getElementById("settingsBreadcrumb").hidden,false);
    const device=document.querySelector('.module-settings-card');
    assert.ok(device);assert.equal(device.open,false);
    device.open=true;
    document.dispatchEvent(new Event("dynora:modules-updated"));
    assert.equal(document.querySelector('.module-settings-card').open,true,"Live-Updates erhalten aufgeklappte Module");
    document.querySelector('.module-channel-links [data-settings-view="relays"]').click();
    assert.equal(state.settingsView,"relays");assert.equal(state.settingsRelayModule,"other");
    state.lightButtons=[{id:1,moduleId:"other",relayIndex:1,name:"Bahnsteiglicht",icon:"light"}];
    const {renderSettingsTab}=await import("../public/app/ui/events.js?v=workspace-v27");
    renderSettingsTab();
    assert.match(document.querySelector(".relay-light-assignment")?.textContent || "", /Bahnsteiglicht/, "Relay shows the assigned light button name");
    document.querySelector('[data-settings-view="lights"]').click();
    const lightIcon=document.querySelector('[data-light-index="0"] [data-field="icon"]');
    lightIcon.value="home";lightIcon.dispatchEvent(new Event("change",{bubbles:true}));
    assert.equal(state.lightButtons[0].icon,"home");
    assert.match(document.querySelector("#trackLightGrid .light-toggle-main")?.innerHTML || "", /icon-home/, "Selected icon updates the operating button immediately");
    document.querySelector('[data-save-section="lights"]').click();
    await new Promise(resolve=>originalTimeout(resolve,30));
    assert.equal(savedSettings?.lightButtons?.[0]?.icon,"home", "Selected icon is included in the settings request");
    assert.equal(state.lightButtons[0].icon,"home", "Saved icon remains selected after the server response");
    const relayName=document.querySelector('[data-field="relayName"]');
    relayName.value="Bahnhof";relayName.dispatchEvent(new Event("input",{bubbles:true}));
    assert.equal(state.settingsDirty.relays,true);
    document.querySelector('[data-settings-view="overview"]').click();
    assert.equal(document.getElementById("settingsBreadcrumb").hidden,true);
    document.querySelector('[data-settings-view="relays"]').click();
    assert.equal(document.querySelector('[data-field="relayName"]').value,"Bahnhof","Entwurf bleibt beim Wechsel der Einstellungsseiten erhalten");
    document.querySelector('[data-settings-view="overview"]').click();
    for(const view of ["lights","leds","sensors","rules","defaults","station"]) {
      document.querySelector(`[data-settings-view="${view}"]`).click();
      assert.equal(state.settingsView,view);
      assert.equal(document.querySelectorAll('[data-settings-section]:not([hidden])').length,1);
      document.querySelector('[data-settings-view="overview"]').click();
    }
    assert.deepEqual(errors,[],"Keine Fehler in UI-Eventhandlern");
  } finally {
    if(state) clearTimeout(state.statusTimer);
    timers.forEach(clearTimeout);global.setTimeout=originalTimeout;
    global.fetch=originalFetch;dom.window.close();
    for(const [key,value] of Object.entries(saved)){if(value===undefined)delete global[key];else global[key]=value;}
  }
});
