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

const PIE_COLORS = ["#253a5e", "#b5502f", "#d9a441", "#6b6a63", "#8aa1c1"];

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

  useEffect(() => {
    fetch("/api/sheet-data")
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="planQty" name="Plan qty" fill="#253a5e" />
                  <Bar dataKey="cuttingQty" name="Cutting qty" fill="#d9a441" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd0" />
                  <XAxis dataKey="location" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="cuttingQty" name="Cutting qty" fill="#253a5e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="panel">
            <h2>Order log</h2>
            <div className="filters">
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="all">All months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
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
              <input
                placeholder="Search style, PO no, order id"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

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
              Showing {Math.min(filtered.length, 200)} of {filtered.length} rows
            </p>
          </div>
        </>
      )}
    </div>
  );
}
