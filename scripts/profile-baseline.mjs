import { chromium } from 'playwright';

async function runBenchmark() {
  console.log('=== MARS EDL SIMULATOR PERFORMANCE BENCHMARK ===');
  console.log('Launching browser with Chrome DevTools Protocol...');

  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Inject performance tracking hook before any scripts run
  await page.addInitScript(() => {
    window.__EDL_BENCHMARK__ = {
      active: false,
      records: [],
      frameTimes: [],
      substeps: [],
      physicsTimes: [],
      renderTimes: [],
      longTasks: [],
      lastTime: 0,
    };

    // Track Long Tasks via PerformanceObserver
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (window.__EDL_BENCHMARK__.active) {
            window.__EDL_BENCHMARK__.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.warn('LongTask observer not supported:', e);
    }
  });

  console.log('Navigating to simulator at http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Click INITIALIZE MISSION SIMULATION
  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) {
    console.log('Clicking INITIALIZE MISSION SIMULATION...');
    await startBtn.click();
    await page.waitForTimeout(1500);
  }

  // Hook into the page's Three.js / physics loop to measure per-frame metrics
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Intercept requestAnimationFrame for exact frame-to-frame timings
    const origRAF = window.requestAnimationFrame;
    let prevFrameTime = performance.now();

    window.requestAnimationFrame = function (cb) {
      return origRAF.call(window, function (timestamp) {
        const now = performance.now();
        const frameTime = now - prevFrameTime;
        prevFrameTime = now;

        if (window.__EDL_BENCHMARK__.active) {
          window.__EDL_BENCHMARK__.frameTimes.push(frameTime);
        }
        cb(timestamp);
      });
    };
  });

  const speeds = [0.5, 1, 5, 10, 50];
  const results = {};

  for (const speed of speeds) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Profiling playback speed: ${speed}x ...`);

    // Click exact matching speed button
    const speedBtnText = speed === 0.5 ? '0.5×' : `${speed}×`;
    await page.evaluate((btnText) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => b.textContent.trim() === btnText);
      if (target) {
        target.click();
      } else {
        console.warn('Could not find speed button for', btnText);
      }
    }, speedBtnText);

    // Allow 1 second warm-up for state stabilization
    await page.waitForTimeout(1000);

    // Start benchmark recording for 3.5 seconds
    await page.evaluate(() => {
      window.__EDL_BENCHMARK__.active = true;
      window.__EDL_BENCHMARK__.frameTimes = [];
      window.__EDL_BENCHMARK__.substeps = [];
      window.__EDL_BENCHMARK__.physicsTimes = [];
      window.__EDL_BENCHMARK__.longTasks = [];
    });

    await page.waitForTimeout(3500);

    // Stop recording and retrieve metrics
    const metrics = await page.evaluate((spd) => {
      window.__EDL_BENCHMARK__.active = false;
      const rawCount = window.__EDL_BENCHMARK__.frameTimes.length;
      const fts = window.__EDL_BENCHMARK__.frameTimes.slice(Math.min(5, Math.floor(rawCount / 2)));
      if (fts.length === 0) {
        return { error: 'No frames recorded', rawCount };
      }

      fts.sort((a, b) => a - b);
      const sum = fts.reduce((acc, v) => acc + v, 0);
      const avgFrame = sum / fts.length;
      const p95 = fts[Math.floor(fts.length * 0.95)] || avgFrame;
      const p99 = fts[Math.floor(fts.length * 0.99)] || avgFrame;
      const worst = fts[fts.length - 1];
      const avgFps = 1000 / avgFrame;

      // Memory info if available
      const mem = performance.memory ? {
        totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
        usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2),
      } : null;

      // Long tasks
      const lt = window.__EDL_BENCHMARK__.longTasks;
      const totalLongTaskTime = lt.reduce((acc, t) => acc + t.duration, 0);

      // WebGL stats from window.__EDL_STATS__
      const edlStats = window.__EDL_STATS__ || null;

      return {
        speed: spd,
        sampleCount: fts.length,
        avgFps: avgFps.toFixed(1),
        avgFrameMs: avgFrame.toFixed(2),
        p95Ms: p95.toFixed(2),
        p99Ms: p99.toFixed(2),
        worstMs: worst.toFixed(2),
        longTaskCount: lt.length,
        totalLongTaskTimeMs: totalLongTaskTime.toFixed(1),
        substeps: edlStats?.substeps ?? 'N/A',
        physicsMs: edlStats?.physicsMs?.toFixed?.(2) ?? 'N/A',
        drawCalls: edlStats?.drawCalls ?? 'N/A',
        triangles: edlStats?.triangles ?? 'N/A',
        mem,
      };
    }, speed);

    results[speed] = metrics;
    console.log(`Results for ${speed}x:`, JSON.stringify(metrics, null, 2));
  }

  // Test Rapid Switching: 0.5x -> 1x -> 5x -> 10x -> 50x -> 10x -> 5x -> 1x -> 0.5x
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Rapid Playback Speed Switching Stress Test...`);
  const switchSequence = [0.5, 1, 5, 10, 50, 10, 5, 1, 0.5];

  await page.evaluate(() => {
    window.__EDL_BENCHMARK__.active = true;
    window.__EDL_BENCHMARK__.frameTimes = [];
    window.__EDL_BENCHMARK__.longTasks = [];
  });

  for (const spd of switchSequence) {
    const speedBtnText = spd === 0.5 ? '0.5×' : `${spd}×`;
    await page.evaluate((btnText) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => b.textContent.trim() === btnText);
      if (target) target.click();
    }, speedBtnText);
    await page.waitForTimeout(400);
  }

  const switchMetrics = await page.evaluate(() => {
    window.__EDL_BENCHMARK__.active = false;
    const fts = window.__EDL_BENCHMARK__.frameTimes;
    if (fts.length === 0) return null;
    fts.sort((a, b) => a - b);
    const sum = fts.reduce((acc, v) => acc + v, 0);
    const avgFrame = sum / fts.length;
    const p95 = fts[Math.floor(fts.length * 0.95)] || avgFrame;
    const worst = fts[fts.length - 1];
    const avgFps = 1000 / avgFrame;
    const lt = window.__EDL_BENCHMARK__.longTasks;
    return {
      sampleCount: fts.length,
      avgFps: avgFps.toFixed(1),
      avgFrameMs: avgFrame.toFixed(2),
      p95Ms: p95.toFixed(2),
      worstMs: worst.toFixed(2),
      longTaskCount: lt.length,
      longTasks: lt,
    };
  });

  console.log('Rapid Speed Switching Results:', JSON.stringify(switchMetrics, null, 2));

  // Print Summary Table
  console.log('\n========================================================================================');
  console.log('BASELINE PERFORMANCE SUMMARY TABLE:');
  console.log('Speed | Avg FPS | Avg Frame (ms) | 95th% (ms) | Worst (ms) | Substeps | Phys (ms) | Long Tasks');
  console.log('------+---------+----------------+------------+------------+----------+-----------+-----------');
  for (const spd of speeds) {
    const m = results[spd];
    if (m) {
      console.log(
        `${String(m.speed).padEnd(5)} | ${String(m.avgFps).padStart(7)} | ${String(m.avgFrameMs).padStart(14)} | ${String(m.p95Ms).padStart(10)} | ${String(m.worstMs).padStart(10)} | ${String(m.substeps).padStart(8)} | ${String(m.physicsMs).padStart(9)} | ${String(m.longTaskCount).padStart(10)}`
      );
    }
  }
  console.log('========================================================================================\n');

  await browser.close();
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
