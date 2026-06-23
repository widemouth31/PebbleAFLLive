var MAX_GAMES = 10;

var KEY_COUNT = 2;
var KEY_STATUS = 3;

var KEY_TITLE_0 = 10;
var KEY_SUBTITLE_0 = 11;
var KEY_STATUSLINE_0 = 30;

var SHOW_CURRENT_ROUND = false;
var REFRESH_MINUTES = 2;

var ROUND_CACHE_HOURS = 6;
var CACHED_ROUND = null;
var CACHED_ROUND_YEAR = null;
var CACHED_ROUND_TIME = 0;
var ANALYTICS_URL = "http://XXX.XXX.XXX.XXX:8787/event";
var ANALYTICS_TOKEN = "6f9f1d8e-"
var refreshTimer = null;



var TEAM_ABBR = {
  "Adelaide": "ADEL",
  "Adelaide Crows": "ADEL",
  "Brisbane": "BRIS",
  "Brisbane Lions": "BRIS",
  "Carlton": "CARL",
  "Carlton Blues": "CARL",
  "Collingwood": "COLL",
  "Collingwood Magpies": "COLL",
  "Essendon": "ESS",
  "Essendon Bombers": "ESS",
  "Fremantle": "FREO",
  "Fremantle Dockers": "FREO",
  "Geelong": "GEEL",
  "Geelong Cats": "GEEL",
  "Gold Coast": "GCS",
  "Gold Coast Suns": "GCS",
  "Greater Western Sydney": "GWS",
  "GWS": "GWS",
  "GWS Giants": "GWS",
  "Hawthorn": "HAW",
  "Hawthorn Hawks": "HAW",
  "Melbourne": "MELB",
  "Melbourne Demons": "MELB",
  "North Melbourne": "NM",
  "North Melbourne Kangaroos": "NM",
  "Port Adelaide": "PA",
  "Port Adelaide Power": "PA",
  "Richmond": "RICH",
  "Richmond Tigers": "RICH",
  "St Kilda": "SK",
  "St Kilda Saints": "SK",
  "Sydney": "SYD",
  "Sydney Swans": "SYD",
  "West Coast": "WCE",
  "West Coast Eagles": "WCE",
  "Western Bulldogs": "WB"
};

// TEMP TEST Remove cached Settings
// localStorage.removeItem('afl-live-settings');
// localStorage.removeItem('afl-live-round-cache');
// console.log('AFL Live: cleared settings');



function log(message) {
  console.log("AFL Live: " + message);
}


function recordRemoteLaunch() {
  var xhr;
  var payload;

  if (!ANALYTICS_URL || ANALYTICS_URL === "http://YOUR-SERVER-IP:8787/event") {
    log("Analytics URL not configured");
    return;
  }

  payload = {
    app: "AFL Live",
    event: "launch",
    timestamp: new Date().toISOString(),
    mode: SHOW_CURRENT_ROUND ? "round" : "live",
    cachedRound: CACHED_ROUND
  };

  try {
    xhr = new XMLHttpRequest();
    xhr.open("POST", ANALYTICS_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("x-analytics-token", ANALYTICS_TOKEN);
    xhr.timeout = 10000;

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        log("Analytics launch ping status=" + xhr.status);
      }
    };

    xhr.onerror = function() {
      log("Analytics launch ping failed");
    };

    xhr.ontimeout = function() {
      log("Analytics launch ping timed out");
    };

    xhr.send(JSON.stringify(payload));
  } catch (e) {
    log("Analytics launch error: " + e.message);
  }
}


function getCurrentYear() {
  return new Date().getFullYear();
}


function loadSettings() {
  var raw;
  var parsed;
  var mins;

  try {
    raw = localStorage.getItem("afl-live-settings");

    if (!raw) {
      log("No saved settings found");
      loadRoundCache();
      return;
    }

    parsed = JSON.parse(raw);

    SHOW_CURRENT_ROUND = parsed.showCurrentRound === true;

    mins = parseInt(parsed.refreshMinutes, 10);

    if (!isNaN(mins) && mins > 0) {
      REFRESH_MINUTES = mins;
    } else {
      REFRESH_MINUTES = 2;
    }

    loadRoundCache();

    log("Settings loaded. SHOW_CURRENT_ROUND=" + SHOW_CURRENT_ROUND + ", REFRESH_MINUTES=" + REFRESH_MINUTES);
  } catch (e) {
    log("Failed to load settings: " + e.message);
    loadRoundCache();
  }
}


