import React, { useState, useEffect } from "react";
import axios from "axios";
import CytoscapeComponent from "react-cytoscapejs";

// How many targets each rule needs:
const ruleTargetCount = {
  psiA: 2, // abstraction needs two endpoints
  psiD: 2, // dual abstraction needs two endpoints
  psiT: 1, // linear dependent transition
  psiP: 1, // linear dependent place
};

// Which node types are legal for each rule:
const ruleLegalTypes = {
  psiA: ["transition"],
  psiD: ["transition"],
  psiT: ["place"],
  psiP: ["transition"],
};

function App() {
  // ---- State ----
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [log, setLog] = useState([]);
  const [places, setPlaces] = useState(3);
  const [trans, setTrans] = useState(2);
  const [rule, setRule] = useState("psiA");
  const [target1, setTarget1] = useState("");
  const [target2, setTarget2] = useState("");

  // ---- Fetch current graph+log ----
  const fetchStatus = async () => {
    try {
      const r = await axios.get("/status");
      setGraph(r.data.graph);
      setLog(r.data.log);
    } catch (e) {
      console.warn("status fetch failed", e.message);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  // Clear targets whenever rule changes
  useEffect(() => {
    setTarget1("");
    setTarget2("");
  }, [rule]);

  // ---- Actions ----
  const init = async () => {
    try {
      const r = await axios.post("/init", {
        num_places: places,
        num_transitions: trans,
      });
      setGraph(r.data.graph);
      setLog(r.data.log);
    } catch (err) {
      // Show the entire payload FastAPI returned
      const detail =
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data, null, 2) ||
        err.message;
      alert("Init failed:\n" + detail);
      console.error("Init error:", err.response || err);
    }
  };

  const apply = async () => {
    try {
      const payload = { rule };
      if (ruleTargetCount[rule] >= 1) payload.target1 = target1;
      if (ruleTargetCount[rule] >= 2) payload.target2 = target2;
      const r = await axios.post("/apply", payload);
      setGraph(r.data.graph);
      setLog(r.data.log);
    } catch (err) {
      alert("Apply error:\n" + JSON.stringify(err.response?.data, null, 2));
    }
  };

  const undo = async () => {
    try {
      const r = await axios.post("/undo");
      setGraph(r.data.graph);
      setLog(r.data.log);
    } catch (err) {
      alert("Undo error:\n" + (err.response?.data || err.message));
    }
  };

  // Download log as CSV with Step numbers
  const downloadCSV = () => {
    const header = ["ID", "Step", "Action"];
    const rows = log.map((e, i) => [e.id, i + 1, e.action]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "process_log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Cytoscape elements & layout ----
  const elements = [
    ...graph.nodes.map((n) => ({
      data: {
        id: n.id,
        label: `${n.id}${n.type === "place" ? ` (${n.tokens})` : ""}`,
      },
      classes: n.type,
    })),
    ...graph.edges.map((e) => ({
      data: { source: e.source, target: e.target },
    })),
  ];
  const totalNodes = graph.nodes.length;

  // Only show legal nodes for the selected rule
  const legalNodes = graph.nodes.filter((n) =>
    ruleLegalTypes[rule].includes(n.type)
  );

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar Controls */}
      <div style={{ width: 250, padding: 10, borderRight: "1px solid #ddd" }}>
        <h3>Controls</h3>
        <div>
          <label>Places</label>
          <br />
          <input
            type="number"
            value={places}
            onChange={(e) => setPlaces(+e.target.value)}
          />
        </div>
        <div>
          <label>Transitions</label>
          <br />
          <input
            type="number"
            value={trans}
            onChange={(e) => setTrans(+e.target.value)}
          />
        </div>
        <button onClick={init}>Init Net</button>
        <hr />
        <div>
          <label>Rule</label>
          <br />
          <select value={rule} onChange={(e) => setRule(e.target.value)}>
            <option value="psiA">ψA</option>
            <option value="psiT">ψT</option>
            <option value="psiP">ψP</option>
            <option value="psiD">ψD</option>
          </select>
        </div>
        {ruleTargetCount[rule] >= 1 && (
          <div>
            <label>Target 1</label>
            <br />
            <select
              value={target1}
              onChange={(e) => setTarget1(e.target.value)}
            >
              <option value="">— select —</option>
              {legalNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id}
                </option>
              ))}
            </select>
          </div>
        )}
        {ruleTargetCount[rule] >= 2 && (
          <div>
            <label>Target 2</label>
            <br />
            <select
              value={target2}
              onChange={(e) => setTarget2(e.target.value)}
            >
              <option value="">— select —</option>
              {legalNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <button onClick={apply}>Apply</button>{" "}
        <button onClick={undo}>Undo</button>
      </div>

      {/* Graph Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <CytoscapeComponent
          elements={elements}
          style={{ width: "100%", height: "100%" }}
          layout={{
            name: "grid",
            rows: 1,
            cols: totalNodes || 1,
            spacingFactor: 2,
            avoidOverlap: true,
          }}
          stylesheet={[
            {
              selector: "node.place",
              style: {
                shape: "ellipse",
                "background-color": "#6FB1FC",
                label: "data(label)",
                "text-valign": "center",
                "text-halign": "center",
              },
            },
            {
              selector: "node.transition",
              style: {
                shape: "rectangle",
                "background-color": "#F5A45D",
                label: "data(label)",
                "text-valign": "center",
                "text-halign": "center",
              },
            },
            {
              selector: "edge",
              style: {
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                width: 3,
                "line-color": "#888",
              },
            },
          ]}
        />
      </div>

      {/* Action Log */}
      <div
        style={{
          width: 300,
          padding: 10,
          borderLeft: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <h3>Action Log</h3>
        <button onClick={downloadCSV}>Download Log CSV</button>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Step</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e, i) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{i + 1}</td>
                <td>{e.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
