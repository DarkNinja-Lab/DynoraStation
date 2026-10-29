"use strict";

import { svg, attrs, localConnectionPorts, turnout5141Geometry, curvedRoutePath } from "./shapes.js?v=workspace-v20";

// Same connection geometry as the measured track view. Only presentation changes.
export function drawSchematicShape(group, element, item = {}) {
  const ports = localConnectionPorts(element, item);
  const path = (d, role = "rail") => {
    const node = svg("path");
    attrs(node, { stroke: ({rail:"#343d42",go:"#21934f",branch:"#ca4549",accessory:"#337dad"})[role], "stroke-width": role === "accessory" ? 4 : 7, d, class: `schematic-${role}`, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
    group.append(node); return node;
  };
  const dot = (x, y, color) => {
    const node = svg("circle");
    attrs(node, { cx: x, cy: y, r: 5, fill: color, stroke: "#fff", "stroke-width": 1.5 }); group.append(node);
  };
  const line = (a,b) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const route = (d, active, straight) => path(d, active ? (straight ? "go" : "branch") : "rail");
  switch (element.typ) {
    case "track":
      path(line(ports[0],ports[1]));
      if (item.trackStyle === "uncoupler") path("M-10 9L0 -7L10 9 M0 -7V15", "accessory");
      break;
    case "curve": {
      const radius = Math.max(35, Number(item.radius || 360) * .5);
      path(`M ${ports[0].x} 0 A ${radius} ${radius} 0 0 1 ${ports[1].x} 0`); break;
    }
    case "switch": {
      const straight = element.switchState !== "abzweig";
      const sign = item.handed === "right" ? 1 : -1;
      let through,branch;
      if (item.switchGeometry === "5141") {
        const g = turnout5141Geometry(item,sign);
        through = g.mainPath;
        branch = g.branchPath;
      } else if (item.switchStyle === "curved") {
        const r = Math.max(250,Number(item.radius)||437.4)*.5;
        const a = Math.max(10,Math.min(40,Number(item.angleDeg)||24.2833))*Math.PI/180;
        through = curvedRoutePath(ports[0].x,r,a,sign);
        branch = curvedRoutePath(ports[0].x,r,a,sign);
      } else {
        through = line(ports[0],ports[1]);
        const r = Math.max(250,Number(item.radius)||437.4)*.5;
        const a = Math.max(10,Math.min(40,Number(item.angleDeg)||24.2833))*Math.PI/180;
        branch = curvedRoutePath(ports[0].x,r,a,sign);
      }
      // Paint the selected route last so the shared origin stays legible.
      route(straight ? branch : through,false,straight);
      route(straight ? through : branch,true,straight);
      dot(ports[0].x+16,sign*22,straight ? "#269c56" : "#d64a4a"); break;
    }
    case "crossing": {
      const branch = element.xState === "abzweig";
      path(line(ports[0],ports[1]));path(line(ports[2],ports[3]));
      if (branch) {
        route(`M${ports[0].x} ${ports[0].y} Q0 0 ${ports[3].x} ${ports[3].y}`,true,false);
        route(`M${ports[2].x} ${ports[2].y} Q0 0 ${ports[1].x} ${ports[1].y}`,true,false);
      } else {route(line(ports[0],ports[1]),true,true);route(line(ports[2],ports[3]),true,true);}
      break;
    }
    case "bumper": {
      const end = Math.max(45,Number(item.length)||70)*.25;
      path(`M${ports[0].x} 0H${end} M${end} -11V11`);break;
    }
    case "signal": case "espSignal": {
      const aspect = element.typ === "signal" ? element.signalState : element.espState || element.ledState;
      const three = element.typ === "espSignal" && element.signalAspectMode === "rgy";
      const body = svg("rect"); attrs(body,{x:-11,y:-24,width:22,height:three?52:38,rx:7,fill:"#242a2e",stroke:"#626d74","stroke-width":2});
      path(`M0 ${three?28:14}V39 M-10 39H10`);group.append(body);
      dot(0,-14,aspect === "halt" || !aspect ? "#e44245" : "#643335");
      if(three)dot(0,2,aspect === "warnung" ? "#edbd35" : "#655932");
      dot(0,three?18:2,aspect === "fahrt" ? "#26b55d" : "#315b43");
      break;
    }
    case "transformer": {
      const rect=svg("rect");attrs(rect,{x:-22,y:-19,width:44,height:38,rx:5,fill:"#fff",stroke:"#5b6670","stroke-width":2});group.append(rect);
      path("M4 -13L-7 2H3L-3 14","accessory");break;
    }
    default: return false;
  }
  return true;
}