function saveSettings(config) {
  var mins;

  try {
    SHOW_CURRENT_ROUND = config.showCurrentRound === true;

    mins = parseInt(config.refreshMinutes, 10);

    if (!isNaN(mins) && mins > 0) {
      REFRESH_MINUTES = mins;
    } else {
      REFRESH_MINUTES = 2;
    }

    localStorage.setItem("afl-live-settings", JSON.stringify({
      showCurrentRound: SHOW_CURRENT_ROUND,
      refreshMinutes: REFRESH_MINUTES
    }));

    log("Settings saved. SHOW_CURRENT_ROUND=" + SHOW_CURRENT_ROUND + ", REFRESH_MINUTES=" + REFRESH_MINUTES);
  } catch (e) {
    log("Failed to save settings: " + e.message);
  }
}


function loadRoundCache() {
  var raw;
  var parsed;

  try {
    raw = localStorage.getItem("afl-live-round-cache");

    if (!raw) {
      return;
    }

    parsed = JSON.parse(raw);

    CACHED_ROUND = parsed.round;
    CACHED_ROUND_YEAR = parsed.year;
    CACHED_ROUND_TIME = parsed.time;

    log("Round cache loaded. round=" + CACHED_ROUND + ", year=" + CACHED_ROUND_YEAR);
  } catch (e) {
    log("Failed to load round cache: " + e.message);
  }
}



function saveRoundCache(round, year) {
  try {
    CACHED_ROUND = round;
    CACHED_ROUND_YEAR = year;
    CACHED_ROUND_TIME = new Date().getTime();

    localStorage.setItem("afl-live-round-cache", JSON.stringify({
      round: CACHED_ROUND,
      year: CACHED_ROUND_YEAR,
      time: CACHED_ROUND_TIME
    }));

    log("Round cache saved. round=" + CACHED_ROUND + ", year=" + CACHED_ROUND_YEAR);
  } catch (e) {
    log("Failed to save round cache: " + e.message);
  }
}


function isRoundCacheValid() {
  var now;
  var ageMs;
  var maxAgeMs;
  var year;

  year = getCurrentYear();

  if (CACHED_ROUND === null || CACHED_ROUND === undefined || CACHED_ROUND === "") {
    log("Round cache invalid: no cached round");
    return false;
  }

  if (CACHED_ROUND_YEAR !== year) {
    log("Round cache invalid: cached year " + CACHED_ROUND_YEAR + " does not match " + year);
    return false;
  }

  if (!CACHED_ROUND_TIME) {
    log("Round cache invalid: no cached time");
    return false;
  }

  CACHED_ROUND_TIME = parseInt(CACHED_ROUND_TIME, 10);

  if (isNaN(CACHED_ROUND_TIME)) {
    log("Round cache invalid: cached time is not numeric");
    return false;
  }

  now = new Date().getTime();
  ageMs = now - CACHED_ROUND_TIME;
  maxAgeMs = ROUND_CACHE_HOURS * 60 * 60 * 1000;

  if (ageMs < 0) {
    log("Round cache invalid: cached time is in the future");
    return false;
  }

  log("Round cache age minutes=" + Math.floor(ageMs / 60000) + ", max minutes=" + Math.floor(maxAgeMs / 60000));

  if (ageMs > maxAgeMs) {
    log("Round cache expired");
    return false;
  }

  log("Round cache valid");
  return true;
}



function clearRoundCache() {
  CACHED_ROUND = null;
  CACHED_ROUND_YEAR = null;
  CACHED_ROUND_TIME = 0;

  try {
    localStorage.removeItem("afl-live-round-cache");
  } catch (e) {
    log("Failed to clear round cache: " + e.message);
  }
}


function trimString(value, maxLength) {
  if (value === undefined || value === null) {
    return "";
  }

  value = String(value);

  if (value.length <= maxLength) {
    return value;
  }

  return value.substring(0, maxLength - 1);
}


function getField(game, names, fallback) {
  var i;

  for (i = 0; i < names.length; i++) {
    if (game[names[i]] !== undefined && game[names[i]] !== null && game[names[i]] !== "") {
      return game[names[i]];
    }
  }

  return fallback;
}


function getTeamAbbr(teamName) {
  var parts;
  var abbr;
  var i;

  if (!teamName) {
    return "TBC";
  }

  if (TEAM_ABBR[teamName]) {
    return TEAM_ABBR[teamName];
  }

  parts = String(teamName).split(" ");
  abbr = "";

  for (i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) {
      abbr += parts[i].charAt(0).toUpperCase();
    }
  }

  if (abbr.length > 4) {
    abbr = abbr.substring(0, 4);
  }

  return abbr;
}


