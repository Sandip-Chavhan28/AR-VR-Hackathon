import React from "react";
import { useSimulationStore } from "../simulation/SimulationStore";

export default function EvaluationModal() {
  const evaluationResult = useSimulationStore((state) => state.evaluationResult);
  const resetSimulation = useSimulationStore((state) => state.resetSimulation);
  const telemetryHistory = useSimulationStore((state) => state.telemetryHistory);

  if (!evaluationResult) return null;

  const {
    success,
    finalVelocity,
    accuracy,
    maxG,
    fuelRemaining,
    fuelPercent,
    grade,
    debrief,
  } = evaluationResult;

  const velPass = parseFloat(finalVelocity) < 2.5;
  const accPass = parseFloat(accuracy) < 50.0;
  const gPass = parseFloat(maxG) < 5.0;

  // Export flight data as JSON/CSV
  const exportTelemetry = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(telemetryHistory, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mars_edl_telemetry_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(4, 6, 12, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "620px",
          background: "linear-gradient(145deg, #111827, #0b0f19)",
          border: success ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid rgba(239, 68, 68, 0.5)",
          borderRadius: "16px",
          boxShadow: success
            ? "0 0 50px rgba(16, 185, 129, 0.25)"
            : "0 0 50px rgba(239, 68, 68, 0.25)",
          padding: "32px",
          color: "#f3f4f6",
          fontFamily: "'Inter', sans-serif",
          position: "relative",
        }}
      >
        {/* Header Status */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 16px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "2px",
              textTransform: "uppercase",
              background: success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
              color: success ? "#34d399" : "#f87171",
              border: success ? "1px solid #10b981" : "1px solid #ef4444",
              marginBottom: "12px",
            }}
          >
            {success ? "TOUCHDOWN CONFIRMED" : "MISSION COMPROMISED"}
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily: "'Orbitron', sans-serif",
              fontSize: "26px",
              fontWeight: 900,
              letterSpacing: "1px",
              color: success ? "#10b981" : "#ef4444",
            }}
          >
            {success ? "PERSEVERANCE IS SAFE ON MARS!" : "EDL CRITICAL THRESHOLD VIOLATION"}
          </h1>

          <p style={{ margin: "8px 0 0 0", color: "#9ca3af", fontSize: "14px" }}>
            {debrief}
          </p>
        </div>

        {/* Grade Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "24px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px" }}>
              GN&C Autopilot Evaluation Grade
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#f9fafb", fontFamily: "'Orbitron', sans-serif", marginTop: "4px" }}>
              {grade}
            </div>
          </div>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
              border: success ? "2px solid #10b981" : "2px solid #ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 900,
              fontFamily: "'Orbitron', sans-serif",
              color: success ? "#34d399" : "#f87171",
            }}
          >
            {grade[0]}
          </div>
        </div>

        {/* 3 Core Success Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {/* 1. Vertical Velocity */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: velPass ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "10px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "11px", color: "#9ca3af" }}>TOUCHDOWN SPEED</div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: velPass ? "#10b981" : "#ef4444",
                marginTop: "4px",
              }}
            >
              {finalVelocity} m/s
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
              Limit &lt; 2.5 m/s {velPass ? "✓" : "✗"}
            </div>
          </div>

          {/* 2. Target Accuracy */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: accPass ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "10px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "11px", color: "#9ca3af" }}>TARGET ACCURACY</div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: accPass ? "#10b981" : "#ef4444",
                marginTop: "4px",
              }}
            >
              {accuracy} m
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
              Target &lt; 50 m {accPass ? "✓" : "✗"}
            </div>
          </div>

          {/* 3. Max G-Force */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: gPass ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "10px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "11px", color: "#9ca3af" }}>MAX G-LOAD</div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: gPass ? "#10b981" : "#ef4444",
                marginTop: "4px",
              }}
            >
              {maxG} G
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
              Limit &lt; 5.0 G {gPass ? "✓" : "✗"}
            </div>
          </div>
        </div>

        {/* Propellant Remaining Bar */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>
            <span>Hydrazine Retro-Propellant Remaining:</span>
            <span style={{ color: "#eab308", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {fuelRemaining} kg ({fuelPercent}%)
            </span>
          </div>
          <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(0, Math.min(100, fuelPercent))}%`,
                height: "100%",
                background: "linear-gradient(90deg, #eab308, #10b981)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={resetSimulation}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0284c7, #0369a1)",
              border: "none",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              fontFamily: "'Chakra Petch', sans-serif",
              letterSpacing: "1px",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(2, 132, 199, 0.4)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.target.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.target.style.transform = "scale(1.0)")}
          >
            ↻ REPLAY / RUN NEW MISSION
          </button>

          <button
            onClick={exportTelemetry}
            style={{
              padding: "14px 20px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "'Chakra Petch', sans-serif",
              cursor: "pointer",
            }}
          >
            ⤓ EXPORT TELEMETRY
          </button>
        </div>
      </div>
    </div>
  );
}
