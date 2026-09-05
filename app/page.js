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

const PIE_COLORS = [
  "#1e3a8a",
  "#2563eb",
  "#60a5fa",
  "#94a3b8",
  "#0ea5e9",
];

function toNumber(val) {
  if (val === undefined || val === null) return 0;

  const cleaned = String(val).replace(/[,%\s]/g, "");
  const n = parseFloat(cleaned);

  return Number.isNaN(n) ? 0 : n;
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [fetchedAt, setFetchedAt] = useState(null);

  const [month, setMonth] = useState("all");
  const [orderType, setOrderType] = useState("all");
  const [location, setLocation] = useState("all");

  const [search, setSearch] = useState("");

  const [viewMode, setViewMode] = useState("log");

  const [selectedMonths, setSelectedMonths] = useState([]);

  // Style search
  const [styleQuery, setStyleQuery] = useState("");
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);

  // ============================================================
  // LOAD DATA
  // ============================================================

  async function loadData() {
    try {
      const r = await fetch("/api/sheet-data", {
        cache: "no-store",
      });

      if (!r.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await r.json();

      if (data.error) {
        setStatus("error");
        return;
      }

      setRows(data.rows || []);
      setFetchedAt(data.fetchedAt || new Date().toISOString());
      setStatus("ready");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // ============================================================
  // AUTO REFRESH - EVERY 1 MINUTE
  // ============================================================

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // FILTER VALUES
  // ============================================================

  const months = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => String(r["MONTH"] || "").trim())
          .filter(Boolean)
      )
    );
  }, [rows]);

  const orderTypes = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => String(r["ORDER TYPE"] || "").trim())
          .filter(Boolean)
      )
    );
  }, [rows]);

  const locations = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => String(r["LOCATION"] || "").trim())
          .filter(Boolean)
      )
    );
  }, [rows]);

  // ============================================================
  // MAIN FILTER
  // ============================================================

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (month !== "all" && r["MONTH"] !== month) {
        return false;
      }

      if (orderType !== "all" && r["ORDER TYPE"] !== orderType) {
        return false;
      }

      if (location !== "all" && r["LOCATION"] !== location) {
        return false;
      }

      if (search.trim()) {
        const hay = `
          ${r["STYLE NAME"] || ""}
          ${r["PO NO"] || ""}
          ${r["ORDER ID"] || ""}
        `.toLowerCase();

        if (!hay.includes(search.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [rows, month, orderType, location, search]);

  // ============================================================
  // TOTALS
  // ============================================================

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
      ? (
          pct.reduce((a, b) => a + b, 0) / pct.length
        ).toFixed(1)
      : "0";

    return {
      poCount: filtered.length,
      planQty,
      cuttingQty,
      pendingQty,
      avgPct,
    };
  }, [filtered]);

  // ============================================================
  // MONTH CHART
  // ============================================================

  const monthChartData = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const m = r["MONTH"] || "—";

      if (!map[m]) {
        map[m] = {
          month: m,
          planQty: 0,
          cuttingQty: 0,
        };
      }

      map[m].planQty += toNumber(r["PLAN QTY"]);
      map[m].cuttingQty += toNumber(r["CUTTING QTY"]);
    });

    return Object.values(map);
  }, [filtered]);

  // ============================================================
  // ORDER TYPE PIE
  // ============================================================

  const orderTypePieData = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const type = r["ORDER TYPE"] || "—";

      map[type] = (map[type] || 0) + 1;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filtered]);

  // ============================================================
  // LOCATION CHART
  // ============================================================

  const locationBarData = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const loc = r["LOCATION"] || "—";

      if (!map[loc]) {
        map[loc] = {
          location: loc,
          cuttingQty: 0,
        };
      }

      map[loc].cuttingQty += toNumber(r["CUTTING QTY"]);
    });

    return Object.values(map);
  }, [filtered]);

  // ============================================================
  // GENERIC SUMMARY
  // ============================================================

  function summarizeBy(key) {
    const map = {};

    filtered.forEach((r) => {
      const k = r[key] || "—";

      if (!map[k]) {
        map[k] = {
          key: k,
          rows: 0,
          planQty: 0,
          cuttingQty: 0,
        };
      }

      map[k].rows += 1;
      map[k].planQty += toNumber(r["PLAN QTY"]);
      map[k].cuttingQty += toNumber(r["CUTTING QTY"]);
    });

    return Object.values(map)
      .map((g) => ({
        ...g,
        pendingQty: g.planQty - g.cuttingQty,
      }))
      .sort((a, b) =>
        String(a.key).localeCompare(
          String(b.key),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        )
      );
  }

  const monthSummary = useMemo(
    () => summarizeBy("MONTH"),
    [filtered]
  );

  const dateSummary = useMemo(
    () => summarizeBy("CUTTING DATE"),
    [filtered]
  );

  const operationSummary = useMemo(
    () => summarizeBy("OPERATION"),
    [filtered]
  );

  const styleSummary = useMemo(
    () => summarizeBy("STYLE NAME"),
    [filtered]
  );

  // ============================================================
  // PERCENT SHARE
  // ============================================================

  function withPercentShare(summary) {
    const totalPlan = summary.reduce(
      (s, g) => s + g.planQty,
      0
    );

    return summary.map((g) => ({
      ...g,
      pctShare:
        totalPlan > 0
          ? (g.planQty / totalPlan) * 100
          : 0,
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

  // ============================================================
  // MONTH SLICER
  // ============================================================

  const monthSummaryFiltered = useMemo(() => {
    if (selectedMonths.length === 0) {
      return monthSummary;
    }

    return monthSummary.filter((g) =>
      selectedMonths.includes(g.key)
    );
  }, [monthSummary, selectedMonths]);

  const slicerTotals = useMemo(() => {
    return monthSummaryFiltered.reduce(
      (acc, g) => ({
        planQty: acc.planQty + g.planQty,
        cuttingQty: acc.cuttingQty + g.cuttingQty,
        pendingQty: acc.pendingQty + g.pendingQty,
      }),
      {
        planQty: 0,
        cuttingQty: 0,
        pendingQty: 0,
      }
    );
  }, [monthSummaryFiltered]);

  function toggleMonthSlicer(m) {
    setSelectedMonths((prev) =>
      prev.includes(m)
        ? prev.filter((x) => x !== m)
        : [...prev, m]
    );
  }

  // ============================================================
  // STYLE LIST
  // ============================================================

  const styleNamesList = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) =>
            String(r["STYLE NAME"] || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [rows]);

  // ============================================================
  // STYLE AUTOCOMPLETE
  // ============================================================

  const filteredStyleNames = useMemo(() => {
    const q = styleQuery.trim().toLowerCase();

    if (!q) {
      return styleNamesList.slice(0, 30);
    }

    return styleNamesList
      .filter((style) =>
        style.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [styleNamesList, styleQuery]);

  // ============================================================
  // SELECTED STYLE SUMMARY
  // ============================================================

  const styleSearchResult = useMemo(() => {
    if (!styleQuery.trim()) {
      return null;
    }

    const selectedStyle = styleQuery.trim();

    const matches = rows.filter(
      (r) =>
        String(r["STYLE NAME"] || "").trim() ===
        selectedStyle
    );

    const planQty = matches.reduce(
      (sum, r) => sum + toNumber(r["PLAN QTY"]),
      0
    );

    const cuttingQty = matches.reduce(
      (sum, r) => sum + toNumber(r["CUTTING QTY"]),
      0
    );

    const difference = cuttingQty - planQty;

    const differencePercent =
      planQty > 0
        ? (difference / planQty) * 100
        : 0;

    let result = "OK";

    if (differencePercent > 10) {
      result = "EXCESS";
    } else if (differencePercent < 0) {
      result = "SHORT";
    }

    return {
      count: matches.length,
      planQty,
      cuttingQty,
      difference,
      differencePercent,
      result,
    };
  }, [rows, styleQuery]);

  // ============================================================
  // SELECTED STYLE MONTH-WISE ANALYSIS
  // ============================================================

  const selectedStyleMonthSummary = useMemo(() => {
    if (!styleQuery.trim()) {
      return [];
    }

    const selectedStyle = styleQuery.trim();

    const styleRows = rows.filter(
      (r) =>
        String(r["STYLE NAME"] || "").trim() ===
        selectedStyle
    );

    const monthMap = {};

    styleRows.forEach((r) => {
      const m = String(
        r["MONTH"] || "Unknown"
      ).trim();

      if (!monthMap[m]) {
        monthMap[m] = {
          month: m,
          count: 0,
          planQty: 0,
          cuttingQty: 0,
        };
      }

      monthMap[m].count += 1;

      monthMap[m].planQty += toNumber(
        r["PLAN QTY"]
      );

      monthMap[m].cuttingQty += toNumber(
        r["CUTTING QTY"]
      );
    });

    return Object.values(monthMap)
      .map((item) => {
        const difference =
          item.cuttingQty - item.planQty;

        const differencePercent =
          item.planQty > 0
            ? (difference / item.planQty) * 100
            : 0;

        let result = "OK";

        if (differencePercent > 10) {
          result = "EXCESS";
        } else if (differencePercent < 0) {
          result = "SHORT";
        }

        return {
          ...item,
          difference,
          differencePercent,
          result,
        };
      })
      .sort((a, b) =>
        a.month.localeCompare(
          b.month,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        )
      );
  }, [rows, styleQuery]);

  // ============================================================
  // COLUMNS
  // ============================================================

  const columns = rows.length
    ? Object.keys(rows[0])
    : [];

  // ============================================================
  // STATUS STYLE
  // ============================================================

  function getStatusStyle(result) {
    if (result === "EXCESS") {
      return {
        background: "#fee2e2",
        color: "#b91c1c",
        fontWeight: 800,
      };
    }

    if (result === "SHORT") {
      return {
        background: "#fff7ed",
        color: "#c2410c",
        fontWeight: 800,
      };
    }

    return {
      background: "#dcfce7",
      color: "#15803d",
      fontWeight: 800,
    };
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="wrap">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="topbar">

        <div>
          <h1>Cutting Room Dashboard</h1>

          <p className="sub">
            Live production tracker, synced from the sheet
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>

          {fetchedAt && (
            <span className="refresh-tag">
              Updated{" "}
              {new Date(fetchedAt).toLocaleString(
                "en-IN"
              )}
            </span>
          )}

          <button
            onClick={loadData}
            style={{
              border: "none",
              padding: "9px 14px",
              borderRadius: 8,
              background: "#1e3a8a",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ↻ Refresh
          </button>

        </div>

      </div>

      {/* ======================================================
          STATUS
      ====================================================== */}

      {status === "loading" && (
        <p className="state">
          Loading sheet data…
        </p>
      )}

      {status === "error" && (
        <p className="state error">
          Couldn't load the sheet. Check that SHEET_ID
          is set in environment variables and the sheet
          is shared as "Anyone with the link — Viewer".
        </p>
      )}

      {status === "ready" && (
        <>

          {/* ==================================================
              TOTAL CARDS
          ================================================== */}

          <div className="cards">

            <div className="card">
              <p className="label">
                Rows in view
              </p>

              <p className="value">
                {totals.poCount}
              </p>
            </div>

            <div className="card">
              <p className="label">
                Total plan qty
              </p>

              <p className="value">
                {totals.planQty.toLocaleString(
                  "en-IN"
                )}
              </p>
            </div>

            <div className="card accent">
              <p className="label">
                Total cutting qty
              </p>

              <p className="value">
                {totals.cuttingQty.toLocaleString(
                  "en-IN"
                )}
              </p>
            </div>

            <div className="card pending">
              <p className="label">
                Pending qty
              </p>

              <p className="value">
                {totals.pendingQty.toLocaleString(
                  "en-IN"
                )}
              </p>
            </div>

            <div className="card accent">
              <p className="label">
                Avg qty cut %
              </p>

              <p className="value">
                {totals.avgPct}%
              </p>
            </div>

          </div>

          {/* ==================================================
              STYLE SEARCH
          ================================================== */}

          <div
            className="panel"
            style={{
              marginTop: 16,
              position: "relative",
              zIndex: 20,
            }}
          >

            <h2>
              🔍 Style Search
            </h2>

            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 500,
              }}
            >

              <input
                type="text"
                value={styleQuery}
                placeholder="Search Style Name..."
                onChange={(e) => {
                  setStyleQuery(e.target.value);
                  setShowStyleDropdown(true);
                }}
                onFocus={() =>
                  setShowStyleDropdown(true)
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 42px 12px 14px",
                  border:
                    "1px solid #cbd5e1",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                }}
              />

              {styleQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStyleQuery("");
                    setShowStyleDropdown(false);
                  }}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: 9,
                    width: 28,
                    height: 28,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 20,
                    color: "#64748b",
                  }}
                >
                  ×
                </button>
              )}

              {/* AUTOCOMPLETE DROPDOWN */}

              {showStyleDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 5px)",
                    left: 0,
                    right: 0,
                    zIndex: 99999,
                    background: "#ffffff",
                    border:
                      "1px solid #dbe3ef",
                    borderRadius: 10,
                    maxHeight: 320,
                    overflowY: "auto",
                    boxShadow:
                      "0 12px 30px rgba(15,23,42,0.18)",
                  }}
                >

                  {filteredStyleNames.length ===
                  0 ? (
                    <div
                      style={{
                        padding: 14,
                        color: "#64748b",
                      }}
                    >
                      No style found
                    </div>
                  ) : (
                    filteredStyleNames.map(
                      (style) => (
                        <button
                          type="button"
                          key={style}
                          onClick={() => {
                            setStyleQuery(
                              style
                            );
                            setShowStyleDropdown(
                              false
                            );
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding:
                              "11px 14px",
                            border: "none",
                            borderBottom:
                              "1px solid #f1f5f9",
                            background:
                              "#ffffff",
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          👕 {style}
                        </button>
                      )
                    )
                  )}

                </div>
              )}

            </div>

            {styleQuery && (
              <p
                style={{
                  marginTop: 8,
                  color: "#64748b",
                  fontSize: 12,
                }}
              >
                Selected style:{" "}
                <strong>
                  {styleQuery}
                </strong>
              </p>
            )}

          </div>

          {/* ==================================================
              SELECTED STYLE SUMMARY
          ================================================== */}

          {styleSearchResult && (
            <div
              className="cards"
              style={{
                marginTop: 16,
              }}
            >

              <div className="card">
                <p className="label">
                  Times Cut / Orders
                </p>

                <p className="value">
                  {styleSearchResult.count}
                </p>
              </div>

              <div className="card">
                <p className="label">
                  Total Plan Qty
                </p>

                <p className="value">
                  {styleSearchResult.planQty.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <div className="card accent">
                <p className="label">
                  Total Cutting Qty
                </p>

                <p className="value">
                  {styleSearchResult.cuttingQty.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <div className="card">
                <p className="label">
                  Difference Qty
                </p>

                <p
                  className="value"
                  style={{
                    color:
                      styleSearchResult.difference >
                      0
                        ? "#b91c1c"
                        : styleSearchResult.difference <
                          0
                        ? "#c2410c"
                        : "#15803d",
                  }}
                >
                  {styleSearchResult.difference > 0
                    ? "+"
                    : ""}
                  {styleSearchResult.difference.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <div className="card">
                <p className="label">
                  Difference %
                </p>

                <p className="value">
                  {styleSearchResult.differencePercent >
                  0
                    ? "+"
                    : ""}
                  {styleSearchResult.differencePercent.toFixed(
                    1
                  )}
                  %
                </p>
              </div>

              <div className="card">
                <p className="label">
                  Overall Status
                </p>

                <p
                  className="value"
                  style={{
                    fontSize: 22,
                    ...getStatusStyle(
                      styleSearchResult.result
                    ),
                    padding: "5px 10px",
                    borderRadius: 8,
                  }}
                >
                  {styleSearchResult.result}
                </p>
              </div>

            </div>
          )}

          {/* ==================================================
              SELECTED STYLE MONTH-WISE ANALYSIS
          ================================================== */}

          {styleQuery && (
            <div
              className="panel"
              style={{
                marginTop: 16,
              }}
            >

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >

                <div>
                  <h2>
                    📊 Month-wise Cutting Analysis
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: "#64748b",
                      fontSize: 13,
                    }}
                  >
                    {styleQuery}
                  </p>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  More than 10% cutting =
                  <strong
                    style={{
                      color: "#b91c1c",
                      marginLeft: 4,
                    }}
                  >
                    EXCESS
                  </strong>
                </div>

              </div>

              <div className="table-wrap">

                <table>

                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Count</th>
                      <th>Plan Qty</th>
                      <th>Cutting Qty</th>
                      <th>Difference Qty</th>
                      <th>Difference %</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>

                    {selectedStyleMonthSummary.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            textAlign: "center",
                            padding: 20,
                            color: "#64748b",
                          }}
                        >
                          No data found for this
                          style.
                        </td>
                      </tr>
                    ) : (
                      selectedStyleMonthSummary.map(
                        (item) => (
                          <tr
                            key={item.month}
                          >

                            <td>
                              <strong>
                                {item.month}
                              </strong>
                            </td>

                            <td>
                              {item.count}
                            </td>

                            <td>
                              {item.planQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td>
                              {item.cuttingQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td
                              style={{
                                fontWeight: 700,
                                color:
                                  item.difference >
                                  0
                                    ? "#b91c1c"
                                    : item.difference <
                                      0
                                    ? "#c2410c"
                                    : "#15803d",
                              }}
                            >
                              {item.difference >
                              0
                                ? "+"
                                : ""}
                              {item.difference.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td
                              style={{
                                fontWeight: 700,
                              }}
                            >
                              {item.differencePercent >
                              0
                                ? "+"
                                : ""}
                              {item.differencePercent.toFixed(
                                1
                              )}
                              %
                            </td>

                            <td>
                              <span
                                style={{
                                  display:
                                    "inline-block",
                                  padding:
                                    "5px 10px",
                                  borderRadius: 7,
                                  fontSize: 12,
                                  ...getStatusStyle(
                                    item.result
                                  ),
                                }}
                              >
                                {item.result}
                              </span>
                            </td>

                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>
          )}

          {/* ==================================================
              MAIN CHARTS
          ================================================== */}

          <div className="panels">

            <div className="panel">

              <h2>
                Plan Qty vs Cutting Qty by Month
              </h2>

              <ResponsiveContainer
                width="100%"
                height={260}
              >
                <BarChart
                  data={monthChartData}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="month"
                    tick={{
                      fontSize: 12,
                    }}
                  />

                  <YAxis
                    tick={{
                      fontSize: 12,
                    }}
                  />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="planQty"
                    name="Plan Qty"
                    fill="#1e3a8a"
                  />

                  <Bar
                    dataKey="cuttingQty"
                    name="Cutting Qty"
                    fill="#60a5fa"
                  />

                </BarChart>
              </ResponsiveContainer>

            </div>

            <div className="panel">

              <h2>
                Orders by Type
              </h2>

              <ResponsiveContainer
                width="100%"
                height={260}
              >

                <PieChart>

                  <Pie
                    data={
                      orderTypePieData
                    }
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label={({
                      name,
                      value,
                    }) =>
                      `${name}: ${value}`
                    }
                  >

                    {orderTypePieData.map(
                      (entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={
                            PIE_COLORS[
                              i %
                                PIE_COLORS.length
                            ]
                          }
                        />
                      )
                    )}

                  </Pie>

                  <Tooltip />

                </PieChart>

              </ResponsiveContainer>

            </div>

          </div>

          {/* ==================================================
              LOCATION CHART
          ================================================== */}

          {locations.length > 1 && (
            <div
              className="panel"
              style={{
                marginBottom: 16,
              }}
            >

              <h2>
                Cutting Qty by Location
              </h2>

              <ResponsiveContainer
                width="100%"
                height={220}
              >

                <BarChart
                  data={
                    locationBarData
                  }
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="location"
                    tick={{
                      fontSize: 12,
                    }}
                  />

                  <YAxis
                    tick={{
                      fontSize: 12,
                    }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="cuttingQty"
                    name="Cutting Qty"
                    fill="#2563eb"
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>
          )}

          {/* ==================================================
              MAIN DATA PANEL
          ================================================== */}

          <div className="panel">

            {/* TABS */}

            <div className="view-tabs">

              <button
                className={
                  viewMode === "log"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setViewMode("log")
                }
              >
                Order Log
              </button>

              <button
                className={
                  viewMode === "month"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setViewMode("month")
                }
              >
                Month-wise Pending
              </button>

              <button
                className={
                  viewMode === "date"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setViewMode("date")
                }
              >
                Date-wise Pending
              </button>

              <button
                className={
                  viewMode === "operation"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setViewMode("operation")
                }
              >
                Operation Overview
              </button>

              <button
                className={
                  viewMode === "style"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setViewMode("style")
                }
              >
                Style-wise
              </button>

            </div>

            {/* ==================================================
                MONTH SLICER
            ================================================== */}

            {viewMode === "month" && (
              <div className="slicer">

                {monthSummary.map((g) => {

                  const active =
                    selectedMonths.length ===
                      0 ||
                    selectedMonths.includes(
                      g.key
                    );

                  return (
                    <button
                      key={g.key}
                      className={`slicer-pill ${
                        active
                          ? "on"
                          : ""
                      }`}
                      onClick={() =>
                        toggleMonthSlicer(
                          g.key
                        )
                      }
                    >
                      {g.key}
                    </button>
                  );
                })}

                {selectedMonths.length >
                  0 && (
                  <button
                    className="slicer-clear"
                    onClick={() =>
                      setSelectedMonths(
                        []
                      )
                    }
                  >
                    Clear
                  </button>
                )}

              </div>
            )}

            {/* ==================================================
                FILTERS
            ================================================== */}

            <div className="filters">

              {viewMode !== "month" && (
                <select
                  value={month}
                  onChange={(e) =>
                    setMonth(
                      e.target.value
                    )
                  }
                >

                  <option value="all">
                    All months
                  </option>

                  {months.map((m) => (
                    <option
                      key={m}
                      value={m}
                    >
                      {m}
                    </option>
                  ))}

                </select>
              )}

              <select
                value={orderType}
                onChange={(e) =>
                  setOrderType(
                    e.target.value
                  )
                }
              >

                <option value="all">
                  All order types
                </option>

                {orderTypes.map((t) => (
                  <option
                    key={t}
                    value={t}
                  >
                    {t}
                  </option>
                ))}

              </select>

              <select
                value={location}
                onChange={(e) =>
                  setLocation(
                    e.target.value
                  )
                }
              >

                <option value="all">
                  All locations
                </option>

                {locations.map((l) => (
                  <option
                    key={l}
                    value={l}
                  >
                    {l}
                  </option>
                ))}

              </select>

              {viewMode === "log" && (
                <input
                  placeholder="Search style, PO no, order id"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />
              )}

            </div>

            {/* ==================================================
                ORDER LOG
            ================================================== */}

            {viewMode === "log" && (
              <>
                <div className="table-wrap">

                  <table>

                    <thead>
                      <tr>
                        {columns.map(
                          (c) => (
                            <th key={c}>
                              {c}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>

                      {filtered
                        .slice(0, 200)
                        .map(
                          (row, i) => (
                            <tr key={i}>

                              {columns.map(
                                (c) => (
                                  <td
                                    key={c}
                                  >

                                    {c ===
                                      "ORDER TYPE" &&
                                    row[c] ? (
                                      <span className="badge">
                                        {
                                          row[
                                            c
                                          ]
                                        }
                                      </span>
                                    ) : (
                                      row[c]
                                    )}

                                  </td>
                                )
                              )}

                            </tr>
                          )
                        )}

                    </tbody>

                  </table>

                </div>

                <p className="row-count">

                  Showing{" "}
                  {Math.min(
                    filtered.length,
                    200
                  )}{" "}
                  of{" "}
                  {filtered.length}{" "}
                  rows

                </p>

              </>
            )}

            {/* ==================================================
                MONTH VIEW
            ================================================== */}

            {viewMode === "month" && (
              <>

                {selectedMonths.length >
                  0 && (
                  <div className="slicer-summary">

                    Selected: Plan{" "}
                    {slicerTotals.planQty.toLocaleString(
                      "en-IN"
                    )}

                    {" · "}

                    Cutting{" "}
                    {slicerTotals.cuttingQty.toLocaleString(
                      "en-IN"
                    )}

                    {" · "}

                    <strong>
                      Pending{" "}
                      {slicerTotals.pendingQty.toLocaleString(
                        "en-IN"
                      )}
                    </strong>

                  </div>
                )}

                <div className="table-wrap">

                  <table>

                    <thead>
                      <tr>
                        <th>
                          Month
                        </th>

                        <th>
                          Orders
                        </th>

                        <th>
                          Plan Qty
                        </th>

                        <th>
                          Cutting Qty
                        </th>

                        <th>
                          Pending Qty
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {monthSummaryFiltered.map(
                        (g) => (
                          <tr
                            key={g.key}
                          >

                            <td>
                              {g.key}
                            </td>

                            <td>
                              {g.rows}
                            </td>

                            <td>
                              {g.planQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td>
                              {g.cuttingQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td
                              style={{
                                color:
                                  g.pendingQty >
                                  0
                                    ? "#a32d2d"
                                    : "inherit",
                                fontWeight: 700,
                              }}
                            >
                              {g.pendingQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </>
            )}

            {/* ==================================================
                DATE VIEW
            ================================================== */}

            {viewMode === "date" && (
              <div className="table-wrap">

                <table>

                  <thead>
                    <tr>

                      <th>
                        Cutting Date
                      </th>

                      <th>
                        Orders
                      </th>

                      <th>
                        Plan Qty
                      </th>

                      <th>
                        Cutting Qty
                      </th>

                      <th>
                        Pending Qty
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {dateSummary.map(
                      (g) => (
                        <tr
                          key={g.key}
                        >

                          <td>
                            {g.key}
                          </td>

                          <td>
                            {g.rows}
                          </td>

                          <td>
                            {g.planQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td>
                            {g.cuttingQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td
                            style={{
                              color:
                                g.pendingQty >
                                0
                                  ? "#a32d2d"
                                  : "inherit",
                              fontWeight: 700,
                            }}
                          >
                            {g.pendingQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

            {/* ==================================================
                OPERATION VIEW
            ================================================== */}

            {viewMode ===
              "operation" && (
              <div className="table-wrap">

                <table>

                  <thead>
                    <tr>

                      <th>
                        Operation
                      </th>

                      <th>
                        Orders
                      </th>

                      <th>
                        Plan Qty
                      </th>

                      <th>
                        Cutting Qty
                      </th>

                      <th>
                        Pending Qty
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {operationSummary.map(
                      (g) => (
                        <tr
                          key={g.key}
                        >

                          <td>
                            {g.key}
                          </td>

                          <td>
                            {g.rows}
                          </td>

                          <td>
                            {g.planQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td>
                            {g.cuttingQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td
                            style={{
                              color:
                                g.pendingQty >
                                0
                                  ? "#a32d2d"
                                  : "inherit",
                              fontWeight: 700,
                            }}
                          >
                            {g.pendingQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

            {/* ==================================================
                STYLE VIEW
            ================================================== */}

            {viewMode === "style" && (
              <div className="table-wrap">

                <table>

                  <thead>
                    <tr>

                      <th>
                        Style Name
                      </th>

                      <th>
                        Orders
                      </th>

                      <th>
                        Plan Qty
                      </th>

                      <th>
                        Cutting Qty
                      </th>

                      <th>
                        Pending Qty
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {styleSummary.map(
                      (g) => (
                        <tr
                          key={g.key}
                        >

                          <td>
                            {g.key}
                          </td>

                          <td>
                            {g.rows}
                          </td>

                          <td>
                            {g.planQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td>
                            {g.cuttingQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td
                            style={{
                              color:
                                g.pendingQty >
                                0
                                  ? "#a32d2d"
                                  : "inherit",
                              fontWeight: 700,
                            }}
                          >
                            {g.pendingQty.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                        </tr>
                      )
                    )}

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
