"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["#1e3a8a", "#2563eb", "#60a5fa", "#94a3b8", "#0ea5e9"];

function toNumber(val) {
  if (val === undefined || val === null) return 0;
  const cleaned = String(val).replace(/[,%\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [fetchedAt, setFetchedAt] = useState(null);

  const [month, setMonth] = useState("all");
  const [orderType, setOrderType] = useState("all");
  const [location, setLocation] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("log"); // log | month | date
  const [selectedMonths, setSelectedMonths] = useState([]); // slicer selection, empty = all

  useEffect(() => {
    fetch("/api/sheet-data", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setStatus("error");
          return;
        }
        setRows(data.rows || []);
        setFetchedAt(data.fetchedAt);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => r["MONTH"]).filter(Boolean))),
    [rows]
  );
  const orderTypes = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r["ORDER TYPE"]).filter(Boolean))),
    [rows]
  );
  const locations = useMemo(
    () => Array.from(new Set(rows.map((r) => r["LOCATION"]).filter(Boolean))),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (month !== "all" && r["MONTH"] !== month) return false;
      if (orderType !== "all" && r["ORDER TYPE"] !== orderType) return false;
      if (location !== "all" && r["LOCATION"] !== location) return false;
      if (search) {
        const hay = `${r["STYLE NAME"] || ""} ${r["PO NO"] || ""} ${
          r["ORDER ID"] || ""
        }`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, month, orderType, location, search]);

  const totals = useMemo(() => {
    const planQty = filtered.reduce(
      (sum, r) => sum + toNumber(r["PLAN QTY"]),
      0
    );
    const cuttingQty = filtered.reduce(
      (sum, r) => sum + toNumber(r["CUTTING QTY"]),
      0
    );
    const pendingQty = planQty - cuttingQty;
    const pct = filtered
      .map((r) => toNumber(r["QTY CUT IN %"]))
      .filter((n) => n > 0);
    const avgPct = pct.length
      ? (pct.reduce((a, b) => a + b, 0) / pct.length).toFixed(1)
      : "0";
    return {
      poCount: filtered.length,
      planQty,
      cuttingQty,
      pendingQty,
      avgPct,
    };
  }, [filtered]);

  const monthChartData = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const m = r["MONTH"] || "—";
      if (!map[m]) map[m] = { month: m, planQty: 0, cuttingQty: 0 };
      map[m].planQty += toNumber(r["PLAN QTY"]);
      map[m].cuttingQty += toNumber(r["CUTTING QTY"]);
    });
    return Object.values(map);
  }, [filtered]);

  const orderTypePieData = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const t = r["ORDER TYPE"] || "—";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const locationBarData = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const l = r["LOCATION"] || "—";
      if (!map[l]) map[l] = { location: l, cuttingQty: 0 };
      map[l].cuttingQty += toNumber(r["CUTTING QTY"]);
    });
    return Object.values(map);
  }, [filtered]);

  // Groups rows by a given column and sums plan/cutting/pending qty per group
  function summarizeBy(key) {
    const map = {};
    filtered.forEach((r) => {
      const k = r[key] || "—";
      if (!map[k]) {
        map[k] = { key: k, rows: 0, planQty: 0, cuttingQty: 0 };
      }
      map[k].rows += 1;
      map[k].planQty += toNumber(r["PLAN QTY"]);
      map[k].cuttingQty += toNumber(r["CUTTING QTY"]);
    });
    return Object.values(map)
      .map((g) => ({ ...g, pendingQty: g.planQty - g.cuttingQty }))
      .sort((a, b) => (a.key > b.key ? 1 : -1));
  }

  const monthSummary = useMemo(() => summarizeBy("MONTH"), [filtered]);
  const dateSummary = useMemo(() => summarizeBy("CUTTING DATE"), [filtered]);
  const operationSummary = useMemo(() => summarizeBy("OPERATION"), [filtered]);
  const styleSummary = useMemo(() => summarizeBy("STYLE NAME"), [filtered]);

  // Adds a "% share of total plan qty" to each row of a summary array
  function withPercentShare(summary) {
    const totalPlan = summary.reduce((s, g) => s + g.planQty, 0);
    return summary.map((g) => ({
      ...g,
      pctShare: totalPlan > 0 ? (g.planQty / totalPlan) * 100 : 0,
    }));
  }

  const operationSummaryPct = useMemo(
    () => withPercentShare(operationSummary),
    [operationSummary]
  );
  const styleSummaryPct = useMemo(
    () => withPercentShare(styleSummary),
    [styleSummary]
  );

  // Per-day cutting qty for the "Daily cutting" tab — respects the month dropdown filter
  const dailyCuttingReport = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const d = r["CUTTING DATE"] || "—";
      map[d] = (map[d] || 0) + toNumber(r["CUTTING QTY"]);
    });
    const rowsArr = Object.entries(map)
      .map(([date, cuttingQty]) => ({ date, cuttingQty }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
    const total = rowsArr.reduce((s, r) => s + r.cuttingQty, 0);
    const avgPerDay = rowsArr.length ? total / rowsArr.length : 0;
    return { rows: rowsArr, total, avgPerDay, dayCount: rowsArr.length };
  }, [filtered]);

  const collectionSummary = useMemo(
    () => withPercentShare(summarizeBy("COLLECTION")),
    [filtered]
  );

  const [styleQuery, setStyleQuery] = useState("");
  const styleNamesList = useMemo(
    () => Array.from(new Set(rows.map((r) => r["STYLE NAME"]).filter(Boolean))).sort(),
    [rows]
  );
  const styleSearchResult = useMemo(() => {
    if (!styleQuery.trim()) return null;
    const q = styleQuery.toLowerCase();
    const matches = rows.filter((r) =>
      (r["STYLE NAME"] || "").toLowerCase().includes(q)
    );
    const count = matches.length;
    const planQty = matches.reduce((s, r) => s + toNumber(r["PLAN QTY"]), 0);
    const cuttingQty = matches.reduce(
      (s, r) => s + toNumber(r["CUTTING QTY"]),
      0
    );
    const avgCutting = count ? cuttingQty / count : 0;
    const pctVals = matches
      .map((r) => toNumber(r["QTY CUT IN %"]))
      .filter((n) => n > 0);
    const avgPct = pctVals.length
      ? pctVals.reduce((a, b) => a + b, 0) / pctVals.length
      : 0;
    return { count, planQty, cuttingQty, avgCutting, avgPct };
  }, [rows, styleQuery]);

  // Slicer-filtered month summary — narrows to only the clicked month pills
  const monthSummaryFiltered = useMemo(() => {
    if (selectedMonths.length === 0) return monthSummary;
    return monthSummary.filter((g) => selectedMonths.includes(g.key));
  }, [monthSummary, selectedMonths]);

  const slicerTotals = useMemo(() => {
    return monthSummaryFiltered.reduce(
      (acc, g) => ({
        planQty: acc.planQty + g.planQty,
        cuttingQty: acc.cuttingQty + g.cuttingQty,
        pendingQty: acc.pendingQty + g.pendingQty,
      }),
      { planQty: 0, cuttingQty: 0, pendingQty: 0 }
    );
  }, [monthSummaryFiltered]);

  function toggleMonthSlicer(m) {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  // Day-wise cutting qty breakdown, scoped to whichever months are selected in the slicer
  const dailyBreakdown = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    const scoped = filtered.filter((r) => selectedMonths.includes(r["MONTH"]));
    const map = {};
    scoped.forEach((r) => {
      const d = r["CUTTING DATE"] || "—";
      map[d] = (map[d] || 0) + toNumber(r["CUTTING QTY"]);
    });
    const rowsArr = Object.entries(map)
      .map(([date, cuttingQty]) => ({ date, cuttingQty }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
    const monthTotal = rowsArr.reduce((s, r) => s + r.cuttingQty, 0);
    const avgPerDay = rowsArr.length ? monthTotal / rowsArr.length : 0;
    return { rows: rowsArr, monthTotal, avgPerDay, dayCount: rowsArr.length };
  }, [filtered, selectedMonths]);

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>Cutting room dashboard</h1>
          <p className="sub">Live production tracker, synced from the sheet</p>
        </div>
        {fetchedAt && (
          <span className="refresh-tag">
            Updated {new Date(fetchedAt).toLocaleString("en-IN")}
          </span>
        )}
      </div>

      {status === "loading" && <p className="state">Loading sheet data…</p>}

      {status === "error" && (
        <p className="state error">
          Couldn't load the sheet. Check that SHEET_ID is set in environment
          variables and the sheet is shared as "Anyone with the link —
          Viewer".
        </p>
      )}

      {status === "ready" && (
        <>
          <div className="quick-panel">
            <h2>Style search</h2>
            <div className="style-search-row">
              <select
                className="quick-search"
                value={
                  styleNamesList.includes(styleQuery) ? styleQuery : ""
                }
                onChange={(e) => setStyleQuery(e.target.value)}
              >
                <option value="">Select a style…</option>
                {styleNamesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="quick-search"
                placeholder="…or type to search a style name"
                value={styleQuery}
                onChange={(e) => setStyleQuery(e.target.value)}
              />
            </div>
            {styleSearchResult && (
              <div className="cards" style={{ marginTop: 12, marginBottom: 4 }}>
                <div className="card">
                  <p className="label">Times cut (orders)</p>
                  <p className="value">{styleSearchResult.count}</p>
                </div>
                <div className="card">
                  <p className="label">Plan qty</p>
                  <p className="value">
                    {styleSearchResult.planQty.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="card accent">
                  <p className="label">Cutting qty</p>
                  <p className="value">
                    {styleSearchResult.cuttingQty.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="card accent">
                  <p className="label">Avg cutting qty / order</p>
                  <p className="value">
                    {styleSearchResult.avgCutting.toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <div className="card accent">
                  <p className="label">Avg qty cut %</p>
                  <p className="value">
                    {styleSearchResult.avgPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <div className="quick-grid">
              <div>
                <h2>Per-day cutting qty (total)</h2>
                <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Cutting date</th>
                        <th>Total qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyCuttingReport.rows.map((r) => (
                        <tr key={r.date}>
                          <td>{r.date}</td>
                          <td>{r.cuttingQty.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="row-count">
                  Total: {dailyCuttingReport.total.toLocaleString("en-IN")}
                  {" · "}Avg/day:{" "}
                  {dailyCuttingReport.avgPerDay.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>

              <div>
                <h2>Collection-wise cutting qty</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Collection</th>
                        <th>Plan qty</th>
                        <th>Cutting qty</th>
                        <th>% share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionSummary.map((g) => (
                        <tr key={g.key}>
                          <td>{g.key}</td>
                          <td>{g.planQty.toLocaleString("en-IN")}</td>
                          <td>{g.cuttingQty.toLocaleString("en-IN")}</td>
                          <td>{g.pctShare.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="cards">
            <div className="card">
              <p className="label">Rows in view</p>
              <p className="value">{totals.poCount}</p>
            </div>
            <div className="card">
              <p className="label">Total plan qty</p>
              <p className="value">{totals.planQty.toLocaleString("en-IN")}</p>
            </div>
            <div className="card accent">
              <p className="label">Total cutting qty</p>
              <p className="value">
                {totals.cuttingQty.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="card pending">
              <p className="label">Pending qty</p>
              <p className="value">
                {totals.pendingQty.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="card accent">
              <p className="label">Avg qty cut %</p>
              <p className="value">{totals.avgPct}%</p>
            </div>
          </div>

          <div className="panels">
            <div className="panel">
              <h2>Plan qty vs cutting qty by month</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="planQty" name="Plan qty" fill="#1e3a8a" />
                  <Bar dataKey="cuttingQty" name="Cutting qty" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h2>Orders by type</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={orderTypePieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {orderTypePieData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {locations.length > 1 && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <h2>Cutting qty by location</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={locationBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="location" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="cuttingQty" name="Cutting qty" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="panel">
            <div className="view-tabs">
              <button
                className={viewMode === "log" ? "active" : ""}
                onClick={() => setViewMode("log")}
              >
                Order log
              </button>
              <button
                className={viewMode === "month" ? "active" : ""}
                onClick={() => setViewMode("month")}
              >
                Month-wise pending
              </button>
              <button
                className={viewMode === "date" ? "active" : ""}
                onClick={() => setViewMode("date")}
              >
                Date-wise pending
              </button>
              <button
                className={viewMode === "operation" ? "active" : ""}
                onClick={() => setViewMode("operation")}
              >
                Operation overview
              </button>
              <button
                className={viewMode === "style" ? "active" : ""}
                onClick={() => setViewMode("style")}
              >
                Style-wise
              </button>
            </div>

            {viewMode === "month" && (
              <div className="slicer">
                {monthSummary.map((g) => {
                  const active =
                    selectedMonths.length === 0 ||
                    selectedMonths.includes(g.key);
                  return (
                    <button
                      key={g.key}
                      className={`slicer-pill ${active ? "on" : ""}`}
                      onClick={() => toggleMonthSlicer(g.key)}
                    >
                      {g.key}
                    </button>
                  );
                })}
                {selectedMonths.length > 0 && (
                  <button
                    className="slicer-clear"
                    onClick={() => setSelectedMonths([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            <div className="filters">
              {viewMode !== "month" && (
                <select value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="all">All months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
              >
                <option value="all">All order types</option>
                {orderTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="all">All locations</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              {viewMode === "log" && (
                <input
                  placeholder="Search style, PO no, order id"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </div>

            {viewMode === "log" && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 200).map((row, i) => (
                        <tr key={i}>
                          {columns.map((c) => (
                            <td key={c}>
                              {c === "ORDER TYPE" && row[c] ? (
                                <span className="badge">{row[c]}</span>
                              ) : (
                                row[c]
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="row-count">
                  Showing {Math.min(filtered.length, 200)} of {filtered.length}{" "}
                  rows
                </p>
              </>
            )}

            {viewMode === "month" && (
              <>
                {selectedMonths.length > 0 && (
                  <div className="slicer-summary">
                    Selected: Plan {slicerTotals.planQty.toLocaleString("en-IN")}
                    {" · "}Cutting {slicerTotals.cuttingQty.toLocaleString("en-IN")}
                    {" · "}
                    <strong>
                      Pending {slicerTotals.pendingQty.toLocaleString("en-IN")}
                    </strong>
                  </div>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Orders</th>
                        <th>Plan qty</th>
                        <th>Cutting qty</th>
                        <th>Pending qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthSummaryFiltered.map((g) => (
                        <tr key={g.key}>
                          <td>{g.key}</td>
                          <td>{g.rows}</td>
                          <td>{g.planQty.toLocaleString("en-IN")}</td>
                          <td>{g.cuttingQty.toLocaleString("en-IN")}</td>
                          <td
                            style={{
                              color: g.pendingQty > 0 ? "#a32d2d" : "inherit",
                              fontWeight: 700,
                            }}
                          >
                            {g.pendingQty.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedMonths.length > 0 && (
                  <div style={{ marginTop: 22 }}>
                    <h2>Per-day cutting qty ({selectedMonths.join(", ")})</h2>
                    <div className="cards" style={{ marginBottom: 14 }}>
                      <div className="card">
                        <p className="label">Month total cutting qty</p>
                        <p className="value">
                          {dailyBreakdown.monthTotal.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="card accent">
                        <p className="label">Days with cutting</p>
                        <p className="value">{dailyBreakdown.dayCount}</p>
                      </div>
                      <div className="card accent">
                        <p className="label">Avg cutting qty / day</p>
                        <p className="value">
                          {dailyBreakdown.avgPerDay.toLocaleString("en-IN", {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Cutting date</th>
                            <th>Cutting qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyBreakdown.rows.map((r) => (
                            <tr key={r.date}>
                              <td>{r.date}</td>
                              <td>{r.cuttingQty.toLocaleString("en-IN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {viewMode === "date" && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cutting date</th>
                      <th>Orders</th>
                      <th>Plan qty</th>
                      <th>Cutting qty</th>
                      <th>Pending qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateSummary.map((g) => (
                      <tr key={g.key}>
                        <td>{g.key}</td>
                        <td>{g.rows}</td>
                        <td>{g.planQty.toLocaleString("en-IN")}</td>
                        <td>{g.cuttingQty.toLocaleString("en-IN")}</td>
                        <td
                          style={{
                            color: g.pendingQty > 0 ? "#a32d2d" : "inherit",
                            fontWeight: 700,
                          }}
                        >
                          {g.pendingQty.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === "operation" && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Operation</th>
                      <th>Orders</th>
                      <th>Plan qty</th>
                      <th>Cutting qty</th>
                      <th>% share of plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationSummaryPct.map((g) => (
                      <tr key={g.key}>
                        <td>{g.key}</td>
                        <td>{g.rows}</td>
                        <td>{g.planQty.toLocaleString("en-IN")}</td>
                        <td>{g.cuttingQty.toLocaleString("en-IN")}</td>
                        <td style={{ fontWeight: 700 }}>
                          {g.pctShare.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === "style" && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Style name</th>
                      <th>Orders</th>
                      <th>Plan qty</th>
                      <th>Cutting qty</th>
                      <th>% share of plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {styleSummaryPct.map((g) => (
                      <tr key={g.key}>
                        <td>{g.key}</td>
                        <td>{g.rows}</td>
                        <td>{g.planQty.toLocaleString("en-IN")}</td>
                        <td>{g.cuttingQty.toLocaleString("en-IN")}</td>
                        <td style={{ fontWeight: 700 }}>
                          {g.pctShare.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
