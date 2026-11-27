import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import express from "express";
import { db } from "./db/db.js";
import { courseScores } from "./flags/score.js";
import { schedule, isDue, nextRunAt } from "./scheduler.js";
import { notifyAdmin } from "./notify/notify.js";
import { askRadar, chatStatus } from "./chat/assistant.js";

const app = express();
app.use(express.json());
app.use(express.static("public")); // serves public/index.html

const CAP = Number(process.env.AI_MONTHLY_CAP_USD || 4.5);
const monthStart = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

// ---- Overview: courses, totals, AI spend ----
app.get("/api/overview", (req, res) => {
  const totals = db
    .prepare(
      `
    SELECT (SELECT COUNT(*) FROM files)  AS files,
           (SELECT COUNT(*) FROM chunks) AS chunks,
           (SELECT COUNT(*) FROM changes) AS news,
           (SELECT COUNT(*) FROM changes WHERE relevant = 1) AS relevantNews,
           (SELECT MAX(indexedAt) FROM files) AS lastIndexed`,
    )
    .get();
  // daily checks budget (the Ask Radar chat has its own budget)
  const spent = db
    .prepare(
      "SELECT COALESCE(SUM(costUsd), 0) AS s FROM ai_usage WHERE at >= ? AND COALESCE(purpose, '') <> 'chat'",
    )
    .get(monthStart()).s;
  const lastRun =
    db
      .prepare(
        "SELECT startedAt, status, newFlags, aiCost FROM runs ORDER BY id DESC LIMIT 1",
      )
      .get() || null;
  res.json({
    courses: courseScores(),
    totals,
    ai: { spent, cap: CAP },
    chat: chatStatus(),
    lastRun,
    schedule: scheduleInfo(),
  });
});

// ---- Flags list with filters ----
app.get("/api/flags", (req, res) => {
  const { course = "", impact = "", status = "open" } = req.query;
  const where = [];
  const args = [];

  if (course) {
    where.push("f.course = ?");
    args.push(course);
  }
  if (impact) {
    where.push("f.impact = ?");
    args.push(impact);
  }
  if (status === "open") where.push("f.status IN ('New', 'Accepted')");
  else if (status !== "all") {
    where.push("f.status = ?");
    args.push(status);
  }

  // Only flags created in the latest run ("View new flags")
  if (req.query.new === "1") {
    where.push(
      "f.createdAt >= (SELECT startedAt FROM runs ORDER BY id DESC LIMIT 1)",
    );
  }

  const rows = db
    .prepare(
      `
    SELECT f.id, f.course, f.location, f.impact, f.status, f.confidence, f.isSample, f.createdAt,
           c.title, c.vendor, COALESCE(c.date, c.firstSeen) AS changeDate
    FROM flags f LEFT JOIN changes c ON c.id = f.changeId
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY CASE f.impact WHEN 'Certification' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
             f.createdAt DESC
    LIMIT 500`,
    )
    .all(...args);
  res.json(rows);
});

// ---- One flag in full ----
app.get("/api/flags/:id", (req, res) => {
  const flag = db
    .prepare(
      `
    SELECT f.*, c.title, c.vendor, c.link, c.summary, c.changeType,
           COALESCE(c.date, c.firstSeen) AS changeDate,
           fi.webUrl AS fileUrl, fi.name AS fileName
    FROM flags f
    LEFT JOIN changes c ON c.id = f.changeId
    LEFT JOIN files fi ON fi.id = f.fileId
    WHERE f.id = ?`,
    )
    .get(Number(req.params.id));
  if (!flag) return res.status(404).json({ error: "Flag not found" });
  flag.history = db
    .prepare(
      "SELECT action, note, at FROM reviews WHERE flagId = ? ORDER BY at DESC",
    )
    .all(flag.id);
  res.json(flag);
});

// ---- TPM action: Accept / Dismiss / Fixed ----
const ACTIONS = ["Accepted", "Dismissed", "Fixed"];
app.post("/api/flags/:id/action", (req, res) => {
  const { action, note = "" } = req.body || {};
  if (!ACTIONS.includes(action))
    return res.status(400).json({ error: "Unknown action" });

  const id = Number(req.params.id);
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE flags SET status = ?, updatedAt = ? WHERE id = ?")
    .run(action, now, id);
  if (!result.changes) return res.status(404).json({ error: "Flag not found" });

  db.prepare(
    "INSERT INTO reviews (flagId, action, note, at) VALUES (?, ?, ?, ?)",
  ).run(id, action, String(note).slice(0, 500), now);
  res.json({ ok: true });
});

