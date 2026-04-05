const fs = require("fs");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const logFile =
  (process.env.INPUT_LOG_FILE || "").replace(/^'|'$/g, "") ||
  "/var/log/iron-proxy.log";
const showFullPaths =
  (process.env["INPUT_SHOW-FULL-PATHS"] || "false").toLowerCase() === "true";

if (!fs.existsSync(logFile)) {
  console.log(`iron-proxy log file not found: ${logFile}`);
  process.exit(0);
}

const lines = fs.readFileSync(logFile, "utf-8").split("\n");
const audits = [];
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const entry = JSON.parse(line);
    if (!entry.audit) continue;
    const audit = { ...entry.audit };
    // Check if any request transform has a warn annotation
    const warned = (entry.request_transforms || []).some(
      (t) => t.annotations && t.annotations.action === "warn"
    );
    if (warned) audit.action = "warn";
    audits.push(audit);
  } catch {
    // skip non-JSON lines
  }
}

if (audits.length === 0) {
  console.log("No iron-proxy traffic recorded");
  process.exit(0);
}

const allowed = audits.filter((a) => a.action === "allow").length;
const warned = audits.filter((a) => a.action === "warn").length;
const denied = audits.filter((a) => a.action === "reject").length;

// Roll up by host
const hostCounts = {};
for (const a of audits) {
  const key = a.host;
  if (!hostCounts[key]) hostCounts[key] = { allow: 0, warn: 0, reject: 0, total: 0 };
  hostCounts[key].total++;
  if (a.action === "allow") hostCounts[key].allow++;
  if (a.action === "warn") hostCounts[key].warn++;
  if (a.action === "reject") hostCounts[key].reject++;
}

const hostsSorted = Object.entries(hostCounts).sort(
  (a, b) => b[1].total - a[1].total
);

// Aggregate by host/method/path/action for detail view
const detailCounts = {};
for (const a of audits) {
  const key = `${a.host}\t${a.method}\t${a.path}\t${a.action}`;
  detailCounts[key] = (detailCounts[key] || 0) + 1;
}
const detailSorted = Object.entries(detailCounts).sort(
  (a, b) => b[1] - a[1]
);

const col = (s, w) => s.toString().padEnd(w);
const truncPath = (s, max = 64) =>
  s.length > max ? "…" + s.slice(-(max - 1)) : s;

// Main output: host summary
console.log("---");
console.log("");
console.log(`${BOLD}Iron Proxy Egress Summary${RESET}`);
console.log(`${GREEN}${allowed} requests allowed${RESET}`);
if (warned > 0) console.log(`${YELLOW}${warned} requests allowed in warn mode${RESET}`);
console.log(`${RED}${denied} unexpected outbound request${denied === 1 ? "" : "s"} blocked${RESET}`);
console.log("");
const hasWarns = warned > 0;
if (hasWarns) {
  console.log(
    `${BOLD}${col("HOST", 36)}${col("TOTAL", 8)}${col("ALLOWED", 10)}${col("WARNED", 10)}DENIED${RESET}`
  );
  console.log(
    `${col("------------------------------------", 36)}${col("-----", 8)}${col("-------", 10)}${col("------", 10)}------`
  );
} else {
  console.log(
    `${BOLD}${col("HOST", 36)}${col("TOTAL", 8)}${col("ALLOWED", 10)}DENIED${RESET}`
  );
  console.log(
    `${col("------------------------------------", 36)}${col("-----", 8)}${col("-------", 10)}------`
  );
}
for (const [host, c] of hostsSorted) {
  const allowedStr = c.allow > 0 ? `${GREEN}${c.allow}${RESET}` : "0";
  const warnedStr = c.warn > 0 ? `${YELLOW}${c.warn}${RESET}` : "0";
  const deniedStr = c.reject > 0 ? `${RED}${c.reject}${RESET}` : "0";
  if (hasWarns) {
    console.log(
      `${col(host, 36)}${col(c.total, 8)}${col("", 0)}${allowedStr}${" ".repeat(10 - c.allow.toString().length)}${warnedStr}${" ".repeat(10 - c.warn.toString().length)}${deniedStr}`
    );
  } else {
    console.log(
      `${col(host, 36)}${col(c.total, 8)}${col("", 0)}${allowedStr}${" ".repeat(10 - c.allow.toString().length)}${deniedStr}`
    );
  }
}
console.log("");
console.log("");
console.log(
  `Using this in production? Let's harden it properly. Email matt@iron.sh`
);
console.log("");

// Detail output: per-path breakdown in a collapsible group
if (showFullPaths) {
  console.log("::group::Request details by path");
  console.log(
    `${BOLD}${col("COUNT", 8)}${col("HOST", 32)}${col("METHOD", 8)}${col("PATH", 66)}ACTION${RESET}`
  );
  console.log(
    `${col("-----", 8)}${col("--------------------------------", 32)}${col("------", 8)}${col("-".repeat(64), 66)}------`
  );
  for (const [key, count] of detailSorted) {
    const [host, method, path, action] = key.split("\t");
    const color = action === "allow" ? GREEN : action === "warn" ? YELLOW : RED;
    console.log(
      `${col(count, 8)}${col(host, 32)}${col(method, 8)}${col(truncPath(path), 66)}${color}${action}${RESET}`
    );
  }
  console.log("::endgroup::");
  console.log("");
}
