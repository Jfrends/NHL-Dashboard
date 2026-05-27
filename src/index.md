---
toc: false
---

<style>
:root {
  --card-width: min(1200px, 95vw);
  --viz-height: 700px;
}

.page-header {
  max-width: var(--card-width);
  margin: 0 auto 10px auto;
  padding: 10px 0;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.page-subtitle {
  color: #666;
  font-size: 14px;
  margin-top: 6px;
}

#nhl-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

#nhl-dashboard {
  width: var(--card-width);
  height: var(--viz-height);
  padding: 0;
  border-radius: 12px;
  overflow: visible;
  box-shadow: 0 3px 12px rgba(0,0,0,0.08);
  background: white;
}

#chart-mount {
  width: 100%;
  height: 100%;
}

#nhl-dashboard input,
#nhl-dashboard select,
#nhl-dashboard textarea {
  background: white;
  color: #111;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 14px;
}

</style>

<div class="page-header">
  <h1>NHL Player Comparison Tool</h1>
  <div class="page-subtitle">
    Interactive shot, skater, goalie, and team comparison dashboard
  </div>
  <div class="page-subtitle">
    Repository: <a href="https://github.com/Jfrends/NHL-Dashboard">https://github.com/Jfrends/NHL-Dashboard</a>
  </div>
</div>

<div id="nhl-wrapper">
  <div id="nhl-dashboard" class="card">
    <div id="chart-mount"></div>
  </div>
</div>

```js
import * as aq from "npm:arquero";
import { initComparisonTool } from "./components/nhlTool.js";

/**
 * Load datasets
 */
const [shotRaw, playerRaw, goalieRaw, teamRaw] = await Promise.all([
  FileAttachment("shot_data_2025.csv").csv({ typed: true }),
  FileAttachment("skaters.csv").csv({ typed: true }),
  FileAttachment("goalies.csv").csv({ typed: true }),
  FileAttachment("teams.csv").csv({ typed: true })
]);

/**
 * Initialize visualization after DOM is ready
 */
setTimeout(() => {
  const container = document.querySelector("#chart-mount");

  if (!container) return;

  const width = container.getBoundingClientRect().width;
  const height = container.getBoundingClientRect().height;

  initComparisonTool(container, {
    shotData: aq.from(shotRaw).filter(d => d.shotWasOnGoal === 1 && d.isPlayoffGame == 0),
    playerData: aq.from(playerRaw),
    goalieData: aq.from(goalieRaw),
    teamData: aq.from(teamRaw)
  }, width, height);

}, 150);