"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Filters
  const [month, setMonth] = useState("all");
  const [orderType, setOrderType] = useState("all");
  const [location, setLocation] = useState("all");
  const [search, setSearch] = useState("");

  // Views
  const [viewMode, setViewMode] = useState("log");
  const [selectedMonths, setSelectedMonths] = useState([]);

  // View Checking
  const [viewChecking, setViewChecking] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  // Loading state for manual refresh
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetch data from Google Sheet API
   */
  const loadData = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setRefreshing(true);
      }

      const response = await fetch("/api/sheet-data", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();

      if (data.error) {
        setStatus("error");
        return;
      }

      setRows(data.rows || []);
      setFetchedAt(data.fetchedAt || new Date().toISOString());
      setLastRefresh(new Date());

      setStatus("ready");
    } catch (error) {
      console.error(error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Auto refresh every 1 minute
   */
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [loadData]);

  /**
   * Dropdown values
   */
  const months = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r["MONTH"]).filter(Boolean))
    );
  }, [rows]);

  const orderTypes = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r["ORDER TYPE"]).filter(Boolean))
    );
  }, [rows]);

  const locations = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r["LOCATION"]).filter(Boolean))
    );
  }, [rows]);

  /**
   * Main filtering
   */
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
        const searchText = search.toLowerCase().trim();

        const haystack = `
          ${r["STYLE NAME"] || ""}
          ${r["PO NO"] || ""}
          ${r["ORDER ID"] || ""}
          ${r["ORDER TYPE"] || ""}
          ${r["LOCATION"] || ""}
          ${r["OPERATION"] || ""}
        `.toLowerCase();

        if (!haystack.includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }, [rows, month, orderType, location, search]);

  /**
   * KPI totals
   */
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

    const cuttingPercent =
      planQty > 0 ? (cuttingQty / planQty) * 100 : 0;

    const pendingPercent =
      planQty > 0 ? (pendingQty / planQty) * 100 : 0;

    return {
      poCount: filtered.length,
      planQty,
      cuttingQty,
      pendingQty,
      cuttingPercent,
      pendingPercent,
    };
  }, [filtered]);

  /**
   * Month chart
   */
  const monthChartData = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const m = r["MONTH"] || "—";

      if (!map[m]) {
        map[m] = {
          month: m,
          planQty: 0,
          cuttingQty: 0,
          pendingQty: 0,
        };
      }

      map[m].planQty += toNumber(r["PLAN QTY"]);
      map[m].cuttingQty += toNumber(r["CUTTING QTY"]);
    });

    return Object.values(map).map((item) => ({
      ...item,
      pendingQty: item.planQty - item.cuttingQty,
    }));
  }, [filtered]);

  /**
   * Order type pie
   */
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

  /**
   * Location chart
   */
  const locationBarData = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const locationName = r["LOCATION"] || "—";

      if (!map[locationName]) {
        map[locationName] = {
          location: locationName,
          cuttingQty: 0,
        };
      }

      map[locationName].cuttingQty += toNumber(
        r["CUTTING QTY"]
      );
    });

    return Object.values(map);
  }, [filtered]);

  /**
   * Generic summary
   */
  function summarizeBy(key) {
    const map = {};

    filtered.forEach((r) => {
      const value = r[key] || "—";

      if (!map[value]) {
        map[value] = {
          key: value,
          rows: 0,
          planQty: 0,
          cuttingQty: 0,
        };
      }

      map[value].rows += 1;
      map[value].planQty += toNumber(r["PLAN QTY"]);
      map[value].cuttingQty += toNumber(r["CUTTING QTY"]);
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        pendingQty: item.planQty - item.cuttingQty,
        cuttingPercent:
          item.planQty > 0
            ? (item.cuttingQty / item.planQty) * 100
            : 0,
      }))
      .sort((a, b) => {
        if (a.key > b.key) return 1;
        if (a.key < b.key) return -1;
        return 0;
      });
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

  /**
   * Month slicer
   */
  const monthSummaryFiltered = useMemo(() => {
    if (selectedMonths.length === 0) {
      return monthSummary;
    }

    return monthSummary.filter((item) =>
      selectedMonths.includes(item.key)
    );
  }, [monthSummary, selectedMonths]);

  /**
   * Slicer totals
   */
  const slicerTotals = useMemo(() => {
    return monthSummaryFiltered.reduce(
      (acc, item) => ({
        planQty: acc.planQty + item.planQty,
        cuttingQty: acc.cuttingQty + item.cuttingQty,
        pendingQty: acc.pendingQty + item.pendingQty,
      }),
      {
        planQty: 0,
        cuttingQty: 0,
        pendingQty: 0,
      }
    );
  }, [monthSummaryFiltered]);

  /**
   * Toggle month slicer
   */
  function toggleMonthSlicer(monthName) {
    setSelectedMonths((prev) =>
      prev.includes(monthName)
        ? prev.filter((item) => item !== monthName)
        : [...prev, monthName]
    );
  }

  /**
   * Daily cutting report
   */
  const dailyCuttingReport = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const date = r["CUTTING DATE"] || "—";

      map[date] =
        (map[date] || 0) + toNumber(r["CUTTING QTY"]);
    });

    const rowsArr = Object.entries(map)
      .map(([date, cuttingQty]) => ({
        date,
        cuttingQty,
      }))
      .sort((a, b) =>
        a.date > b.date ? 1 : -1
      );

    const total = rowsArr.reduce(
      (sum, item) => sum + item.cuttingQty,
      0
    );

    const avgPerDay =
      rowsArr.length > 0 ? total / rowsArr.length : 0;

    return {
      rows: rowsArr,
      total,
      avgPerDay,
      dayCount: rowsArr.length,
    };
  }, [filtered]);

  /**
   * Selected month daily breakdown
   */
  const dailyBreakdown = useMemo(() => {
    if (selectedMonths.length === 0) {
      return {
        rows: [],
        monthTotal: 0,
        avgPerDay: 0,
        dayCount: 0,
      };
    }

    const scoped = filtered.filter((r) =>
      selectedMonths.includes(r["MONTH"])
    );

    const map = {};

    scoped.forEach((r) => {
      const date = r["CUTTING DATE"] || "—";

      map[date] =
        (map[date] || 0) + toNumber(r["CUTTING QTY"]);
    });

    const rowsArr = Object.entries(map)
      .map(([date, cuttingQty]) => ({
        date,
        cuttingQty,
      }))
      .sort((a, b) =>
        a.date > b.date ? 1 : -1
      );

    const monthTotal = rowsArr.reduce(
      (sum, item) => sum + item.cuttingQty,
      0
    );

    const avgPerDay =
      rowsArr.length > 0
        ? monthTotal / rowsArr.length
        : 0;

    return {
      rows: rowsArr,
      monthTotal,
      avgPerDay,
      dayCount: rowsArr.length,
    };
  }, [filtered, selectedMonths]);

  /**
   * Columns
   */
  const columns = useMemo(() => {
    return rows.length ? Object.keys(rows[0]) : [];
  }, [rows]);

  /**
   * Clear all filters
   */
  function clearFilters() {
    setMonth("all");
    setOrderType("all");
    setLocation("all");
    setSearch("");
    setSelectedMonths([]);
  }

  return (
    <div className="wrap">

      {/* ================= TOP BAR ================= */}

      <div className="topbar">
        <div>
          <h1>Cutting Room Dashboard</h1>

          <p className="sub">
            Live production tracker — Google Sheet synced
            automatically
          </p>
        </div>

        <div className="top-actions">

          <button
            className="refresh-btn"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>

          {fetchedAt && (
            <span className="refresh-tag">
              Updated{" "}
              {new Date(fetchedAt).toLocaleString(
                "en-IN"
              )}
            </span>
          )}

        </div>
      </div>

      {/* ================= STATUS ================= */}

      {status === "loading" && (
        <div className="state">
          Loading sheet data…
        </div>
      )}

      {status === "error" && (
        <div className="state error">
          <strong>
            Couldn't load the sheet.
          </strong>

          <br />

          Check that SHEET_ID is correctly set in
          environment variables and the sheet is shared
          as "Anyone with the link — Viewer".

          <br />

          <button
            className="retry-btn"
            onClick={() => loadData(true)}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ================= DASHBOARD ================= */}

      {status === "ready" && (
        <>

          {/* ================= KPI CARDS ================= */}

          <div className="cards">

            <div className="card">
              <p className="label">
                Rows in View
              </p>

              <p className="value">
                {formatNumber(totals.poCount)}
              </p>
            </div>

            <div className="card">
              <p className="label">
                Total Plan Qty
              </p>

              <p className="value">
                {formatNumber(totals.planQty)}
              </p>
            </div>

            <div className="card accent">
              <p className="label">
                Total Cutting Qty
              </p>

              <p className="value">
                {formatNumber(totals.cuttingQty)}
              </p>
            </div>

            <div className="card pending">
              <p className="label">
                Pending Qty
              </p>

              <p className="value">
                {formatNumber(totals.pendingQty)}
              </p>
            </div>

            <div className="card accent">
              <p className="label">
                Cutting %
              </p>

              <p className="value">
                {totals.cuttingPercent.toFixed(1)}%
              </p>
            </div>

          </div>

          {/* ================= CHARTS ================= */}

          <div className="panels">

            <div className="panel">

              <h2>
                Plan Qty vs Cutting Qty by Month
              </h2>

              <ResponsiveContainer
                width="100%"
                height={280}
              >
                <BarChart data={monthChartData}>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                  />

                  <YAxis
                    tick={{ fontSize: 12 }}
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
                height={280}
              >
                <PieChart>

                  <Pie
                    data={orderTypePieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={95}
                    label={({ name, value }) =>
                      `${name}: ${value}`
                    }
                  >
                    {orderTypePieData.map(
                      (entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            PIE_COLORS[
                              index %
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

          {/* ================= LOCATION ================= */}

          {locations.length > 1 && (
            <div
              className="panel"
              style={{ marginBottom: 16 }}
            >

              <h2>
                Cutting Qty by Location
              </h2>

              <ResponsiveContainer
                width="100%"
                height={240}
              >
                <BarChart data={locationBarData}>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="location"
                    tick={{ fontSize: 12 }}
                  />

                  <YAxis
                    tick={{ fontSize: 12 }}
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

          {/* ================= MAIN PANEL ================= */}

          <div className="panel">

            {/* VIEW TABS */}

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
                📋 Order Log
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
                📅 Month-wise
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
                📆 Date-wise
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
                ⚙️ Operation
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
                👕 Style-wise
              </button>

              <button
                className={
                  viewChecking
                    ? "active checking-tab"
                    : "checking-tab"
                }
                onClick={() =>
                  setViewChecking(!viewChecking)
                }
              >
                👁 View Checking
              </button>

            </div>

            {/* ================= FILTER AREA ================= */}

            <div className="filters">

              {/* SEARCH KEY */}

              <div className="search-box">

                <span>🔍</span>

                <input
                  type="text"
                  placeholder="Search Style / PO / Order ID / Operation"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                />

                {search && (
                  <button
                    className="clear-search"
                    onClick={() =>
                      setSearch("")
                    }
                  >
                    ×
                  </button>
                )}

              </div>

              {/* MONTH */}

              {viewMode !== "month" && (
                <select
                  value={month}
                  onChange={(e) =>
                    setMonth(e.target.value)
                  }
                >
                  <option value="all">
                    All Months
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

              {/* ORDER TYPE */}

              <select
                value={orderType}
                onChange={(e) =>
                  setOrderType(e.target.value)
                }
              >
                <option value="all">
                  All Order Types
                </option>

                {orderTypes.map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                ))}
              </select>

              {/* LOCATION */}

              <select
                value={location}
                onChange={(e) =>
                  setLocation(e.target.value)
                }
              >
                <option value="all">
                  All Locations
                </option>

                {locations.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>

              {/* CLEAR */}

              <button
                className="clear-filter"
                onClick={clearFilters}
              >
                Clear Filters
              </button>

            </div>

            {/* ================= VIEW CHECKING ================= */}

            {viewChecking && (
              <div className="checking-box">

                <div className="checking-header">

                  <div>
                    <h2>
                      👁 View Checking
                    </h2>

                    <p>
                      Click any row below to inspect
                      complete order details.
                    </p>
                  </div>

                  <span className="checking-count">
                    {filtered.length} rows
                  </span>

                </div>

                <div className="table-wrap">

                  <table>

                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Style Name</th>
                        <th>PO No</th>
                        <th>Order ID</th>
                        <th>Order Type</th>
                        <th>Plan Qty</th>
                        <th>Cutting Qty</th>
                        <th>Pending</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>

                      {filtered
                        .slice(0, 200)
                        .map((row, index) => {

                          const plan =
                            toNumber(
                              row["PLAN QTY"]
                            );

                          const cutting =
                            toNumber(
                              row["CUTTING QTY"]
                            );

                          const pending =
                            plan - cutting;

                          return (
                            <tr key={index}>

                              <td>
                                {index + 1}
                              </td>

                              <td>
                                <strong>
                                  {
                                    row[
                                      "STYLE NAME"
                                    ]
                                  }
                                </strong>
                              </td>

                              <td>
                                {row["PO NO"]}
                              </td>

                              <td>
                                {row["ORDER ID"]}
                              </td>

                              <td>
                                <span className="badge">
                                  {
                                    row[
                                      "ORDER TYPE"
                                    ]
                                  }
                                </span>
                              </td>

                              <td>
                                {formatNumber(plan)}
                              </td>

                              <td>
                                {formatNumber(cutting)}
                              </td>

                              <td
                                style={{
                                  color:
                                    pending > 0
                                      ? "#dc2626"
                                      : "#16a34a",
                                  fontWeight: 700,
                                }}
                              >
                                {formatNumber(
                                  pending
                                )}
                              </td>

                              <td>

                                <button
                                  className="view-btn"
                                  onClick={() =>
                                    setSelectedRow(
                                      row
                                    )
                                  }
                                >
                                  View
                                </button>

                              </td>

                            </tr>
                          );
                        })}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

            {/* ================= ORDER LOG ================= */}

            {!viewChecking &&
              viewMode === "log" && (
                <>

                  <div className="table-wrap">

                    <table>

                      <thead>

                        <tr>

                          {columns.map(
                            (column) => (
                              <th key={column}>
                                {column}
                              </th>
                            )
                          )}

                        </tr>

                      </thead>

                      <tbody>

                        {filtered
                          .slice(0, 200)
                          .map(
                            (row, index) => (
                              <tr key={index}>

                                {columns.map(
                                  (column) => (
                                    <td
                                      key={
                                        column
                                      }
                                    >
                                      {column ===
                                        "ORDER TYPE" &&
                                      row[
                                        column
                                      ] ? (
                                        <span className="badge">
                                          {
                                            row[
                                              column
                                            ]
                                          }
                                        </span>
                                      ) : (
                                        row[
                                          column
                                        ]
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
                    {filtered.length} rows
                  </p>

                </>
              )}

            {/* ================= MONTH ================= */}

            {!viewChecking &&
              viewMode === "month" && (
                <>

                  <div className="slicer">

                    {monthSummary.map(
                      (item) => {

                        const active =
                          selectedMonths.length ===
                            0 ||
                          selectedMonths.includes(
                            item.key
                          );

                        return (
                          <button
                            key={item.key}
                            className={`slicer-pill ${
                              active ? "on" : ""
                            }`}
                            onClick={() =>
                              toggleMonthSlicer(
                                item.key
                              )
                            }
                          >
                            {item.key}
                          </button>
                        );
                      }
                    )}

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

                  {selectedMonths.length >
                    0 && (
                    <div className="slicer-summary">

                      Selected Months:{" "}
                      <strong>
                        {selectedMonths.join(
                          ", "
                        )}
                      </strong>

                      <br />

                      Plan:{" "}
                      {formatNumber(
                        slicerTotals.planQty
                      )}

                      {" · "}

                      Cutting:{" "}
                      {formatNumber(
                        slicerTotals.cuttingQty
                      )}

                      {" · "}

                      <strong>
                        Pending:{" "}
                        {formatNumber(
                          slicerTotals.pendingQty
                        )}
                      </strong>

                    </div>
                  )}

                  <div className="table-wrap">

                    <table>

                      <thead>

                        <tr>
                          <th>Month</th>
                          <th>Orders</th>
                          <th>Plan Qty</th>
                          <th>Cutting Qty</th>
                          <th>Pending Qty</th>
                          <th>Cutting %</th>
                        </tr>

                      </thead>

                      <tbody>

                        {monthSummaryFiltered.map(
                          (item) => (
                            <tr key={item.key}>

                              <td>
                                <strong>
                                  {item.key}
                                </strong>
                              </td>

                              <td>
                                {formatNumber(
                                  item.rows
                                )}
                              </td>

                              <td>
                                {formatNumber(
                                  item.planQty
                                )}
                              </td>

                              <td>
                                {formatNumber(
                                  item.cuttingQty
                                )}
                              </td>

                              <td
                                style={{
                                  color:
                                    item.pendingQty >
                                    0
                                      ? "#dc2626"
                                      : "#16a34a",
                                  fontWeight: 700,
                                }}
                              >
                                {formatNumber(
                                  item.pendingQty
                                )}
                              </td>

                              <td>
                                {item.cuttingPercent.toFixed(
                                  1
                                )}
                                %
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                  {selectedMonths.length >
                    0 && (
                    <div
                      style={{
                        marginTop: 24,
                      }}
                    >

                      <h2>
                        Per-day Cutting Qty —{" "}
                        {selectedMonths.join(
                          ", "
                        )}
                      </h2>

                      <div className="cards">

                        <div className="card">
                          <p className="label">
                            Month Total Cutting
                          </p>

                          <p className="value">
                            {formatNumber(
                              dailyBreakdown.monthTotal
                            )}
                          </p>
                        </div>

                        <div className="card accent">
                          <p className="label">
                            Days with Cutting
                          </p>

                          <p className="value">
                            {
                              dailyBreakdown.dayCount
                            }
                          </p>
                        </div>

                        <div className="card accent">
                          <p className="label">
                            Avg Cutting / Day
                          </p>

                          <p className="value">
                            {formatNumber(
                              Math.round(
                                dailyBreakdown.avgPerDay
                              )
                            )}
                          </p>
                        </div>

                      </div>

                      <div className="table-wrap">

                        <table>

                          <thead>
                            <tr>
                              <th>
                                Cutting Date
                              </th>
                              <th>
                                Cutting Qty
                              </th>
                            </tr>
                          </thead>

                          <tbody>

                            {dailyBreakdown.rows.map(
                              (item) => (
                                <tr
                                  key={
                                    item.date
                                  }
                                >
                                  <td>
                                    {item.date}
                                  </td>

                                  <td>
                                    {formatNumber(
                                      item.cuttingQty
                                    )}
                                  </td>
                                </tr>
                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    </div>
                  )}

                </>
              )}

            {/* ================= DATE ================= */}

            {!viewChecking &&
              viewMode === "date" && (
                <SummaryTable
                  title="Cutting Date"
                  summary={dateSummary}
                />
              )}

            {/* ================= OPERATION ================= */}

            {!viewChecking &&
              viewMode === "operation" && (
                <SummaryTable
                  title="Operation"
                  summary={operationSummary}
                />
              )}

            {/* ================= STYLE ================= */}

            {!viewChecking &&
              viewMode === "style" && (
                <SummaryTable
                  title="Style Name"
                  summary={styleSummary}
                />
              )}

          </div>

        </>
      )}

      {/* ================= DETAIL MODAL ================= */}

      {selectedRow && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedRow(null)
          }
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>
                <h2>
                  Order Details
                </h2>

                <p>
                  Complete information
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setSelectedRow(null)
                }
              >
                ×
              </button>

            </div>

            <div className="detail-grid">

              {Object.entries(
                selectedRow
              ).map(([key, value]) => (
                <div
                  className="detail-item"
                  key={key}
                >

                  <div className="detail-label">
                    {key}
                  </div>

                  <div className="detail-value">
                    {value || "—"}
                  </div>

                </div>
              ))}

            </div>

          </div>

        </div>
      )}

      {/* ================= FOOTER ================= */}

      {lastRefresh && (
        <div className="live-status">

          <span className="live-dot"></span>

          Live Sync Active

          <span>
            • Auto refresh every 1 minute
          </span>

          <span>
            • Last check:{" "}
            {lastRefresh.toLocaleTimeString(
              "en-IN"
            )}
          </span>

        </div>
      )}

    </div>
  );
}

/**
 * Reusable summary table
 */
function SummaryTable({ title, summary }) {
  return (
    <div className="table-wrap">

      <table>

        <thead>

          <tr>

            <th>{title}</th>
            <th>Orders</th>
            <th>Plan Qty</th>
            <th>Cutting Qty</th>
            <th>Pending Qty</th>
            <th>Cutting %</th>

          </tr>

        </thead>

        <tbody>

          {summary.map((item) => (
            <tr key={item.key}>

              <td>
                <strong>
                  {item.key}
                </strong>
              </td>

              <td>
                {formatNumber(
                  item.rows
                )}
              </td>

              <td>
                {formatNumber(
                  item.planQty
                )}
              </td>

              <td>
                {formatNumber(
                  item.cuttingQty
                )}
              </td>

              <td
                style={{
                  color:
                    item.pendingQty > 0
                      ? "#dc2626"
                      : "#16a34a",
                  fontWeight: 700,
                }}
              >
                {formatNumber(
                  item.pendingQty
                )}
              </td>

              <td>
                {item.cuttingPercent.toFixed(
                  1
                )}
                %
              </td>

            </tr>
          ))}

        </tbody>

      </table>

    </div>
  );
}