function getRawDateValue(game) {
  return getField(game, [
    "date",
    "datetime",
    "timestr",
    "localtime",
    "localTime",
    "starttime",
    "startTime",
    "utcStartTime",
    "utc_start_time"
  ], null);
}


function parseGameDate(game) {
  var rawDate;
  var text;
  var match;
  var parsed;
  var year;
  var month;
  var day;
  var hour;
  var minute;

  rawDate = getRawDateValue(game);

  if (!rawDate) {
    return null;
  }

  text = String(rawDate);

  /*
    Handles:
      2026-06-19
      2026-06-19 18:10:00
      2026-06-19T18:10:00
  */
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);

  if (match) {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10) - 1;
    day = parseInt(match[3], 10);

    if (match[4] !== undefined && match[5] !== undefined) {
      hour = parseInt(match[4], 10);
      minute = parseInt(match[5], 10);
    } else {
      hour = 0;
      minute = 0;
    }

    return new Date(year, month, day, hour, minute, 0);
  }

  parsed = Date.parse(text);

  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}


function compareGamesByDate(a, b) {
  var ad;
  var bd;

  ad = parseGameDate(a);
  bd = parseGameDate(b);

  if (ad && bd) {
    return ad.getTime() - bd.getTime();
  }

  if (ad && !bd) {
    return -1;
  }

  if (!ad && bd) {
    return 1;
  }

  return 0;
}


function getGameComplete(game) {
  var complete;

  complete = getField(game, ["complete"], 0);
  complete = parseInt(complete, 10);

  if (isNaN(complete)) {
    complete = 0;
  }

  return complete;
}

function getNumericScore(game, side) {
  var score;

  if (side === "home") {
    score = getField(game, ["hscore", "hteamScore", "homeScore", "home_score"], null);
  } else {
    score = getField(game, ["ascore", "ateamScore", "awayScore", "away_score"], null);
  }

  score = parseInt(score, 10);

  if (isNaN(score)) {
    return null;
  }

  return score;
}


function getScoreText(scoreValue) {
  if (scoreValue === undefined || scoreValue === null || scoreValue === "") {
    return "-";
  }

  return String(scoreValue);
}

function getScoreDisplay(game, side) {
  var goals;
  var behinds;
  var score;

  if (side === "home") {
    goals = getField(game, ["hgoals", "homeGoals", "home_goals"], null);
    behinds = getField(game, ["hbehinds", "homeBehinds", "home_behinds"], null);
    score = getField(game, ["hscore", "hteamScore", "homeScore", "home_score"], "");
  } else {
    goals = getField(game, ["agoals", "awayGoals", "away_goals"], null);
    behinds = getField(game, ["abehinds", "awayBehinds", "away_behinds"], null);
    score = getField(game, ["ascore", "ateamScore", "awayScore", "away_score"], "");
  }

  if (
    goals !== null &&
    goals !== undefined &&
    goals !== "" &&
    behinds !== null &&
    behinds !== undefined &&
    behinds !== "" &&
    score !== null &&
    score !== undefined &&
    score !== ""
  ) {
    return goals + "." + behinds + "." + score;
  }

  return getScoreText(score);
}


function getGameTitle(game) {
  var hteam;
  var ateam;
  var hscoreText;
  var ascoreText;
  var hscore;
  var ascore;
  var title;

  hteam = getField(game, ["hteam", "homeTeam", "home_team", "hometeam"], "Home");
  ateam = getField(game, ["ateam", "awayTeam", "away_team", "awayteam"], "Away");

  hscoreText = getScoreDisplay(game, "home");
  ascoreText = getScoreDisplay(game, "away");

  hscore = getNumericScore(game, "home");
  ascore = getNumericScore(game, "away");

  if (hscore !== null && ascore !== null && ascore > hscore) {
    title = getTeamAbbr(ateam) + " " + ascoreText;
  } else {
    title = getTeamAbbr(hteam) + " " + hscoreText;
  }

  return trimString(title, 38);
}


