import * as d3 from "npm:d3";
import { rinkMapComponent } from "./rinkMap.js";

export function initComparisonTool(container, { shotData, playerData, goalieData, teamData }, width) {
  container.innerHTML = "";
  
  const allShotsObjects = shotData.objects();
  const allSkaterObjects = playerData.objects();
  const allGoalieObjects = goalieData ? goalieData.objects() : [];
  const allTeamObjects = teamData ? teamData.objects() : [];

  const teamAbbrMap = {
    "Anaheim Ducks": "ANA", "Boston Bruins": "BOS", "Buffalo Sabres": "BUF",
    "Calgary Flames": "CGY", "Carolina Hurricanes": "CAR", "Chicago Blackhawks": "CHI",
    "Colorado Avalanche": "COL", "Columbus Blue Jackets": "CBJ", "Dallas Stars": "DAL",
    "Detroit Red Wings": "DET", "Edmonton Oilers": "EDM", "Florida Panthers": "FLA",
    "Los Angeles Kings": "LAK", "Minnesota Wild": "MIN", "Montreal Canadiens": "MTL",
    "Nashville Predators": "NSH", "New Jersey Devils": "NJD", "New York Islanders": "NYI",
    "New York Rangers": "NYR", "Ottawa Senators": "OTT", "Philadelphia Flyers": "PHI",
    "Pittsburgh Penguins": "PIT", "San Jose Sharks": "SJS", "Seattle Kraken": "SEA",
    "St. Louis Blues": "STL", "Tampa Bay Lightning": "TBL", "Toronto Maple Leafs": "TOR",
    "Utah Hockey Club": "UTA", "Vancouver Canucks": "VAN", "Vegas Golden Knights": "VGK",
    "Washington Capitals": "WSH", "Winnipeg Jets": "WPG"
  };

  const teamAbbrToName = Object.fromEntries(Object.entries(teamAbbrMap).map(([k, v]) => [v, k]));

  const uniqueSkaters = Array.from(new Set(allShotsObjects.map(d => d.shooterName).filter(name => name !== null && name !== undefined))).sort();
  const uniqueGoalies = Array.from(new Set(allShotsObjects.map(d => d.goalieNameForShot).filter(name => name !== null && name !== undefined))).sort();
  const uniqueTeamsNames = Object.keys(teamAbbrMap).sort();

  const currentWidth = width || container.clientWidth;

  const root = d3.create("div")
    .style("width", `${currentWidth}px`)
    .style("box-sizing", "border-box")
    .style("font-family", "system-ui, -apple-system, sans-serif")
    .style("background", "#ffffff")
    .style("padding", "20px")
    .style("border-radius", "8px")
    .style("border", "1px solid #eaeaea")
    .style("box-shadow", "0 4px 30px rgba(0,0,0,0.03)");

  let activeMode = "skater"; 
  let activeLeftPlayer = "";
  let activeRightPlayer = "";
  let activeGoalsOnly = false;
  let activeSituation = "all"; 
  
  let lastUpdatedSide = "filter";
  let previousShotIds = new Set();
  let previousLeftPlayer = "";
  let previousRightPlayer = "";

  const modeTabRow = root.append("div")
    .style("display", "flex")
    .style("gap", "4px")
    .style("margin-bottom", "16px")
    .style("border-bottom", "2px solid #e2e8f0")
    .style("padding-bottom", "1px");

  const modes = [
    { id: "skater", label: "Skater Comparison" },
    { id: "goalie", label: "Goalie Comparison" },
    { id: "team", label: "Team Offense Comparison" }
  ];

  modes.forEach(m => {
    const tab = modeTabRow.append("div")
      .text(m.label)
      .style("padding", "8px 16px")
      .style("font-size", "13.5px")
      .style("font-weight", "600")
      .style("cursor", "pointer")
      .style("color", m.id === activeMode ? "#2563eb" : "#64748b")
      .style("border-bottom", m.id === activeMode ? "2px solid #2563eb" : "2px solid transparent")
      .style("margin-bottom", "-2px")
      .style("transition", "all 0.15s ease");

    tab.on("click", function() {
      activeMode = m.id;
      activeLeftPlayer = "";
      activeRightPlayer = "";
      
      modeTabRow.selectAll("div")
        .style("color", "#64748b")
        .style("border-bottom", "2px solid transparent");

      d3.select(this)
        .style("color", "#2563eb")
        .style("border-bottom", "2px solid #2563eb");

      const isSkater = activeMode === "skater";
      const isGoalie = activeMode === "goalie";
      
      root.select(".left-search-label").text(isSkater ? "Left Attacking Shooter" : isGoalie ? "Left Defending Goalie" : "Left Attacking Team");
      root.select(".left-search-input").attr("placeholder", isSkater ? "Search left player..." : isGoalie ? "Search left goalie..." : "Search left franchise name...").property("value", "");
      root.select(".right-search-label").text(isSkater ? "Right Attacking Shooter" : isGoalie ? "Right Defending Goalie" : "Right Attacking Team");
      root.select(".right-search-input").attr("placeholder", isSkater ? "Search right player..." : isGoalie ? "Search right goalie..." : "Search right franchise name...").property("value", "");

      lastUpdatedSide = "filter";
      updateDashboard();
    });
  });

  const topFilterRow = root.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("margin-bottom", "15px")
    .style("background", "#f8fafc")
    .style("padding", "10px 16px")
    .style("border-radius", "8px")
    .style("border", "1px solid #e2e8f0");

  const situationGroup = topFilterRow.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "12px");

  situationGroup.append("span")
    .style("font-size", "12.5px")
    .style("font-weight", "600")
    .style("color", "#475569")
    .text("Situation:");

  const radioContainer = situationGroup.append("div")
    .style("display", "flex")
    .style("background", "#e2e8f0")
    .style("padding", "2px")
    .style("border-radius", "6px");

  const situations = [
    { id: "all", label: "All Situations" },
    { id: "evenStrength", label: "Even Strength" },
    { id: "powerPlay", label: "Power Play" }
  ];

  situations.forEach((sit) => {
    const label = radioContainer.append("label")
      .style("padding", "6px 12px")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("cursor", "pointer")
      .style("border-radius", "4px")
      .style("background", sit.id === activeSituation ? "#fff" : "transparent")
      .style("color", sit.id === activeSituation ? "#0f172a" : "#64748b")
      .style("box-shadow", sit.id === activeSituation ? "0 1px 2px rgba(0,0,0,0.05)" : "none")
      .style("transition", "all 0.15s ease")
      .style("user-select", "none");

    const input = label.append("input")
      .attr("type", "radio")
      .attr("name", "situation-radio-filter")
      .attr("value", sit.id)
      .property("checked", sit.id === activeSituation)
      .style("display", "none");

    label.append("span").text(sit.label);

    input.on("change", function() {
      activeSituation = this.value;
      lastUpdatedSide = "filter";
      
      radioContainer.selectAll("label")
        .style("background", "transparent")
        .style("color", "#64748b")
        .style("box-shadow", "none");
        
      d3.select(this.parentNode)
        .style("background", "#fff")
        .style("color", "#0f172a")
        .style("box-shadow", "0 1px 2px rgba(0,0,0,0.05)");
        
      updateDashboard();
    });
  });

  const toggleWrapper = topFilterRow.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "8px")
    .style("background", "#fff")
    .style("padding", "6px 12px")
    .style("border-radius", "6px")
    .style("border", "1px solid #cbd5e1")
    .style("cursor", "pointer");

  toggleWrapper.html(`
    <input type="checkbox" id="embed-goals-only" style="width: 15px; height: 15px; cursor: pointer; margin: 0;">
    <label for="embed-goals-only" style="font-size: 12.5px; font-weight: 600; color: #334155; cursor: pointer; user-select: none;">Show Goals Only</label>
  `);

  toggleWrapper.node().querySelector("input").onchange = (e) => {
    activeGoalsOnly = e.target.checked;
    lastUpdatedSide = "filter";
    updateDashboard();
  };

  const controlToolbar = root.append("div")
    .style("display", "flex")
    .style("gap", "20px")
    .style("margin-bottom", "15px");

  function appendSearchSelector(parentDiv, isLeft) {
    const wrapper = parentDiv.append("div")
      .style("position", "relative")
      .style("flex", "1")
      .style("box-sizing", "border-box");

    wrapper.html(`
    <label class="${isLeft ? 'left-search-label' : 'right-search-label'}"
      style="font-weight: 600; display: block; margin-bottom: 6px; font-size: 13px; color: #475569;">
      ${isLeft ? "Left Attacking Shooter" : "Right Attacking Shooter"}
    </label> 
    <input type="text" class="${isLeft ? 'left-search-input' : 'right-search-input'}" placeholder="Search left player..." autocomplete="off" 
      style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13.5px; outline: none; background: #fff; transition: border-color 0.15s ease;">
    <div class="dropdown-menu" style="position: absolute; left: 0; right: 0; top: 100%; z-index: 3000; display: none; max-height: 180px; overflow-y: auto; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-top: 4px;"></div>`);

    const wrapperNode = wrapper.node();
    const input = wrapperNode.querySelector("input");
    const menu = wrapperNode.querySelector(".dropdown-menu");

    input.onfocus = () => { input.style.borderColor = "#94a3b8"; };
    input.onblur = () => { input.style.borderColor = "#cbd5e1"; };

    function renderDropdown(filterText) {
      menu.innerHTML = "";
      const sourceList = activeMode === "skater" ? uniqueSkaters : activeMode === "goalie" ? uniqueGoalies : uniqueTeamsNames;
      const matches = sourceList.filter(name => name.toLowerCase().includes(filterText.toLowerCase()));

      if (matches.length === 0 || filterText === "") {
        menu.style.display = "none";
        return;
      }

      matches.forEach(name => {
        const item = document.createElement("div");
        Object.assign(item.style, { padding: "8px 12px", cursor: "pointer", fontSize: "13.5px", color: "#1e293b", fontFamily: "inherit" });
        item.textContent = name;
        item.onmouseover = () => item.style.background = "#f8fafc";
        item.onmouseout = () => item.style.background = "white";
        
        item.onclick = () => {
          input.value = name;
          menu.style.display = "none";
          
          const mappedNameToken = activeMode === "team" ? teamAbbrMap[name] : name;

          if (isLeft) {
            activeLeftPlayer = mappedNameToken;
            lastUpdatedSide = "left";
          } else {
            activeRightPlayer = mappedNameToken;
            lastUpdatedSide = "right";
          }
          updateDashboard(); 
        };
        menu.appendChild(item);
      });
      menu.style.display = "block";
    }

    input.oninput = (e) => {
      const val = e.target.value;
      const sourceList = activeMode === "skater" ? uniqueSkaters : activeMode === "goalie" ? uniqueGoalies : uniqueTeamsNames;
      const exactMatch = sourceList.find(p => p.toLowerCase() === val.toLowerCase());
      
      let mappedMatchToken = exactMatch || "";
      if (exactMatch && activeMode === "team") {
        mappedMatchToken = teamAbbrMap[exactMatch];
      }

      if (isLeft) {
        activeLeftPlayer = mappedMatchToken; 
        lastUpdatedSide = "left";
      } else {
        activeRightPlayer = mappedMatchToken;
        lastUpdatedSide = "right";
      }
      renderDropdown(val);
      updateDashboard();
    };

    input.onfocus = (e) => renderDropdown(e.target.value);
    document.addEventListener("click", (e) => { if (!wrapperNode.contains(e.target)) menu.style.display = "none"; });
  }

  appendSearchSelector(controlToolbar, true);
  appendSearchSelector(controlToolbar, false);

  const profileBanner = root.append("div")
    .style("display", "flex")
    .style("gap", "20px")
    .style("margin-bottom", "15px");

  const rinkWrapper = root.append("div")
    .style("position", "relative")
    .style("width", "100%")
    .style("box-sizing", "border-box");

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const rinkWidthPixels = currentWidth - margin.left - margin.right - 40; 
  const rinkHeightPixels = rinkWidthPixels * (85 / 200); 
  const height = rinkHeightPixels + margin.top + margin.bottom;

  const svg = rinkWrapper.append("svg").attr("width", "100%").attr("height", height).style("background-color", "#fafafa").style("border-radius", "4px");
  
  const tooltip = rinkWrapper.append("div")
    .style("position", "absolute").style("visibility", "hidden")
    .style("background-color", "rgba(15, 23, 42, 0.96)").style("color", "#fff").style("padding", "12px 16px")
    .style("border-radius", "6px").style("font-size", "13px").style("pointer-events", "none")
    .style("box-shadow", "0 6px 20px rgba(15, 23, 42, 0.15)").style("z-index", "4000").style("min-width", "220px");

  svg.append("style").text(`
    .rink-face { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.2px; } 
    .center-line { fill: #f87171; opacity: 0.6; } 
    .blue-line { fill: #0033A0; opacity: 0.6; }
    .red-line { fill: #f87171; stroke: #f87171; opacity: 0.6; } 
    .red-faceoff { stroke: #f87171; fill: none; opacity: 0.5; }
    .neutral-faceoff { stroke: #94a3b8; fill: none; opacity: 0.4; } 
    .goal-crease { stroke: #f87171; fill: #f8fafc; opacity: 0.7; }
  `);

  const rinkGroup = svg.append("g");
  const drawRink = rinkMapComponent({
    parent: rinkGroup, desiredWidth: rinkHeightPixels, fullRink: true, horizontal: true, showDanger: false,
    margins: { top: margin.top, bottom: margin.bottom, left: margin.left, right: margin.right }
  });
  drawRink();

  const heatmapContainer = svg.append("g").attr("class", "heatmap-container");
  const shotContainer = svg.append("g").attr("class", "shots-container");

  const xScale = d3.scaleLinear().domain([-100, 100]).range([margin.left, rinkWidthPixels + margin.left]);
  const yScale = d3.scaleLinear().domain([-42.5, 42.5]).range([margin.top, rinkHeightPixels + margin.top]);

  const COLOR_GOAL_OFFENSE = "#0fa968"; 
  const COLOR_GOAL_DEFENSE = "#ef4444"; 
  const COLOR_REBOUND = "#f59e0b";       
  const COLOR_FREEZE = "#38bdf8";        
  const COLOR_SAVE_SKATER = "#94a3b8";  
  const COLOR_SAVE_GOALIE = "#10b981";  

  const legendRow = root.append("div")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("gap", "24px")
    .style("margin-top", "15px")
    .style("padding-top", "12px")
    .style("border-top", "1px solid #f1f5f9");

  function updateDashboard() {
    profileBanner.html("");
    legendRow.html("");

    const schemaSitMap = { 
      "all": ["all"], 
      "evenStrength": ["5on5", "4on4", "3on3"], 
      "powerPlay": ["5on4", "4on3"] 
    };
    const targetSituations = schemaSitMap[activeSituation];

    const filterDbRows = (name, dbObjects) => {
      if (name === "") return [];
      const fieldMatch = activeMode === "team" ? "team" : "name";
      return dbObjects.filter(d => d[fieldMatch]?.toLowerCase() === name.toLowerCase() && targetSituations.includes(d.situation));
    };

    const leftDbRows = activeMode === "skater" ? filterDbRows(activeLeftPlayer, allSkaterObjects) : activeMode === "goalie" ? filterDbRows(activeLeftPlayer, allGoalieObjects) : filterDbRows(activeLeftPlayer, allTeamObjects);
    const rightDbRows = activeMode === "skater" ? filterDbRows(activeRightPlayer, allSkaterObjects) : activeMode === "goalie" ? filterDbRows(activeRightPlayer, allGoalieObjects) : filterDbRows(activeRightPlayer, allTeamObjects);

    let baseLeft = [];
    let baseRight = [];

    if (activeMode === "skater") {
      baseLeft = activeLeftPlayer !== "" ? allShotsObjects.filter(d => d.shooterName?.toLowerCase() === activeLeftPlayer.toLowerCase() && d.shotWasOnGoal === 1) : [];
      baseRight = activeRightPlayer !== "" ? allShotsObjects.filter(d => d.shooterName?.toLowerCase() === activeRightPlayer.toLowerCase() && d.shotWasOnGoal === 1) : [];
    } else if (activeMode === "goalie") {
      baseLeft = activeLeftPlayer !== "" ? allShotsObjects.filter(d => d.goalieNameForShot && d.goalieNameForShot.toLowerCase() === activeLeftPlayer.toLowerCase() && d.shotWasOnGoal === 1) : [];
      baseRight = activeRightPlayer !== "" ? allShotsObjects.filter(d => d.goalieNameForShot && d.goalieNameForShot.toLowerCase() === activeRightPlayer.toLowerCase() && d.shotWasOnGoal === 1) : [];
    } else {
      baseLeft = activeLeftPlayer !== "" ? allShotsObjects.filter(d => d.teamCode?.toLowerCase() === activeLeftPlayer.toLowerCase() && d.shotWasOnGoal === 1) : [];
      baseRight = activeRightPlayer !== "" ? allShotsObjects.filter(d => d.teamCode?.toLowerCase() === activeRightPlayer.toLowerCase() && d.shotWasOnGoal === 1) : [];
    }

    const shotFilter = (d) => {
      if (activeSituation === "all") return true;
      const sK = d.isHomeTeam === 1 ? d.homeSkatersOnIce : d.awaySkatersOnIce;
      const dK = d.isHomeTeam === 1 ? d.awaySkatersOnIce : d.homeSkatersOnIce;
      
      if (activeSituation === "evenStrength") {
        return (sK === 5 && dK === 5) || (sK === 4 && dK === 4) || (sK === 3 && dK === 3);
      }
      if (activeSituation === "powerPlay") {
        return sK > dK;
      }
      return true;
    };

    baseLeft = baseLeft.filter(shotFilter);
    baseRight = baseRight.filter(shotFilter);

    let plottedLeftShots = [...baseLeft];
    let plottedRightShots = [...baseRight];

    if (activeGoalsOnly) {
      plottedLeftShots = plottedLeftShots.filter(d => d.goal === 1);
      plottedRightShots = plottedRightShots.filter(d => d.goal === 1);
    }

    const leftId = baseLeft.length > 0 ? (activeMode === "skater" ? baseLeft[0].shooterPlayerId : activeMode === "goalie" ? baseLeft[0].goalieIdForShot : null) : null;
    const rightId = baseRight.length > 0 ? (activeMode === "skater" ? baseRight[0].shooterPlayerId : activeMode === "goalie" ? baseRight[0].goalieIdForShot : null) : null;

    const leftHandedness = baseLeft.length > 0 ? (baseLeft[0].shooterLeftRight || "N/A") : "N/A";
    const rightHandedness = baseRight.length > 0 ? (baseRight[0].shooterLeftRight || "N/A") : "N/A";

    function computeLiveCardStats(shots, dbRows) {
      if (dbRows.length === 0 && shots.length === 0) return null;
      
      const gp = d3.max(dbRows, d => d.games_played) || 0;
      const icetime = d3.sum(dbRows, d => d.icetime) || 0;

      if (activeMode === "skater") {
        const goals = shots.filter(d => d.goal === 1).length;
        const sog = shots.length;
        const shPct = sog > 0 ? (goals / sog) * 100 : 0;
        const assists = d3.sum(dbRows, d => (d.I_F_primaryAssists || 0) + (d.I_F_secondaryAssists || 0));
        const points = goals + assists;
        return { type: "skater", goals, assists, points, gp, sog, shPct, icetime };
      } else if (activeMode === "goalie") {
        const shotsFaced = shots.length;
        const goalsAllowed = shots.filter(d => d.goal === 1).length;
        const saves = shotsFaced - goalsAllowed;
        const svPct = shotsFaced > 0 ? (saves / shotsFaced) : 0;
        const minsPlayed = icetime / 60;
        const gaa = minsPlayed > 0 ? (goalsAllowed * 60) / minsPlayed : 0;
        return { type: "goalie", shotsFaced, goalsAllowed, saves, svPct, gp, icetime, gaa };
      } else {
        const goalsFor = shots.filter(d => d.goal === 1).length;
        const shotsFor = shots.length;
        const shPct = shotsFor > 0 ? (goalsFor / shotsFor) * 100 : 0;
        
        const totalCorsiSeconds = d3.sum(dbRows, d => (d.corsiPercentage || 0) * (d.icetime || 1));
        const totalSeconds = d3.sum(dbRows, d => d.icetime) || 1;
        const rawProportion = totalCorsiSeconds / totalSeconds;
        const corsiPercentage = rawProportion <= 1.0 ? rawProportion : rawProportion / 100;

        return { type: "team", goalsFor, shotsFor, shPct, corsiPercentage, gp };
      }
    }

    const leftStats = computeLiveCardStats(baseLeft, leftDbRows);
    const rightStats = computeLiveCardStats(baseRight, rightDbRows);

    function getAvgTOIString(icetime, gp) {
      if (!gp || !icetime) return "0:00";
      const totalAvgMinutes = (icetime / 60) / gp;
      const mins = Math.floor(totalAvgMinutes);
      const secs = Math.round((totalAvgMinutes - mins) * 60);
      const safeMins = secs === 60 ? mins + 1 : mins;
      const safeSecs = secs === 60 ? 0 : secs;
      return `${safeMins}:${safeSecs < 10 ? '0' : ''}${safeSecs}`;
    }

    function getColorStyle(valLeft, valRight, isLeftCard, higherIsBetter = true) {
      if (activeLeftPlayer === "" || activeRightPlayer === "") return "color: #1e293b;";
      if (!leftStats || !rightStats || valLeft === undefined || valRight === undefined || valLeft === valRight) return "color: #1e293b;";
      const leftWins = higherIsBetter ? valLeft > valRight : valLeft < valRight;
      if (isLeftCard) return leftWins ? "color: #10b981; font-weight: bold;" : "color: #64748b; font-weight: normal;";
      return !leftWins ? "color: #10b981; font-weight: bold;" : "color: #64748b; font-weight: normal;";
    }

    function createProfileCardHTML(dbRows, stats, pId, playerName, handedness, isLeftCard, placeholderText) {
      if (playerName === "") return `<div style="display: flex; align-items: center; justify-content: center; height: 72px; border: 1px dashed #cbd5e1; border-radius: 6px; background: #f8fafc; color: #94a3b8; font-style: italic; font-size: 13px; padding: 10px 14px; box-sizing: border-box; width:100%;">${placeholderText}</div>`;
      
      const isLeftDataBest = isLeftCard; 
      const lS = leftStats;
      const rS = rightStats;
      const firstRow = dbRows[0];
      const displayTitle = activeMode === "team" ? (teamAbbrToName[playerName.toUpperCase()] || playerName.toUpperCase()) : (firstRow ? firstRow.name : playerName);
      const displayTeam = firstRow ? String(firstRow.team).toUpperCase().trim() : playerName.toUpperCase();

      const gp = stats ? stats.gp : 0;
      const icetime = stats ? stats.icetime : 0;
      const avgTOILeft = leftStats?.gp > 0 ? (leftStats.icetime / leftStats.gp) : 0;
      const avgTOIRight = rightStats?.gp > 0 ? (rightStats.icetime / rightStats.gp) : 0;

      if (activeMode === "skater") {
        return `
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center; height: 72px; box-sizing: border-box; overflow: hidden; width:100%;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; background: #f1f5f9; border-radius: 50%; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; border: 1px solid #e2e8f0;">
                ${pId ? `<img src="https://assets.nhle.com/mugs/nhl/latest/${pId}.png" style="width: 56px; height: auto; transform: translateY(4px);" onerror="this.style.display='none';">` : `<span style="font-size:20px; color:#cbd5e1; transform:translateY(8px)">👤</span>`}
              </div>
              <div>
                <div style="font-weight: bold; font-size: 15.5px; color: #0f172a; display: flex; align-items: center; gap: 6px; line-height: 1.2;">
                  <span>${displayTitle}</span>
                  ${firstRow ? `<img src="https://assets.nhle.com/logos/nhl/svg/${displayTeam}_light.svg" style="width: 30px; height: 30px; object-fit: contain;">` : ""}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 3px;">${firstRow?.position || "Skater"} • Shoots ${handedness}</div>
              </div>
            </div>
            <div style="display: flex; gap: 14px; text-align: center; border-left: 1px solid #e2e8f0; padding-left: 14px; height: 36px; align-items: center;">
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">G</div><div style="font-size: 14px; ${getColorStyle(lS?.goals, rS?.goals, isLeftDataBest)}">${stats.goals}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">A</div><div style="font-size: 14px; ${getColorStyle(lS?.assists, rS?.assists, isLeftDataBest)}">${stats.assists}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">PTS</div><div style="font-size: 14px; ${getColorStyle(lS?.points, rS?.points, isLeftDataBest)}">${stats.points}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">GP</div><div style="font-size: 14px; ${getColorStyle(lS?.gp, rS?.gp, isLeftDataBest)}">${gp}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">SOG</div><div style="font-size: 14px; ${getColorStyle(lS?.sog, rS?.sog, isLeftDataBest)}">${stats.sog}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600; white-space: nowrap;">SH%</div><div style="font-size: 14px; ${getColorStyle(lS?.shPct, rS?.shPct, isLeftDataBest)}">${stats.shPct.toFixed(1)}%</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600; white-space: nowrap;">TOI/G</div><div style="font-size: 12.5px; ${getColorStyle(avgTOILeft, avgTOIRight, isLeftDataBest)}">${getAvgTOIString(icetime, gp)}</div></div>
            </div>
          </div>`;
      } else if (activeMode === "goalie") {
        const formattedSvPct = stats?.svPct > 0 ? (stats.svPct >= 1 ? "1.000" : stats.svPct.toFixed(3).substring(1)) : ".000";
        return `
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center; height: 72px; box-sizing: border-box; overflow: hidden; width:100%;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; background: #f1f5f9; border-radius: 50%; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; border: 1px solid #e2e8f0;">
                ${pId ? `<img src="https://assets.nhle.com/mugs/nhl/latest/${pId}.png" style="width: 56px; height: auto; transform: translateY(4px);" onerror="this.style.display='none';">` : `<span style="font-size:20px; color:#cbd5e1; transform:translateY(8px)">👤</span>`}
              </div>
              <div>
                <div style="font-weight: bold; font-size: 15.5px; color: #0f172a; display: flex; align-items: center; gap: 6px; line-height: 1.2;">
                  <span>${displayTitle}</span>
                  ${firstRow ? `<img src="https://assets.nhle.com/logos/nhl/svg/${displayTeam}_light.svg" style="width: 20px; height: 20px; object-fit: contain;">` : ""}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 3px;">Goalie Performance</div>
              </div>
            </div>
            <div style="display: flex; gap: 18px; text-align: center; border-left: 1px solid #e2e8f0; padding-left: 18px; height: 36px; align-items: center;">
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">GP</div><div style="font-size: 14px; color:#1e293b;">${gp}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">SA</div><div style="font-size: 14px; color:#1e293b;">${stats.shotsFaced}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">GA</div><div style="font-size: 14px; ${getColorStyle(lS?.goalsAllowed, rS?.goalsAllowed, isLeftDataBest, false)}">${stats.goalsAllowed}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600; white-space: nowrap;">SV%</div><div style="font-size: 14px; ${getColorStyle(lS?.svPct, rS?.svPct, isLeftDataBest)}">${formattedSvPct}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600; white-space: nowrap;">GAA</div><div style="font-size: 14px; ${getColorStyle(lS?.gaa, rS?.gaa, isLeftDataBest, false)}">${stats.gaa.toFixed(2)}</div></div>
            </div>
          </div>`;
      } else {
        const goalsFor = stats ? stats.goalsFor : 0;
        const shotsFor = stats ? stats.shotsFor : 0;
        const shPct = stats ? stats.shPct : 0;
        const corsiPercentage = stats ? stats.corsiPercentage : 0;

        return `
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center; height: 72px; box-sizing: border-box; overflow: hidden; width:100%;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; display: flex; justify-content: center; align-items: center;">
                <img src="https://assets.nhle.com/logos/nhl/svg/${displayTeam}_light.svg" style="width: 48px; height: 48px; object-fit: contain;" onerror="this.parentNode.innerHTML='🏒';">
              </div>
              <div>
                <div style="font-weight: bold; font-size: 16.5px; color: #0f172a; line-height: 1.2;">${displayTitle}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 3px;">Team Offense • GP: ${gp}</div>
              </div>
            </div>
            <div style="display: flex; gap: 24px; text-align: center; border-left: 1px solid #e2e8f0; padding-left: 24px; height: 36px; align-items: center;">
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">GF</div><div style="font-size: 14px; ${getColorStyle(lS?.goalsFor, rS?.goalsFor, isLeftDataBest)}">${goalsFor}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">SF</div><div style="font-size: 14px; color:#1e293b;">${shotsFor}</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600;">SH%</div><div style="font-size: 14px; ${getColorStyle(lS?.shPct, rS?.shPct, isLeftDataBest)}">${shPct.toFixed(1)}%</div></div>
              <div><div style="font-size: 9px; color: #94a3b8; font-weight:600; white-space: nowrap;">CORSI %</div><div style="font-size: 14px; ${getColorStyle(lS?.corsiPercentage, rS?.corsiPercentage, isLeftDataBest)}">${corsiPercentage.toFixed(3).substring(1)}</div></div>
            </div>
          </div>`;
      }
    }

    profileBanner.html(`
      <div style="flex: 1; display: flex; box-sizing: border-box;">${createProfileCardHTML(leftDbRows, leftStats, leftId, activeLeftPlayer, leftHandedness, true, activeMode === "skater" ? "Select left shooter to view overview stats" : activeMode === "goalie" ? "Select left defending goalie" : "Select left team analytics code")}</div>
      <div style="flex: 1; display: flex; box-sizing: border-box;">${createProfileCardHTML(rightDbRows, rightStats, rightId, activeRightPlayer, rightHandedness, false, activeMode === "skater" ? "Select right shooter to view overview stats" : activeMode === "goalie" ? "Select right defending goalie" : "Select right team analytics code")}</div>
    `);

    const leftShots = plottedLeftShots.map(d => ({ 
      ...d, 
      side: "left", 
      displayX: -Math.abs(d.arenaAdjustedXCordABS), 
      displayY: d.arenaAdjustedYCord
    }));
    
    const rightShots = plottedRightShots.map(d => ({ 
      ...d, 
      side: "right", 
      displayX: Math.abs(d.arenaAdjustedXCordABS), 
      displayY: -d.arenaAdjustedYCord
    }));
    const combinedShots = [...leftShots, ...rightShots];

    let combinedContours = [];
    const minShotsForHeatmap = 3;

    const densityEstimator = d3.contourDensity()
      .x(d => xScale(d.displayX))
      .y(d => yScale(d.displayY))
      .size([currentWidth, height])
      .bandwidth(14) 
      .thresholds(10);

    if (combinedShots.length > 4) {
      if (leftShots.length >= minShotsForHeatmap) {
        const leftMax = d3.max(densityEstimator(leftShots), c => c.value) || 1;
        const leftColorScale = d3.scaleSequential(d3.interpolateReds).domain([0, leftMax]);
        densityEstimator(leftShots).forEach((contour, idx) => {
          combinedContours.push({ contour, id: `left-${idx}`, side: "left", fill: leftColorScale(contour.value) });
        });
      }
      if (rightShots.length >= minShotsForHeatmap) {
        const rightMax = d3.max(densityEstimator(rightShots), c => c.value) || 1;
        const rightColorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, rightMax]);
        densityEstimator(rightShots).forEach((contour, idx) => {
          combinedContours.push({ contour, id: `right-${idx}`, side: "right", fill: rightColorScale(contour.value) });
        });
      }
    }

    const contourNodes = heatmapContainer.selectAll("path")
      .data(combinedContours, d => d.id);

    contourNodes.join(
      enter => enter.append("path")
        .attr("d", d => d3.geoPath()(d.contour))
        .attr("fill", d => d.fill)
        .style("pointer-events", "none")
        .attr("opacity", 0)
        .call(enterTransition => enterTransition.transition()
          .duration(900)
          .ease(d3.easeCubicOut)
          .attr("opacity", 0.08)
        ),
      
      update => update
        .call(updateTransition => {
          updateTransition.attr("d", d => d3.geoPath()(d.contour))
            .attr("fill", d => d.fill)
            .attr("opacity", 0.08);
        }),

      exit => exit
        .call(exitTransition => exitTransition.transition()
          .duration(350)
          .ease(d3.easeCubicIn)
          .attr("opacity", 0)
          .remove()
        )
    );

    const isGoalieTab = activeMode === "goalie";
    const legendData = [
      { color: isGoalieTab ? COLOR_GOAL_DEFENSE : COLOR_GOAL_OFFENSE, label: isGoalieTab ? "Goals Allowed" : "Goal", size: "11px", stroke: "2px" },
      { color: COLOR_REBOUND, label: "Saved (Rebound)", size: "8px", stroke: "1.2px" },
      { color: COLOR_FREEZE, label: "Saved (Goalie Froze)", size: "8px", stroke: "1.2px" },
      { color: isGoalieTab ? COLOR_SAVE_GOALIE : COLOR_SAVE_SKATER, label: "Standard Save", size: "8px", stroke: "1.2px" }
    ];

    legendData.forEach(item => {
      const matchesGoalOverride = (activeGoalsOnly && (item.label === "Goal" || item.label === "Goals Allowed"));
      const opacityStyle = (activeGoalsOnly && !matchesGoalOverride) ? "opacity: 0.25;" : "opacity: 1;";
      const legItem = legendRow.append("div")
        .style("display", "flex").style("align-items", "center").style("gap", "6px")
        .attr("style", (i, c) => (c || "") + opacityStyle);

      legItem.html(`
        <span style="display: inline-block; width: ${item.size}; height: ${item.size}; background: ${item.color}; border: ${item.stroke} solid #ffffff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.15);"></span>
        <span style="font-size: 11.5px; font-weight: 500; color: #475569; text-transform: uppercase; letter-spacing: 0.3px;">${item.label}</span>
      `);
    });

    const shotNodes = shotContainer.selectAll("circle")
      .data(combinedShots, d => d.shotID || `${d.shooterName}-${d.time}-${d.displayX}`);

    shotNodes.join(
      enter => enter.append("circle")
        .attr("cx", d => {
          if (lastUpdatedSide === "left" || lastUpdatedSide === "right") {
            return d.side === lastUpdatedSide ? (d.displayX < 0 ? xScale(-89) : xScale(89)) : xScale(d.displayX);
          }
          return xScale(d.displayX);
        })
        .attr("cy", d => {
          if ((lastUpdatedSide === "left" || lastUpdatedSide === "right") && d.side === lastUpdatedSide) return yScale(0);
          return yScale(d.displayY);
        })
        .attr("r", d => d.goal === 1 ? 7.5 : 5.5)
        .attr("fill", d => {
          if (d.goal === 1) return isGoalieTab ? COLOR_GOAL_DEFENSE : COLOR_GOAL_OFFENSE;
          if (d.shotGeneratedRebound === 1) return COLOR_REBOUND;
          if (d.shotGoalieFroze === 1) return COLOR_FREEZE;
          return isGoalieTab ? COLOR_SAVE_GOALIE : COLOR_SAVE_SKATER;
        })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", d => d.goal === 1 ? 2 : 1.2)
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .style("mix-blend-mode", "multiply")
        .call(enterTransition => enterTransition.transition()
          .duration(900)
          .delay((d, i) => Math.min(i * 3.5, 300))
          .ease(d3.easeCubicOut)
          .attr("cx", d => xScale(d.displayX))
          .attr("cy", d => yScale(d.displayY))
          .attr("opacity", 0.8)
        ),
      
      update => update
        .style("mix-blend-mode", "multiply")
        .attr("opacity", 0.8),

      exit => exit
        .style("pointer-events", "none")
        .call(exitTransition => exitTransition.transition()
          .duration(350)
          .ease(d3.easeCubicIn)
          .attr("r", 0) 
          .attr("opacity", 0)
          .remove()
        )
    );

    shotContainer.selectAll("circle")
      .on("pointerover", function(event, d) {
        shotContainer.selectAll("circle").style("opacity", 0.12);
        d3.select(this)
          .style("opacity", 1)
          .style("mix-blend-mode", "normal")
          .transition().duration(120)
          .attr("r", d.goal === 1 ? 10.5 : 8.5)
          .attr("stroke-width", 2.5);

        const isDefendingNetEmpty = d.isHomeTeam === 1 ? d.awayEmptyNet === 1 : d.homeEmptyNet === 1;
        const netHTML = isDefendingNetEmpty ? ` <span style="color:#ef4444; font-size:11px; font-weight:600;">(Empty Net)</span>` : "";
        const resHTML = d.goal === 1 ? `<span style="color:${isGoalieTab ? COLOR_GOAL_DEFENSE : COLOR_GOAL_OFFENSE}; font-weight:bold;">${isGoalieTab ? 'GOAL ALLOWED' : 'GOAL'}</span>${netHTML}` : d.shotGeneratedRebound === 1 ? `<span style="color:${COLOR_REBOUND}; font-weight:bold;">Saved (Rebound)</span>` : d.shotGoalieFroze === 1 ? `<span style="color:#0ea5e9; font-weight:bold;">Saved (Froze)</span>` : `<span style="color:${isGoalieTab ? COLOR_SAVE_GOALIE : '#64748b'}; font-weight:bold;">Saved</span>`;
        
        const sK = d.isHomeTeam === 1 ? d.homeSkatersOnIce : d.awaySkatersOnIce;
        const dK = d.isHomeTeam === 1 ? d.awaySkatersOnIce : d.homeSkatersOnIce;
        const sitHTML = (d.isHomeTeam === 1 ? d.homeEmptyNet===1 : d.awayEmptyNet===1) && sK===6 ? `Extra Attacker (${sK}v${dK})` : isDefendingNetEmpty && dK===6 ? `Defending Extra Attacker (${sK}v${dK})` : sK>dK ? `Powerplay (${sK}v${dK})` : sK<dK ? `Penalty Kill (${sK}v${dK})` : `Even Strength (${sK}v${dK})`;

        tooltip.html(`
          <div style="font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.15); margin-bottom: 6px; padding-bottom: 4px; font-size: 14px;">${activeMode === 'team' ? d.teamCode : activeMode === 'skater' ? d.shooterName : d.goalieNameForShot}</div>
          <div style="margin-bottom: 4px;"><strong>Shooter:</strong> ${d.shooterName}</div>
          <div style="margin-bottom: 4px;"><strong>Goalie:</strong> ${d.goalieNameForShot}</div>
          <div style="margin-bottom: 4px;"><strong>Game:</strong> ${d.teamCode} ${d.isHomeTeam === 1 ? 'vs' : '@'} ${d.isHomeTeam === 1 ? d.awayTeamCode : d.homeTeamCode}</div>
          <div style="margin-bottom: 4px;"><strong>Time:</strong> ${Math.floor((d.time%1200)/60)}:${(d.time%60)<10?'0':''}${d.time%60} (P${d.period})</div>
          <div style="margin-bottom: 4px;"><strong>Situation:</strong> ${sitHTML}</div>
          <div style="margin-bottom: 4px;"><strong>Result:</strong> ${resHTML}</div>
          <div><strong>Distance:</strong> ${Math.round(d.shotDistance) || 0} ft</div>
        `).style("visibility", "visible");
      })
      .on("pointermove", function(event) {
        const [mouseX, mouseY] = d3.pointer(event, rinkWrapper.node());
        tooltip.style("left", `${mouseX + 15}px`).style("top", `${mouseY - 60}px`); 
      })
      .on("pointerleave", function() {
        shotContainer.selectAll("circle").style("opacity", 0.8).style("mix-blend-mode", "multiply");
        d3.select(this)
          .transition().duration(120)
          .attr("r", d => d.goal === 1 ? 7.5 : 5.5)
          .attr("stroke-width", d => d.goal === 1 ? 2 : 1.2);
        tooltip.style("visibility", "hidden");
      });

    previousShotIds = new Set(combinedShots.map(d => d.shotID || `${d.shooterName}-${d.time}-${d.displayX}`));
    previousLeftPlayer = activeLeftPlayer;
    previousRightPlayer = activeRightPlayer;
  }

  container.appendChild(root.node());

  updateDashboard();
}