// ---- Course flags: ONE flag per course, every affected place listed inside ----
// (each row in the flags table is one "place" = one slide / section / lab step)
const RANK = { Certification: 0, High: 1, Medium: 2, Low: 3 };
const higher = (a, b) => ((RANK[a] ?? 9) <= (RANK[b] ?? 9) ? a : b);
const lastRunStart = () =>
  db.prepare("SELECT startedAt FROM runs ORDER BY id DESC LIMIT 1").get()
    ?.startedAt || "";

// List: one row per course that has open places
app.get("/api/course-flags", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT f.id, f.course, f.impact, f.status, f.changeId, f.createdAt, f.isSample, c.title, c.vendor
    FROM flags f LEFT JOIN changes c ON c.id = f.changeId
    WHERE f.status IN ('New', 'Accepted')`,
    )
    .all();
  const since = lastRunStart();
  const scores = new Map(courseScores().map((c) => [c.course, c]));
  const map = new Map();

  for (const r of rows) {
    if (!map.has(r.course)) {
      map.set(r.course, {
        course: r.course,
        impact: r.impact,
        places: 0,
        newPlaces: 0,
        accepted: 0,
        isSample: 0,
        latest: "",
        changes: new Map(),
      });
    }
    const g = map.get(r.course);
    g.places++;
    if (since && r.createdAt >= since) g.newPlaces++;
    if (r.status === "Accepted") g.accepted++;
    if (r.isSample) g.isSample = 1;
    if (r.createdAt > g.latest) g.latest = r.createdAt;
    g.impact = higher(r.impact, g.impact);
    const ch = g.changes.get(r.changeId) || {
      title: r.title,
      vendor: r.vendor,
      impact: r.impact,
      places: 0,
    };
    ch.impact = higher(r.impact, ch.impact);
    ch.places++;
    g.changes.set(r.changeId, ch);
  }

  let list = [...map.values()].map((g) => ({
    ...g,
    changes: [...g.changes.values()].sort(
      (a, b) => RANK[a.impact] - RANK[b.impact],
    ),
    score: scores.get(g.course)?.score ?? 100,
    scoreStatus: scores.get(g.course)?.status ?? "Fresh",
    area: scores.get(g.course)?.area ?? "",
  }));
  if (req.query.new === "1") list = list.filter((g) => g.newPlaces > 0);
  list.sort((a, b) => RANK[a.impact] - RANK[b.impact] || b.places - a.places);
  res.json({ lastRunStart: since, courses: list });
});

// One course flag in full: changes, each with its places
app.get("/api/course-flag", (req, res) => {
  const course = String(req.query.course || "");
  const showAll = req.query.status === "all";
  const rows = db
    .prepare(
      `
    SELECT f.*, c.title, c.vendor, c.link, c.summary, c.changeType,
           COALESCE(c.date, c.firstSeen) AS changeDate,
           fi.webUrl AS fileUrl, fi.name AS fileName
    FROM flags f
    LEFT JOIN changes c ON c.id = f.changeId
    LEFT JOIN files fi ON fi.id = f.fileId
    WHERE f.course = ? ${showAll ? "" : "AND f.status IN ('New', 'Accepted')"}
    ORDER BY f.location`,
    )
    .all(course);

  const score = courseScores().find((c) => c.course === course);
  if (!score && !rows.length)
    return res.status(404).json({ error: "Course not found" });

  const changes = new Map();
  for (const r of rows) {
    if (!changes.has(r.changeId)) {
      changes.set(r.changeId, {
        changeId: r.changeId,
        title: r.title,
        vendor: r.vendor,
        link: r.link,
        summary: r.summary,
        changeType: r.changeType,
        changeDate: r.changeDate,
        impact: r.impact,
        places: [],
      });
    }
    const ch = changes.get(r.changeId);
    ch.impact = higher(r.impact, ch.impact);
    ch.places.push({
      id: r.id,
      location: r.location,
      impact: r.impact,
      status: r.status,
      confidence: r.confidence,
      currentText: r.currentText,
      suggestedText: r.suggestedText,
      reason: r.reason,
      fileUrl: r.fileUrl,
      fileName: r.fileName,
      createdAt: r.createdAt,
      isSample: r.isSample,
    });
  }

  res.json({
    course,
    area: score?.area ?? "",
    score: score?.score ?? 100,
    scoreStatus: score?.status ?? "Fresh",
    lastRunStart: lastRunStart(),
    changes: [...changes.values()].sort(
      (a, b) => RANK[a.impact] - RANK[b.impact],
    ),
  });
});

// Act on many places at once: all open places of a course (or just the given ids)
app.post("/api/course-flag/action", (req, res) => {
  const { course = "", action, note = "", ids } = req.body || {};
  if (!ACTIONS.includes(action))
    return res.status(400).json({ error: "Unknown action" });

  const targets =
    Array.isArray(ids) && ids.length
      ? ids.map(Number)
      : db
          .prepare(
            "SELECT id FROM flags WHERE course = ? AND status IN ('New', 'Accepted')",
          )
          .all(String(course))
          .map((r) => r.id);
  if (!targets.length) return res.json({ ok: true, updated: 0 });

  const now = new Date().toISOString();
  const upd = db.prepare(
    "UPDATE flags SET status = ?, updatedAt = ? WHERE id = ?",
  );
  const rev = db.prepare(
    "INSERT INTO reviews (flagId, action, note, at) VALUES (?, ?, ?, ?)",
  );
  for (const id of targets) {
    if (upd.run(action, now, id).changes)
      rev.run(id, action, String(note).slice(0, 500), now);
  }
  res.json({ ok: true, updated: targets.length });
});

// ---- Vendor news ----
app.get("/api/news", (req, res) => {
  const onlyRelevant = req.query.relevant === "1";
  res.json(
    db
      .prepare(
        `
    SELECT vendor, source, title, link, COALESCE(date, firstSeen) AS d, relevant, courses, changeType
    FROM changes ${onlyRelevant ? "WHERE relevant = 1" : ""}
    ORDER BY d DESC LIMIT 150`,
      )
      .all(),
  );
});

// ---- The daily pipeline: started by "Run now" OR by the 7 AM schedule ----
const runState = {
  running: false,
  trigger: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  log: [],
};
const lastRunStarted = () =>
  db.prepare("SELECT startedAt FROM runs ORDER BY id DESC LIMIT 1").get()
    ?.startedAt || null;

function startRun(trigger) {
  if (runState.running) return false;
  Object.assign(runState, {
    running: true,
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    log: [],
  });
  runState.log.push(
    trigger === "schedule"
      ? "⏰ Scheduled daily run"
      : "▶ Started from the dashboard",
  );

  // Same as "npm run daily"
  const child = spawn(
    process.execPath,
    ["--experimental-sqlite", "--no-warnings", "src/run.js"],
    { env: process.env },
  );

  const addLines = (chunk) => {
    for (const line of chunk.toString().split(/\r\n|\r|\n/)) {
      if (line.trim()) runState.log.push(line);
    }
    if (runState.log.length > 500)
      runState.log.splice(0, runState.log.length - 500); // keep the last 500 lines
  };
  child.stdout.on("data", addLines);
  child.stderr.on("data", addLines);
  child.on("close", (code) =>
    Object.assign(runState, {
      running: false,
      finishedAt: new Date().toISOString(),
      exitCode: code,
    }),
  );
  child.on("error", (err) => {
    runState.log.push(`Could not start the run: ${err.message}`);
    Object.assign(runState, {
      running: false,
      finishedAt: new Date().toISOString(),
      exitCode: 1,
    });
  });
  return true;
}

app.post("/api/run", (req, res) => {
  if (!startRun("manual"))
    return res.status(409).json({ error: "A run is already in progress" });
  res.json({ ok: true });
});

app.get("/api/run/status", (req, res) => {
  const lastRun = runState.running
    ? null
    : db
        .prepare(
          "SELECT startedAt, status, newFlags FROM runs ORDER BY id DESC LIMIT 1",
        )
        .get() || null;
  res.json({ ...runState, lastRun, schedule: scheduleInfo() });
});

// ---- 7 AM schedule: checked every minute (and once right after start = catch-up) ----
function scheduleInfo() {
  return { ...schedule, nextRun: nextRunAt(lastRunStarted()) };
}

let lastScheduledAttempt = ""; // one automatic attempt per day, even if a run crashes before it is logged
let lastStaleAlert = 0;

async function scheduleTick() {
  try {
    const last = lastRunStarted();
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: schedule.tz,
    }); // YYYY-MM-DD

    if (isDue(last) && lastScheduledAttempt !== today) {
      if (startRun("schedule")) {
        lastScheduledAttempt = today;
        console.log(
          `⏰ Scheduled daily run started (${new Date().toLocaleString("en-IN", { timeZone: schedule.tz })})`,
        );
      }
    }

    // Safety net: tell the admin if no run has happened for 2 days (at most once a day)
    const ageHours = last ? (Date.now() - new Date(last)) / 36e5 : 0;
    if (
      schedule.enabled &&
      last &&
      ageHours > 48 &&
      Date.now() - lastStaleAlert > 24 * 36e5 &&
      !runState.running
    ) {
      lastStaleAlert = Date.now();
      await notifyAdmin("No daily run for 2 days", [
        `The last run started ${new Date(last).toLocaleString("en-IN", { timeZone: schedule.tz })}.`,
        "Check that the server and the dashboard are running.",
      ]).catch((err) =>
        console.log(`  (could not email the admin: ${err.message})`),
      );
    }
  } catch (err) {
    console.log(`⚠ Scheduler check failed: ${err.message}`);
  }
}

if (schedule.enabled) {
  setTimeout(scheduleTick, 5000); // catch-up check shortly after start
  setInterval(scheduleTick, 60 * 1000); // then every minute
}

// ---- Short file links used by Ask Radar: /open/42 → the file in SharePoint ----
app.get("/open/:n", (req, res) => {
  const row = db
    .prepare("SELECT webUrl FROM files WHERE rowid = ?")
    .get(Number(req.params.n));
  if (!row?.webUrl || !/^https:\/\//i.test(row.webUrl))
    return res
      .status(404)
      .send("File not found (it may have been replaced by a newer version).");
  res.redirect(302, row.webUrl);
});

// ---- Ask Radar chat (read-only assistant) ----
app.get("/api/chat/status", (req, res) => res.json(chatStatus()));

app.post("/api/chat", async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  try {
    res.json(await askRadar(messages));
  } catch (err) {
    console.log(`⚠ Ask Radar: ${err.message}`);
    res.status(err.status || 500).json({
      error: err.status
        ? err.message
        : `Ask Radar could not answer: ${err.message}`,
    });
  }
});

// ---- Emails (sent or previewed) ----
app.get("/api/notifications", (req, res) => {
  res.json(
    db
      .prepare(
        `
    SELECT id, at, type, recipients, subject, flagIds, mode FROM notifications
    ORDER BY at DESC LIMIT 100`,
      )
      .all(),
  );
});

// Show a preview email (only files inside data/outbox)
app.get("/api/notifications/:id/html", (req, res) => {
  const row = db
    .prepare("SELECT file FROM notifications WHERE id = ?")
    .get(Number(req.params.id));
  const outbox = path.resolve("data/outbox");
  const file = row?.file ? path.resolve(row.file) : null;
  if (!file || !file.startsWith(outbox) || !fs.existsSync(file))
    return res.status(404).send("Preview not found");
  res.type("html").send(fs.readFileSync(file, "utf8"));
});

// Only reachable from this laptop until proper login is added on AWS
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
  const next = scheduleInfo().nextRun;
  console.log(
    schedule.enabled
      ? `⏰ Daily run at ${schedule.time} (${schedule.tz}, ${schedule.days === "weekdays" ? "Mon–Fri" : "every day"}) · next: ${next ? new Date(next).toLocaleString("en-IN", { timeZone: schedule.tz }) : "–"}`
      : "⏰ Schedule is OFF (SCHEDULE=off in .env)",
  );
});