function getShortDate(game) {
  var gameDate;
  var day;
  var month;
  var hours;
  var minutes;

  gameDate = parseGameDate(game);

  if (!gameDate) {
    return "Date TBC";
  }

  day = gameDate.getDate();
  month = gameDate.getMonth() + 1;
  hours = gameDate.getHours();
  minutes = gameDate.getMinutes();

  if (minutes < 10) {
    minutes = "0" + minutes;
  }

  if (hours === 0 && minutes === "00") {
    return day + "/" + month;
  }

  return day + "/" + month + " " + hours + ":" + minutes;
}


function getEstimatedQuarterText(game) {
  var complete;
  var quarter;
  var quarterStart;
  var percentIntoQuarter;
  var minutesElapsed;
  var minutesLeft;

  complete = getGameComplete(game);

  if (complete === 100) {
    return "Final";
  }

  if (complete === 0) {
    return getShortDate(game);
  }

  if (complete < 25) {
    quarter = 1;
    quarterStart = 0;
  } else if (complete < 50) {
    quarter = 2;
    quarterStart = 25;
  } else if (complete < 75) {
    quarter = 3;
    quarterStart = 50;
  } else {
    quarter = 4;
    quarterStart = 75;
  }

  percentIntoQuarter = complete - quarterStart;

  minutesElapsed = Math.floor((percentIntoQuarter / 25) * 20);
  minutesLeft = 20 - minutesElapsed;

  if (minutesLeft < 0) {
    minutesLeft = 0;
  }

  return "Q" + quarter + " ~" + minutesLeft + "m left";
}


function getGameStatusText(game) {
  return getEstimatedQuarterText(game);
}


function getGameSubtitle(game) {
  var hteam;
  var ateam;
  var hscoreText;
  var ascoreText;
  var hscore;
  var ascore;
  var subtitle;

  hteam = getField(game, ["hteam", "homeTeam", "home_team", "hometeam"], "Home");
  ateam = getField(game, ["ateam", "awayTeam", "away_team", "awayteam"], "Away");

  hscoreText = getScoreDisplay(game, "home");
  ascoreText = getScoreDisplay(game, "away");

  hscore = getNumericScore(game, "home");
  ascore = getNumericScore(game, "away");

  if (hscore !== null && ascore !== null && ascore > hscore) {
    subtitle = getTeamAbbr(hteam) + " " + hscoreText;
  } else {
    subtitle = getTeamAbbr(ateam) + " " + ascoreText;
  }

  return trimString(subtitle, 78);
}


function getGameStatusLine(game) {
  var statusText;

  statusText = getGameStatusText(game);

  if (SHOW_CURRENT_ROUND) {
    return trimString(statusText, 78);
  }

  return trimString("Live " + statusText, 78);
}




function getRoundTitle(isLiveOnly) {
  var title;

  if (CACHED_ROUND !== null && CACHED_ROUND !== undefined && CACHED_ROUND !== "") {
    if (isLiveOnly) {
      title = "Live Games - Round " + CACHED_ROUND;
    } else {
      title = "Round " + CACHED_ROUND;
    }
  } else {
    if (isLiveOnly) {
      title = "Live Games";
    } else {
      title = "Round";
    }
  }

  return title;
}

function findClosestRound(games) {
  var now;
  var closestRound;
  var closestDiff;
  var i;
  var gameDate;
  var diff;

  now = new Date();
  closestRound = null;
  closestDiff = null;

  for (i = 0; i < games.length; i++) {
    gameDate = parseGameDate(games[i]);

    if (!gameDate) {
      continue;
    }

    diff = Math.abs(gameDate.getTime() - now.getTime());

    if (closestDiff === null || diff < closestDiff) {
      closestDiff = diff;
      closestRound = getField(games[i], ["round"], null);
    }
  }

  return closestRound;
}

function filterGames(games) {
  var filtered;
  var i;
  var complete;

  filtered = [];

  if (SHOW_CURRENT_ROUND) {
    for (i = 0; i < games.length; i++) {
      filtered.push(games[i]);
    }

    filtered.sort(compareGamesByDate);

    return {
      games: filtered,
      status: getRoundTitle(false)
    };
  }

  for (i = 0; i < games.length; i++) {
    complete = getGameComplete(games[i]);

    if (complete !== 0 && complete !== 100) {
      filtered.push(games[i]);
    }
  }

  filtered.sort(compareGamesByDate);

  return {
    games: filtered,
    status: getRoundTitle(true)
  };
}

function sendStatusToWatch(message) {
  var payload;

  payload = {};
  payload[KEY_COUNT] = 0;
  payload[KEY_STATUS] = trimString(message, 78);

  Pebble.sendAppMessage(
    payload,
    function() {
      log("Status sent");
    },
    function(e) {
      log("Status send failed: " + JSON.stringify(e));
    }
  );
}


