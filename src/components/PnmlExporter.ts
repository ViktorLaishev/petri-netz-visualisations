// import { saveAs } from "file-saver";

// export function exportPetriNetToPNML(
//   graph: {
//     nodes: { id: string; type: "place" | "transition"; tokens?: number }[];
//     edges: { source: string; target: string }[];
//   },
//   fileName = "exported-petri-net.pnml"
// ) {
//   const places = graph.nodes
//     .filter((n) => n.type === "place")
//     .map(
//       (p) => `
//       <place id="${p.id}">
//         <name><text>${p.id}</text></name>
//         <initialMarking><text>${p.tokens || 0}</text></initialMarking>
//       </place>`
//     )
//     .join("");

//   const transitions = graph.nodes
//     .filter((n) => n.type === "transition")
//     .map(
//       (t) => `
//       <transition id="${t.id}">
//         <name><text>${t.id}</text></name>
//       </transition>`
//     )
//     .join("");

//   const arcs = graph.edges
//     .map(
//       (e, i) => `
//       <arc id="arc${i}" source="${e.source}" target="${e.target}">
//         <inscription><text>1</text></inscription>
//       </arc>`
//     )
//     .join("");

//   const pnml = `<?xml version="1.0" encoding="UTF-8"?>
// <pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
//   <net id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet">
//     ${places}
//     ${transitions}
//     ${arcs}
//   </net>
// </pnml>`;

//   const blob = new Blob([pnml], { type: "application/xml;charset=utf-8" });
//   saveAs(blob, fileName);
// }
import { saveAs } from "file-saver";

export function exportPetriNetToPNML(
  graph: {
    nodes: { id: string; type: "place" | "transition"; tokens?: number }[];
    edges: { source: string; target: string }[];
  },
  fileName = "exported-petri-net.pnml"
) {
  const places = graph.nodes
    .filter((n) => n.type === "place")
    .map(
      (p) => `
        <place id="${p.id}">
          <name>
            <text>${p.id}</text>
          </name>
          <initialMarking>
            <text>${p.tokens || 0}</text>
          </initialMarking>
        </place>`
    )
    .join("");

  const transitions = graph.nodes
    .filter((n) => n.type === "transition")
    .map(
      (t) => `
        <transition id="${t.id}">
          <name>
            <text>${t.id}</text>
          </name>
        </transition>`
    )
    .join("");

  const arcs = graph.edges
    .map(
      (e, i) => `
        <arc id="arc${i}" source="${e.source}" target="${e.target}">
          <inscription>
            <text>1</text>
          </inscription>
        </arc>`
    )
    .join("");

  const pnml = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <name><text>Generated Net</text></name>
    <page id="page1">
      ${places}
      ${transitions}
      ${arcs}
    </page>
  </net>
</pnml>`;

  const blob = new Blob([pnml], { type: "application/xml;charset=utf-8" });
  saveAs(blob, fileName);
}
export function exportPetriNetToPNMLString(graph: {
  nodes: { id: string; type: "place" | "transition"; tokens?: number }[];
  edges: { source: string; target: string }[];
}): string {
  const places = graph.nodes
    .filter((n) => n.type === "place")
    .map(
      (p) => `
        <place id="${p.id}">
          <name>
            <text>${p.id}</text>
          </name>
          <initialMarking>
            <text>${p.tokens || 0}</text>
          </initialMarking>
        </place>`
    )
    .join("");

  const transitions = graph.nodes
    .filter((n) => n.type === "transition")
    .map(
      (t) => `
        <transition id="${t.id}">
          <name>
            <text>${t.id}</text>
          </name>
        </transition>`
    )
    .join("");

  const arcs = graph.edges
    .map(
      (e, i) => `
        <arc id="arc${i}" source="${e.source}" target="${e.target}">
          <inscription>
            <text>1</text>
          </inscription>
        </arc>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <name><text>Generated Net</text></name>
    <page id="page1">
      ${places}
      ${transitions}
      ${arcs}
    </page>
  </net>
</pnml>`;
}
