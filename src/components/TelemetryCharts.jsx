import React, { useRef, useEffect } from "react";
import { useSimulationStore } from "../simulation/SimulationStore";
import { VEHICLE } from "../simulation/Physics";

/**
 * High-Performance Canvas Telemetry Charts
 * Renders live:
 * 1. Altitude vs. Velocity (with safe EDL corridor bounds)
 * 2. Fuel vs. Time
 * 3. Heat & G-Force vs. Time
 */
export default function TelemetryCharts({ height = 120 }) {
  const altVelCanvasRef = useRef();
  const fuelCanvasRef = useRef();
  const heatCanvasRef = useRef();

  const telemetryHistory = useSimulationStore((state) => state.telemetryHistory);

  // 1. Altitude vs Velocity Chart
  useEffect(() => {
    const canvas = altVelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background & grid lines
    ctx.fillStyle = "rgba(10, 15, 25, 0.75)";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 15; y < h; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Nominal Entry Corridor Boundary (Green/Cyan envelope)
    ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(35, 15);
    ctx.bezierCurveTo(w * 0.4, 25, w * 0.7, h * 0.5, w - 10, h - 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText("65km", 4, 16);
    ctx.fillText("0km", 8, h - 8);
    ctx.fillText("0", 35, h - 4);
    ctx.fillText("6000 m/s", w - 48, h - 4);

    const data = telemetryHistory.altVsVel;
    if (data.length > 1) {
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2;
      ctx.beginPath();

      data.forEach((pt, i) => {
        // Map: Velocity (0 to 6000 m/s) -> X (35 to w - 10)
        // Map: Altitude (0 to 65000 m) -> Y (h - 15 to 15)
        const x = 35 + Math.min(1, Math.max(0, pt.vel / 6000)) * (w - 45);
        const y = (h - 15) - Math.min(1, Math.max(0, pt.alt / 65000)) * (h - 30);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw current point beacon
      const last = data[data.length - 1];
      const curX = 35 + Math.min(1, Math.max(0, last.vel / 6000)) * (w - 45);
      const curY = (h - 15) - Math.min(1, Math.max(0, last.alt / 65000)) * (h - 30);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [telemetryHistory.altVsVel]);

  // 2. Fuel vs Time Chart
  useEffect(() => {
    const canvas = fuelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(10, 15, 25, 0.75)";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let y = 15; y < h; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Axis Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText("100%", 4, 16);
    ctx.fillText("0%", 10, h - 8);

    const data = telemetryHistory.fuelVsTime;
    if (data.length > 1) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      data.forEach((pt, i) => {
        const x = 32 + (i / Math.max(1, data.length - 1)) * (w - 42);
        const fuelUsedPct = Math.min(100, Math.max(0, Number(pt.fuelUsedPct ?? 0)));
        const y = (h - 15) - (fuelUsedPct / 100) * (h - 28);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.beginPath();
      data.forEach((pt, i) => {
        const x = 32 + (i / Math.max(1, data.length - 1)) * (w - 42);
        const fuelUsedPct = Math.min(100, Math.max(0, Number(pt.fuelUsedPct ?? 0)));
        const y = (h - 15) - (fuelUsedPct / 100) * (h - 28);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(w - 10, h - 15);
      ctx.lineTo(32, h - 15);
      ctx.closePath();
      ctx.fillStyle = "rgba(234, 179, 8, 0.15)";
      ctx.fill();
    }
  }, [telemetryHistory.fuelVsTime]);

  // 3. Heat & G-Force vs Time Chart
  useEffect(() => {
    const canvas = heatCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(10, 15, 25, 0.75)";
    ctx.fillRect(0, 0, w, h);

    // 5G Warning Line
    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.setLineDash([3, 3]);
    const g5Y = (h - 15) - (5 / 7) * (h - 28);
    ctx.beginPath();
    ctx.moveTo(30, g5Y);
    ctx.lineTo(w, g5Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
    ctx.font = "8px 'JetBrains Mono', monospace";
    ctx.fillText("5G LIMIT", w - 46, g5Y - 3);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText("1800°C", 2, 16);
    ctx.fillText("0°C", 10, h - 8);

    const data = telemetryHistory.heatVsTime;
    if (data.length > 1) {
      // Draw Heat Curve (Orange/Red)
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.beginPath();
      data.forEach((pt, i) => {
        const x = 32 + (i / Math.max(1, data.length - 1)) * (w - 42);
        const y = (h - 15) - Math.min(1, Math.max(0, pt.heat / 1800)) * (h - 28);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw G-Force curve (Violet)
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      data.forEach((pt, i) => {
        const x = 32 + (i / Math.max(1, data.length - 1)) * (w - 42);
        const y = (h - 15) - Math.min(1, Math.max(0, pt.gForce / 7)) * (h - 28);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [telemetryHistory.heatVsTime]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* 1. Altitude vs Velocity */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>
          <span style={{ fontWeight: 600 }}>ALTITUDE vs. VELOCITY</span>
          <span style={{ color: "#00e5ff" }}>FLIGHT CORRIDOR</span>
        </div>
        <canvas
          ref={altVelCanvasRef}
          width={320}
          height={height}
          style={{ width: "100%", height: `${height}px`, borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* 2. Fuel vs Time */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>
          <span style={{ fontWeight: 600 }}>FUEL USAGE vs. TIME</span>
          <span style={{ color: "#eab308" }}>USED %</span>
        </div>
        <canvas
          ref={fuelCanvasRef}
          width={320}
          height={height - 20}
          style={{ width: "100%", height: `${height - 20}px`, borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* 3. Heat & G-Force vs Time */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>
          <span style={{ fontWeight: 600 }}>HEAT & G-LOAD vs. TIME</span>
          <span style={{ color: "#f97316" }}>TEMP (°C) <span style={{ color: "#a855f7" }}>| G</span></span>
        </div>
        <canvas
          ref={heatCanvasRef}
          width={320}
          height={height - 20}
          style={{ width: "100%", height: `${height - 20}px`, borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>
    </div>
  );
}