function sendEmptyStateToWatch(sectionTitle, titleText, subtitleText) {
  var payload;

  payload = {};

  payload[KEY_COUNT] = 1;
  payload[KEY_STATUS] = trimString(sectionTitle, 78);

  payload[KEY_TITLE_0] = trimString(titleText, 38);
  payload[KEY_SUBTITLE_0] = trimString(subtitleText, 78);
  payload[KEY_STATUSLINE_0] = "";

  Pebble.sendAppMessage(
    payload,
    function() {
      log("Empty state sent: " + sectionTitle + " - " + titleText);
    },
    function(e) {
      log("Empty state send failed: " + JSON.stringify(e));
    }
  );
}


function sendGamesToWatch(games, statusText) {
  var payload;
  var count;
  var i;
  var titleKey;
  var subtitleKey;

  payload = {};
  count = games.length;

  if (count > MAX_GAMES) {
    count = MAX_GAMES;
  }

  payload[KEY_COUNT] = count;
  payload[KEY_STATUS] = trimString(statusText, 78);

  for (i = 0; i < count; i++) {
    titleKey = KEY_TITLE_0 + (i * 2);
    subtitleKey = KEY_SUBTITLE_0 + (i * 2);

    payload[titleKey] = getGameTitle(games[i]);
    payload[subtitleKey] = getGameSubtitle(games[i]);
    payload[KEY_STATUSLINE_0 + i] = getGameStatusLine(games[i]);
  }

  Pebble.sendAppMessage(
    payload,
    function() {
      log("Sent " + count + " games");
    },
    function(e) {
      log("Game send failed: " + JSON.stringify(e));
    }
  );
}

function detectCurrentRoundThenFetchRound() {
  var year;
  var url;
  var xhr;

  year = getCurrentYear();
  url = "https://api.squiggle.com.au/?q=games;year=" + year + ";format=json";

  log("Detecting closest round using full-year query: " + url);
  sendStatusToWatch("Detecting current round...");

  xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.timeout = 20000;

  xhr.onreadystatechange = function() {
    var data;
    var round;

    if (xhr.readyState !== 4) {
      return;
    }

    if (xhr.status !== 200) {
      sendStatusToWatch("Round detect HTTP " + xhr.status);
      return;
    }

    try {
      data = JSON.parse(xhr.responseText);

      if (!data || !data.games || !data.games.length) {
        sendStatusToWatch("No games returned");
        return;
      }

      round = findClosestRound(data.games);

      if (round === null || round === undefined || round === "") {
        sendStatusToWatch("Unable to determine round");
        return;
      }

      saveRoundCache(round, year);

      fetchRoundGames(false);
    } catch (e) {
      log("Round detect parse error: " + e.message);
      sendStatusToWatch("Round detect error");
    }
  };

  xhr.ontimeout = function() {
    sendStatusToWatch("Round detect timeout");
  };

  xhr.onerror = function() {
    sendStatusToWatch("Round detect network error");
  };

  xhr.send();
}

function fetchRoundGames(forceRedetectOnEmpty) {
  var year;
  var url;
  var xhr;

  year = getCurrentYear();

  if (!isRoundCacheValid()) {
    detectCurrentRoundThenFetchRound();
    return;
  }

  url = "https://api.squiggle.com.au/?q=games;year=" + year + ";round=" + CACHED_ROUND + ";format=json";

  log("Fetching round-only query: " + url);

  xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.timeout = 20000;

  xhr.onreadystatechange = function() {
    var data;
    var result;

    if (xhr.readyState !== 4) {
      return;
    }

    if (xhr.status !== 200) {
      sendStatusToWatch("HTTP error " + xhr.status);
      return;
    }

    try {
      data = JSON.parse(xhr.responseText);

      if (!data || !data.games || !data.games.length) {
        if (forceRedetectOnEmpty) {
          clearRoundCache();
          detectCurrentRoundThenFetchRound();
          return;
        }

        sendEmptyStateToWatch(
          getRoundTitle(!SHOW_CURRENT_ROUND),
          "No games",
          "No games for round"
        );
        return;
      }

      result = filterGames(data.games);

      if (!result.games || result.games.length === 0) {
        if (SHOW_CURRENT_ROUND) {
          sendEmptyStateToWatch(
            result.status,
            "No games",
            "No games found"
          );
        } else {
          sendEmptyStateToWatch(
            result.status,
            "No games Currently",
            "in progress"
          );
        }

        return;
      }

      sendGamesToWatch(result.games, result.status);
    } catch (e) {
      log("Round fetch parse error: " + e.message);
      sendStatusToWatch("Data parse error");
    }
  };

  xhr.ontimeout = function() {
    sendStatusToWatch("Request timed out");
  };

  xhr.onerror = function() {
    sendStatusToWatch("Network error");
  };

  xhr.send();
}

