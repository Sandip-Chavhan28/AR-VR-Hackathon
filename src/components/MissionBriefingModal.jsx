import React, { useState } from "react";
import { sounds } from "../audio/SoundEffects";

export default function MissionBriefingModal() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  const handleStart = () => {
    sounds.init();
    setIsOpen(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(3, 5, 10, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9998,
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "580px",
          background: "linear-gradient(145deg, #0f172a, #090d16)",
          border: "1px solid rgba(2, 132, 199, 0.4)",
          borderRadius: "16px",
          boxShadow: "0 0 50px rgba(2, 132, 199, 0.25)",
          padding: "30px",
          color: "#f8fafc",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              background: "rgba(225, 29, 72, 0.2)",
              color: "#fb7185",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              border: "1px solid rgba(225, 29, 72, 0.4)",
            }}
          >
            FLIGHT DIRECTIVE #EDL-2020
          </div>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>NASA JPL FLIGHT OPERATIONS</span>
        </div>

        <h2
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: "22px",
            fontWeight: 800,
            margin: "0 0 10px 0",
            color: "#38bdf8",
            letterSpacing: "0.5px",
          }}
        >
          MARS 2020: 7 MINUTES OF TERROR
        </h2>

        <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.6", margin: "0 0 18px 0" }}>
          Welcome to the high-fidelity 3-DoF Mars Entry, Descent, and Landing (EDL) flight simulation.
          Due to the 14-minute interplanetary communication lag to Earth, manual piloting is impossible.
          You are observing an <strong>autonomous GN&C flight system</strong> guiding the heavy lander and
          Perseverance rover through atmospheric aero-braking, supersonic parachute inflation, and sky crane powered touchdown.
        </p>

        {/* Mission Constraints Table */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "14px 16px",
            marginBottom: "20px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            fontSize: "12px",
          }}
        >
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase" }}>Target Coordinates</div>
            <div style={{ fontWeight: 600, color: "#f8fafc", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>
              Jezero Crater (18.38°N, 77.58°E)
            </div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase" }}>Landing Accuracy</div>
            <div style={{ fontWeight: 600, color: "#10b981", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>
              &lt; 50 Meter Radius Ellipse
            </div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase" }}>Touchdown Speed Limit</div>
            <div style={{ fontWeight: 600, color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>
              &lt; 2.5 m/s Vertical Velocity
            </div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase" }}>Structural G-Force Limit</div>
            <div style={{ fontWeight: 600, color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>
              &lt; 5.0 G Maximum Load
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          style={{
            width: "100%",
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
            boxShadow: "0 4px 18px rgba(2, 132, 199, 0.45)",
          }}
        >
          INITIATE ENTRY SEQUENCE 🚀
        </button>
      </div>
    </div>
  );
}
