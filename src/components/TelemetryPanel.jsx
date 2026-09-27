import React, { useState } from "react";
import { useSimulationStore } from "../simulation/SimulationStore";
import TelemetryCharts from "./TelemetryCharts";
import { sounds } from "../audio/SoundEffects";

export default function TelemetryPanel() {
  const [chartsCollapsed, setChartsCollapsed] = useState(false);
  const [disturbancesOpen, setDisturbancesOpen] = useState(false);

  const {
    altitude,
    speed,
    mach,
    gForce,
    maxGForce,
    dynamicPressure,
    temperature,
    throttle,
    fuel,
    fuelPercent,
    distanceToTarget,
    phase,
    timeElapsed,
    isPaused,
    timeWarp,
    cameraMode,
    missionControlMode,
    audioMuted,
    disturbances,
    eventsLog,
    radarLocked,
    parachuteDeployed,
    heatShieldAttached,
    roverSettled,
    setCameraMode,
    toggleMissionControl,
    toggleAudio,
    togglePause,
    setTimeWarp,
    resetSimulation,
    updateDisturbances,
  } = useSimulationStore();

  const mins = Math.floor(timeElapsed / 60);
  const secs = Math.floor(timeElapsed % 60);
  const missionTime = `T+ ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const phaseNames = {
    ENTRY: "HYPERSONIC AERO-BRAKING",
    PARACHUTE: "SUPERSONIC PARACHUTE",
    HEAT_SHIELD_DROP: "TRN RADAR SCANNING",
    POWERED: "POWERED DESCENT (RETRO-ROCKETS)",
    SKY_CRANE: "SKY CRANE MANEUVER",
    TOUCHDOWN: "ROVER TOUCHDOWN",
    COMPLETED: "MISSION DEBRIEF",
  };

  const cameraOptions = [
    { id: "CHASE", label: "🛰️ Chase Cam", desc: "Follow spacecraft" },
    { id: "BELLY_CAM", label: "🔍 TRN Belly Cam", desc: "Downward surface look" },
    { id: "CHUTE_CAM", label: "🪂 Chute Look-Up", desc: "Parachute canopy" },
    { id: "SKY_CRANE", label: "🏗️ Sky Crane", desc: "Rover tether lower" },
    { id: "GROUND", label: "🔴 Jezero Ground", desc: "Landing pad look-up" },
    { id: "FREE_ORBIT", label: "🌐 Free Orbit", desc: "Full 360° mouse drag" },
  ];

  const handleAudioToggle = () => {
    sounds.toggleMute();
    toggleAudio();
  };

  return (
    <>
      {/* TOP NAVIGATION & MISSION CLOCK BAR */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "56px",
          background: "linear-gradient(180deg, rgba(8, 12, 22, 0.95), rgba(8, 12, 22, 0.75))",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          zIndex: 100,
          color: "#e2e8f0",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Left: Mission Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #e11d48, #e05315)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "15px",
              color: "white",
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: "0 0 15px rgba(225, 29, 72, 0.5)",
            }}
          >
            M
          </div>
          <div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: "14px", letterSpacing: "1px", color: "#f8fafc" }}>
              NASA MARS EDL FLIGHT SIMULATOR
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>
              AUTONOMOUS 3-DoF GUIDANCE, NAVIGATION & CONTROL (GN&C)
            </div>
          </div>
        </div>

        {/* Center: Phase Badge & Mission Clock */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: "20px",
              background: phase === "TOUCHDOWN" || phase === "COMPLETED"
                ? "rgba(16, 185, 129, 0.2)"
                : "rgba(2, 132, 199, 0.2)",
              border: phase === "TOUCHDOWN" || phase === "COMPLETED"
                ? "1px solid #10b981"
                : "1px solid #0284c7",
              color: phase === "TOUCHDOWN" || phase === "COMPLETED" ? "#34d399" : "#38bdf8",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "1px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: phase === "TOUCHDOWN" || phase === "COMPLETED" ? "#10b981" : "#0284c7",
                boxShadow: "0 0 8px currentColor",
              }}
            />
            {phaseNames[phase] || phase}
          </div>

          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "16px",
              fontWeight: 700,
              color: "#fbbf24",
              background: "rgba(0,0,0,0.4)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(251, 191, 36, 0.3)",
            }}
          >
            {missionTime}
          </div>
        </div>

        {/* Right: Simulation Controls & Mode Switches */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Pause / Play */}
          <button
            onClick={togglePause}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              background: isPaused ? "#16a34a" : "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 600,
            }}
          >
            {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>

          {/* Time Warp (1x, 2x, 4x) */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: "6px", padding: "2px" }}>
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setTimeWarp(speed)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: timeWarp === speed ? "#0284c7" : "transparent",
                  border: "none",
                  color: timeWarp === speed ? "#ffffff" : "#94a3b8",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Audio Mute/Unmute */}
          <button
            onClick={handleAudioToggle}
            title={audioMuted ? "Unmute Sound" : "Mute Sound"}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              background: audioMuted ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {audioMuted ? "🔇" : "🔊"}
          </button>

          {/* Collaborative Mission Control Toggle */}
          <button
            onClick={toggleMissionControl}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              background: missionControlMode ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(255,255,255,0.1)",
              border: missionControlMode ? "1px solid #a855f7" : "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontSize: "12px",
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: missionControlMode ? "0 0 12px rgba(168, 85, 247, 0.4)" : "none",
            }}
          >
            {missionControlMode ? "🖥️ MISSION CONTROL [ACTIVE]" : "🖥️ MISSION CONTROL"}
          </button>

          {/* Restart */}
          <button
            onClick={resetSimulation}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#f87171",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 600,
            }}
          >
            ↻ RESTART
          </button>
        </div>
      </div>

      {/* LEFT AVIONICS GAUGES & DISTURBANCE DRAWER */}
      <div
        style={{
          position: "absolute",
          top: "70px",
          left: "20px",
          width: "290px",
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Core Flight Dynamics Digital Avionics */}
        <div
          style={{
            background: "rgba(10, 15, 26, 0.85)",
            backdropFilter: "blur(10px)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "16px",
            color: "#e2e8f0",
            fontFamily: "'Inter', sans-serif",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "6px" }}>
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#38bdf8" }}>
              FLIGHT TELEMETRY
            </span>
            <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
              3-DoF GN&C
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Altitude */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>ALTITUDE</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: 700, color: "#38bdf8" }}>
                  {altitude > 1000 ? (altitude / 1000).toFixed(2) : Math.round(altitude)}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "4px" }}>
                  {altitude > 1000 ? "km" : "m"}
                </span>
              </div>
            </div>

            {/* Velocity & Mach */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>VELOCITY</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: 700, color: "#f8fafc" }}>
                  {Math.round(speed)}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "4px" }}>m/s</span>
                <span style={{ fontSize: "11px", color: "#eab308", marginLeft: "8px", fontWeight: 600 }}>
                  M {mach.toFixed(1)}
                </span>
              </div>
            </div>

            {/* G-Force with 5G Warning */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>G-LOAD (MAX 5G)</span>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: gForce > 4.5 ? "#ef4444" : gForce > 3.0 ? "#f59e0b" : "#10b981",
                    }}
                  >
                    {gForce.toFixed(2)} G
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b", marginLeft: "6px" }}>
                    (Peak: {maxGForce.toFixed(1)}G)
                  </span>
                </div>
              </div>
              <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, (gForce / 5.0) * 100)}%`,
                    height: "100%",
                    background: gForce > 4.5 ? "#ef4444" : gForce > 3.0 ? "#f59e0b" : "#10b981",
                    transition: "width 0.1s linear",
                  }}
                />
              </div>
            </div>

            {/* Heat Shield Temp */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>HEAT SHIELD</span>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: temperature > 1200 ? "#ff4400" : temperature > 600 ? "#f97316" : "#cbd5e1",
                  }}
                >
                  {temperature}°C
                </span>
                <span style={{ fontSize: "10px", color: "#64748b", marginLeft: "4px" }}>
                  {heatShieldAttached ? "ABLATING" : "JETTISONED"}
                </span>
              </div>
            </div>

            {/* Retro-Rocket Throttle */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>DESCENT THROTTLE</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 700, color: throttle > 0 ? "#00e5ff" : "#64748b" }}>
                  {Math.round(throttle * 100)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${throttle * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0284c7, #00e5ff)",
                    transition: "width 0.1s linear",
                  }}
                />
              </div>
            </div>

            {/* Propellant Remaining */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>HYDRAZINE FUEL</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 700, color: "#eab308" }}>
                  {Math.round(fuel)} kg
                </span>
                <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "4px" }}>
                  ({Math.round(fuelPercent)}%)
                </span>
              </div>
            </div>

            {/* Target Distance */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>JEZERO TARGET RANGE</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 700, color: distanceToTarget < 50 ? "#10b981" : "#f1f5f9" }}>
                  {distanceToTarget > 1000 ? `${(distanceToTarget / 1000).toFixed(2)} km` : `${Math.round(distanceToTarget)} m`}
                </span>
                <span style={{ fontSize: "10px", color: distanceToTarget < 50 ? "#10b981" : "#64748b", marginLeft: "4px" }}>
                  {distanceToTarget < 50 ? "(IN ZONE)" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Environmental Hazards & Disturbances Controller */}
        <div
          style={{
            background: "rgba(10, 15, 26, 0.85)",
            backdropFilter: "blur(10px)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "14px 16px",
            color: "#e2e8f0",
          }}
        >
          <div
            onClick={() => setDisturbancesOpen(!disturbancesOpen)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#f59e0b" }}>
              ⚠️ ENVIRONMENTAL DISTURBANCES
            </span>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              {disturbancesOpen ? "▲" : "▼"}
            </span>
          </div>

          {disturbancesOpen && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px" }}>
              {/* Wind Shear Toggle & Speed */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "11px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={disturbances.windShear}
                      onChange={(e) => updateDisturbances({ windShear: e.target.checked })}
                    />
                    Wind Shear & Turbulence
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#38bdf8" }}>
                    {disturbances.windSpeed} m/s
                  </span>
                </div>
                {disturbances.windShear && (
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={disturbances.windSpeed}
                    onChange={(e) => updateDisturbances({ windSpeed: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "#0284c7" }}
                  />
                )}
              </div>

              {/* Dust Storm Hazard Toggle */}
              <div>
                <label style={{ fontSize: "11px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={disturbances.dustStorm}
                    onChange={(e) => updateDisturbances({ dustStorm: e.target.checked })}
                  />
                  Martian Dust Storm Hazard
                </label>
              </div>

              {/* Sensor Noise Toggle */}
              <div>
                <label style={{ fontSize: "11px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={disturbances.sensorNoise}
                    onChange={(e) => updateDisturbances({ sensorNoise: e.target.checked })}
                  />
                  Radar Altimeter & IMU Sensor Noise
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Camera Views Selector */}
        <div
          style={{
            background: "rgba(10, 15, 26, 0.85)",
            backdropFilter: "blur(10px)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "12px 14px",
            color: "#e2e8f0",
          }}
        >
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#cbd5e1", marginBottom: "8px" }}>
            CAMERA PERSPECTIVE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {cameraOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setCameraMode(opt.id)}
                title={opt.desc}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  background: cameraMode === opt.id ? "rgba(2, 132, 199, 0.4)" : "rgba(255, 255, 255, 0.05)",
                  border: cameraMode === opt.id ? "1px solid #0284c7" : "1px solid rgba(255, 255, 255, 0.08)",
                  color: cameraMode === opt.id ? "#ffffff" : "#94a3b8",
                  fontSize: "11px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: cameraMode === opt.id ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: LIVE TELEMETRY GRAPHS & EVENTS LOG */}
      <div
        style={{
          position: "absolute",
          top: "70px",
          right: "20px",
          width: "340px",
          maxHeight: "calc(100vh - 90px)",
          overflowY: "auto",
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Telemetry Charts (Alt vs Vel, Fuel, Heat) */}
        <div
          style={{
            background: "rgba(10, 15, 26, 0.88)",
            backdropFilter: "blur(12px)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "16px",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            onClick={() => setChartsCollapsed(!chartsCollapsed)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              marginBottom: chartsCollapsed ? "0" : "12px",
              userSelect: "none",
            }}
          >
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#00e5ff" }}>
              LIVE TELEMETRY PLOTS
            </span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {chartsCollapsed ? "SHOW GRAPHS ▼" : "COLLAPSE ▲"}
            </span>
          </div>

          {!chartsCollapsed && <TelemetryCharts height={105} />}
        </div>

        {/* Live NASA Flight Comms / Event Timeline */}
        <div
          style={{
            background: "rgba(10, 15, 26, 0.88)",
            backdropFilter: "blur(12px)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "14px 16px",
            maxHeight: "220px",
            overflowY: "auto",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#cbd5e1", marginBottom: "10px" }}>
            MISSION EVENT LOG & COMMS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {eventsLog.map((ev, i) => (
              <div
                key={i}
                style={{
                  fontSize: "11px",
                  lineHeight: "1.4",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: ev.type === "warning" ? "#fbbf24" : "#cbd5e1",
                  borderLeft: ev.type === "warning" ? "2px solid #fbbf24" : "2px solid #0284c7",
                  paddingLeft: "8px",
                }}
              >
                <span style={{ color: "#64748b", marginRight: "6px" }}>[{ev.time}]</span>
                {ev.text}
              </div>
            ))}
          </div>
        </div>

        {/* Collaborative Telemetry Review / Mission Control Subsystems Panel */}
        {missionControlMode && (
          <div
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(14px)",
              borderRadius: "12px",
              border: "1px solid #7c3aed",
              padding: "16px",
              boxShadow: "0 0 25px rgba(124, 58, 237, 0.3)",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#a855f7" }}>
                JPL FLIGHT DIRECTOR CONSOLE
              </span>
              <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 700 }}>
                ONLINE ●
              </span>
            </div>

            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px" }}>
              Collaborative Subsystem Health:
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 8px", borderRadius: "6px" }}>
                <div>Aeroshell PICA:</div>
                <div style={{ color: heatShieldAttached ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                  {heatShieldAttached ? "NOMINAL" : "JETTISONED"}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 8px", borderRadius: "6px" }}>
                <div>Supersonic Chute:</div>
                <div style={{ color: parachuteDeployed ? "#10b981" : "#64748b", fontWeight: 700 }}>
                  {parachuteDeployed ? "DEPLOYED" : "STOWED"}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 8px", borderRadius: "6px" }}>
                <div>TRN Radar Lock:</div>
                <div style={{ color: radarLocked ? "#10b981" : "#64748b", fontWeight: 700 }}>
                  {radarLocked ? "LOCKED (JEZERO)" : "SEARCHING"}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 8px", borderRadius: "6px" }}>
                <div>Rover Status:</div>
                <div style={{ color: roverSettled ? "#10b981" : "#38bdf8", fontWeight: 700 }}>
                  {roverSettled ? "TOUCHDOWN (SAFE)" : "ATTACHED"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}