function fetchAndSendScores() {
  fetchRoundGames(true);
}

function scheduleRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  refreshTimer = setInterval(function() {
    fetchAndSendScores();
  }, REFRESH_MINUTES * 60 * 1000);

  log("Refresh scheduled every " + REFRESH_MINUTES + " minute(s)");
}

function getSettingsUrl() {
  var checked;
  var html;

  checked = "";

  if (SHOW_CURRENT_ROUND) {
    checked = "checked";
  }

  html = "";
  html += "<!DOCTYPE html>";
  html += "<html>";
  html += "<head>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>AFL Live Settings</title>";
  html += "</head>";
  html += "<body style='font-family:sans-serif;padding:20px;background:#f5f5f5;'>";
  html += "<h2>AFL Live Scores</h2>";
  html += "<div style='background:white;padding:15px;border-radius:8px;'>";
  html += "<label style='font-size:16px;'>";
  html += "<input type='checkbox' id='round' " + checked + "> ";
  html += "Show All Games in Current Round?";
  html += "</label>";
  html += "<br><br>";
  html += "<label>Refresh minutes</label>";
  html += "<br>";
  html += "<select id='mins' style='font-size:16px;width:100%;padding:8px;'>";
  html += "<option value='1'>1 minute</option>";
  html += "<option value='2'>2 minutes</option>";
  html += "<option value='5'>5 minutes</option>";
  html += "<option value='10'>10 minutes</option>";
  html += "</select>";
  html += "</div>";
  html += "<br>";
  html += "<button onclick='saveSettings()' style='font-size:18px;width:100%;padding:12px;'>Save</button>";
  html += "<script>";
  html += "document.getElementById('mins').value='" + REFRESH_MINUTES + "';";
  html += "function saveSettings(){";
  html += "var cfg={";
  html += "showCurrentRound:document.getElementById('round').checked,";
  html += "refreshMinutes:parseInt(document.getElementById('mins').value,10)";
  html += "};";
  html += "document.location='pebblejs://close#'+encodeURIComponent(JSON.stringify(cfg));";
  html += "}";
  html += "</script>";
  html += "</body>";
  html += "</html>";

  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

Pebble.addEventListener("ready", function() {
  log("Pebble JS ready");

  loadSettings();

  recordRemoteLaunch();
  fetchAndSendScores();
  scheduleRefresh();
});


Pebble.addEventListener("appmessage", function(e) {
  var isToggle;

  log("Message received from watch: " + JSON.stringify(e.payload));

  isToggle = false;

  if (e.payload) {
    if (e.payload["1"] !== undefined) {
      isToggle = true;
    }

    if (e.payload[1] !== undefined) {
      isToggle = true;
    }

    if (e.payload.MODE !== undefined) {
      isToggle = true;
    }
  }

  if (isToggle) {
    SHOW_CURRENT_ROUND = !SHOW_CURRENT_ROUND;

    localStorage.setItem("afl-live-settings", JSON.stringify({
      showCurrentRound: SHOW_CURRENT_ROUND,
      refreshMinutes: REFRESH_MINUTES
    }));

    log("Mode toggled from watch. SHOW_CURRENT_ROUND=" + SHOW_CURRENT_ROUND);

    fetchAndSendScores();
    return;
  }

  log("Refresh requested from watch");
  fetchAndSendScores();
});


Pebble.addEventListener("showConfiguration", function() {
  log("Settings button clicked");

  loadSettings();

  Pebble.openURL(getSettingsUrl());
});

Pebble.addEventListener("webviewclosed", function(e) {
  var decoded;
  var config;

  log("Settings webview closed");

  if (!e || !e.response) {
    log("No settings response returned");
    return;
  }

  try {
    decoded = decodeURIComponent(e.response);
    config = JSON.parse(decoded);

    saveSettings(config);

    clearRoundCache();

    fetchAndSendScores();
    scheduleRefresh();
  } catch (err) {
    log("Settings parse error: " + err.message);
  }
});