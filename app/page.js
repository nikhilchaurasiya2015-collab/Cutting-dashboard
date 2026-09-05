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

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];

function toNumber(value) {
  if (value === undefined || value === null || value === "") return 0;

  const number = parseFloat(
    String(value).replace(/[,%\s]/g, "")
  );

  return Number.isNaN(number) ? 0 : number;
}

function getValue(row, fields) {
  for (const field of fields) {
    if (
      row[field] !== undefined &&
      row[field] !== null &&
      String(row[field]).trim() !== ""
    ) {
      return row[field];
    }
  }

  return "";
}

function getStatus(planQty, cutQty) {
  if (!planQty) return "OK";

  const differencePercent =
    ((cutQty - planQty) / planQty) * 100;

  if (differencePercent > 10) {
    return "EXCESS";
  }

  if (differencePercent < 0) {
    return "SHORT";
  }

  return "OK";
}

function getStatusStyle(status) {
  if (status === "EXCESS") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
    };
  }

  if (status === "SHORT") {
    return {
      background: "#fff7ed",
      color: "#c2410c",
    };
  }

  return {
    background: "#dcfce7",
    color: "#15803d",
  };
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

  const [styleQuery, setStyleQuery] = useState("");
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);

  const [collectionQuery, setCollectionQuery] = useState("");
  const [showCollectionDropdown, setShowCollectionDropdown] =
    useState(false);

  const [selectedMonths, setSelectedMonths] = useState([]);

  // ---------------------------------------------------------
  // LOAD DATA
  // ---------------------------------------------------------

  async function loadData() {
    try {
      const response = await fetch("/api/sheet-data", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sheet data");
      }

      const data = await response.json();

      if (data.error) {
        console.error(data.error);
        setStatus("error");
        return;
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);

      setFetchedAt(
        data.fetchedAt || new Date().toISOString()
      );

      setStatus("ready");
    } catch (error) {
      console.error("Dashboard error:", error);
      setStatus("error");
    }
  }

  // First load
  useEffect(() => {
    loadData();
  }, []);

  // Auto refresh every 1 minute
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------
  // BASIC FILTER VALUES
  // ---------------------------------------------------------

  const months = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) =>
            String(row["MONTH"] || "").trim()
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

  const orderTypes = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) =>
            String(row["ORDER TYPE"] || "").trim()
          )
          .filter(Boolean)
      )
    ).sort();
  }, [rows]);

  const locations = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) =>
            String(row["LOCATION"] || "").trim()
          )
          .filter(Boolean)
      )
    ).sort();
  }, [rows]);

  // ---------------------------------------------------------
  // MAIN FILTER
  // ---------------------------------------------------------

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        month !== "all" &&
        String(row["MONTH"] || "").trim() !== month
      ) {
        return false;
      }

      if (
        orderType !== "all" &&
        String(row["ORDER TYPE"] || "").trim() !== orderType
      ) {
        return false;
      }

      if (
        location !== "all" &&
        String(row["LOCATION"] || "").trim() !== location
      ) {
        return false;
      }

      if (search.trim()) {
        const searchText = search.toLowerCase();

        const combinedText = [
          row["STYLE NAME"],
          row["PO NO"],
          row["ORDER ID"],
          row["ORDER TYPE"],
          row["LOCATION"],
          row["OPERATION"],
          getValue(row, [
            "JOB CARD NO",
            "JOB CARD",
            "JOB CARD NUMBER",
          ]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!combinedText.includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }, [
    rows,
    month,
    orderType,
    location,
    search,
  ]);

  // ---------------------------------------------------------
  // MAIN TOTALS
  // ---------------------------------------------------------

  const totals = useMemo(() => {
    const planQty = filteredRows.reduce(
      (sum, row) =>
        sum + toNumber(row["PLAN QTY"]),
      0
    );

    const cutQty = filteredRows.reduce(
      (sum, row) =>
        sum + toNumber(row["CUTTING QTY"]),
      0
    );

    return {
      count: filteredRows.length,
      planQty,
      cutQty,
      pendingQty: planQty - cutQty,
    };
  }, [filteredRows]);

  // ---------------------------------------------------------
  // STYLE SEARCH
  // ---------------------------------------------------------

  const styleNames = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) =>
            String(row["STYLE NAME"] || "").trim()
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

  const filteredStyleNames = useMemo(() => {
    const query = styleQuery
      .trim()
      .toLowerCase();

    if (!query) {
      return styleNames.slice(0, 30);
    }

    return styleNames
      .filter((style) =>
        style.toLowerCase().includes(query)
      )
      .slice(0, 30);
  }, [styleNames, styleQuery]);

  // ---------------------------------------------------------
  // SELECTED STYLE MONTH-WISE
  // ---------------------------------------------------------

  const selectedStyleMonthSummary = useMemo(() => {
    if (!styleQuery.trim()) {
      return [];
    }

    const selectedStyle = styleQuery.trim();

    const styleRows = rows.filter(
      (row) =>
        String(row["STYLE NAME"] || "").trim() ===
        selectedStyle
    );

    const monthMap = {};

    styleRows.forEach((row) => {
      const monthName =
        String(row["MONTH"] || "Unknown").trim();

      if (!monthMap[monthName]) {
        monthMap[monthName] = {
          month: monthName,
          count: 0,
          planQty: 0,
          cutQty: 0,
        };
      }

      monthMap[monthName].count += 1;

      monthMap[monthName].planQty +=
        toNumber(row["PLAN QTY"]);

      monthMap[monthName].cutQty +=
        toNumber(row["CUTTING QTY"]);
    });

    return Object.values(monthMap)
      .map((item) => {
        const difference =
          item.cutQty - item.planQty;

        const differencePercent =
          item.planQty > 0
            ? (difference / item.planQty) * 100
            : 0;

        return {
          ...item,
          difference,
          differencePercent,
          status: getStatus(
            item.planQty,
            item.cutQty
          ),
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

  // ---------------------------------------------------------
  // STYLE TOTAL
  // ---------------------------------------------------------

  const styleTotal = useMemo(() => {
    if (!styleQuery.trim()) {
      return null;
    }

    const styleRows = rows.filter(
      (row) =>
        String(row["STYLE NAME"] || "").trim() ===
        styleQuery.trim()
    );

    const planQty = styleRows.reduce(
      (sum, row) =>
        sum + toNumber(row["PLAN QTY"]),
      0
    );

    const cutQty = styleRows.reduce(
      (sum, row) =>
        sum + toNumber(row["CUTTING QTY"]),
      0
    );

    const difference = cutQty - planQty;

    const differencePercent =
      planQty > 0
        ? (difference / planQty) * 100
        : 0;

    return {
      count: styleRows.length,
      planQty,
      cutQty,
      difference,
      differencePercent,
      status: getStatus(planQty, cutQty),
    };
  }, [rows, styleQuery]);

  // ---------------------------------------------------------
  // COLLECTION SEARCH
  // ---------------------------------------------------------

  const collectionNames = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) =>
            String(
              getValue(row, [
                "COLLECTION",
                "Collection",
                "collection",
              ]) || ""
            ).trim()
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

  const filteredCollectionNames = useMemo(() => {
    const query = collectionQuery
      .trim()
      .toLowerCase();

    if (!query) {
      return collectionNames.slice(0, 30);
    }

    return collectionNames
      .filter((collection) =>
        collection.toLowerCase().includes(query)
      )
      .slice(0, 30);
  }, [
    collectionNames,
    collectionQuery,
  ]);

  // ---------------------------------------------------------
  // COLLECTION SUMMARY
  // ---------------------------------------------------------

  const collectionSummary = useMemo(() => {
    if (!collectionQuery.trim()) {
      return null;
    }

    const selectedCollection =
      collectionQuery.trim();

    const collectionRows = rows.filter(
      (row) =>
        String(
          getValue(row, [
            "COLLECTION",
            "Collection",
            "collection",
          ]) || ""
        ).trim() === selectedCollection
    );

    const planQty = collectionRows.reduce(
      (sum, row) =>
        sum + toNumber(row["PLAN QTY"]),
      0
    );

    const cutQty = collectionRows.reduce(
      (sum, row) =>
        sum + toNumber(row["CUTTING QTY"]),
      0
    );

    const pendingQty = planQty - cutQty;

    const jobCards = Array.from(
      new Set(
        collectionRows
          .map((row) =>
            String(
              getValue(row, [
                "JOB CARD NO",
                "JOB CARD",
                "JOB CARD NUMBER",
              ]) || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

    // Job card wise summary
    const jobCardMap = {};

    collectionRows.forEach((row) => {
      const jobCard =
        String(
          getValue(row, [
            "JOB CARD NO",
            "JOB CARD",
            "JOB CARD NUMBER",
          ]) || ""
        ).trim() || "N/A";

      if (!jobCardMap[jobCard]) {
        jobCardMap[jobCard] = {
          jobCard,
          planQty: 0,
          cutQty: 0,
        };
      }

      jobCardMap[jobCard].planQty +=
        toNumber(row["PLAN QTY"]);

      jobCardMap[jobCard].cutQty +=
        toNumber(row["CUTTING QTY"]);
    });

    const jobCardSummary = Object.values(
      jobCardMap
    )
      .map((item) => ({
        ...item,
        pendingQty:
          item.planQty - item.cutQty,
      }))
      .sort((a, b) =>
        String(a.jobCard).localeCompare(
          String(b.jobCard),
          undefined,
          { numeric: true }
        )
      );

    return {
      totalPlanCount: collectionRows.length,
      jobCardCount: jobCards.length,
      jobCards,
      planQty,
      cutQty,
      pendingQty,
      jobCardSummary,
    };
  }, [rows, collectionQuery]);

  // ---------------------------------------------------------
  // GENERIC SUMMARY
  // ---------------------------------------------------------

  function makeSummary(field) {
    const map = {};

    filteredRows.forEach((row) => {
      const key =
        String(row[field] || "—").trim();

      if (!map[key]) {
        map[key] = {
          key,
          count: 0,
          planQty: 0,
          cutQty: 0,
        };
      }

      map[key].count += 1;

      map[key].planQty +=
        toNumber(row["PLAN QTY"]);

      map[key].cutQty +=
        toNumber(row["CUTTING QTY"]);
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        pendingQty:
          item.planQty - item.cutQty,
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
    () => makeSummary("MONTH"),
    [filteredRows]
  );

  const dateSummary = useMemo(
    () => makeSummary("CUTTING DATE"),
    [filteredRows]
  );

  const operationSummary = useMemo(
    () => makeSummary("OPERATION"),
    [filteredRows]
  );

  const styleSummary = useMemo(
    () => makeSummary("STYLE NAME"),
    [filteredRows]
  );

  // ---------------------------------------------------------
  // CHART DATA
  // ---------------------------------------------------------

  const monthChartData = useMemo(() => {
    return monthSummary.map((item) => ({
      month: item.key,
      planQty: item.planQty,
      cutQty: item.cutQty,
    }));
  }, [monthSummary]);

  const orderTypeChartData = useMemo(() => {
    const map = {};

    filteredRows.forEach((row) => {
      const type =
        String(
          row["ORDER TYPE"] || "Unknown"
        ).trim();

      map[type] = (map[type] || 0) + 1;
    });

    return Object.entries(map).map(
      ([name, value]) => ({
        name,
        value,
      })
    );
  }, [filteredRows]);

  const locationChartData = useMemo(() => {
    const map = {};

    filteredRows.forEach((row) => {
      const loc =
        String(
          row["LOCATION"] || "Unknown"
        ).trim();

      if (!map[loc]) {
        map[loc] = {
          location: loc,
          cutQty: 0,
        };
      }

      map[loc].cutQty +=
        toNumber(row["CUTTING QTY"]);
    });

    return Object.values(map);
  }, [filteredRows]);

  // ---------------------------------------------------------
  // TABLE COLUMNS
  // ---------------------------------------------------------

  const columns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 20,
        fontFamily:
          "Arial, Helvetica, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            Cutting Room Dashboard
          </h1>

          <p
            style={{
              margin: "5px 0 0",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Live production tracker
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {fetchedAt && (
            <span
              style={{
                fontSize: 12,
                color: "#64748b",
                background: "#fff",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              Updated:{" "}
              {new Date(
                fetchedAt
              ).toLocaleString("en-IN")}
            </span>
          )}

          <button
            onClick={loadData}
            style={{
              border: 0,
              background: "#1e3a8a",
              color: "#fff",
              padding: "9px 15px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div
          style={{
            background: "#fff",
            padding: 20,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}
        >
          Loading data...
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 15,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          Sheet data load nahi ho raha hai.
          Please `/api/sheet-data` API check karein.
        </div>
      )}

      {status === "ready" && (
        <>
          {/* TOP CARDS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(180px,1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard
              title="Total Plan Count"
              value={totals.count}
            />

            <StatCard
              title="Plan Qty"
              value={totals.planQty.toLocaleString(
                "en-IN"
              )}
            />

            <StatCard
              title="Cut Qty"
              value={totals.cutQty.toLocaleString(
                "en-IN"
              )}
              accent
            />

            <StatCard
              title="Pending Qty"
              value={totals.pendingQty.toLocaleString(
                "en-IN"
              )}
              pending
            />
          </div>

          {/* FILTERS */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 17,
              }}
            >
              Filters
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(180px,1fr))",
                gap: 10,
              }}
            >
              <select
                value={month}
                onChange={(e) =>
                  setMonth(e.target.value)
                }
                style={inputStyle}
              >
                <option value="all">
                  All Months
                </option>

                {months.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={orderType}
                onChange={(e) =>
                  setOrderType(e.target.value)
                }
                style={inputStyle}
              >
                <option value="all">
                  All Order Types
                </option>

                {orderTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={location}
                onChange={(e) =>
                  setLocation(e.target.value)
                }
                style={inputStyle}
              >
                <option value="all">
                  All Locations
                </option>

                {locations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search Style / PO / Job Card"
                style={inputStyle}
              />
            </div>
          </div>

          {/* STYLE SEARCH */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              position: "relative",
              zIndex: 30,
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 17,
              }}
            >
              🔍 Style Search
            </h2>

            <div
              style={{
                position: "relative",
                maxWidth: 550,
              }}
            >
              <input
                value={styleQuery}
                onChange={(e) => {
                  setStyleQuery(
                    e.target.value
                  );
                  setShowStyleDropdown(true);
                }}
                onFocus={() =>
                  setShowStyleDropdown(true)
                }
                placeholder="Search Style Name..."
                style={{
                  ...inputStyle,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />

              {showStyleDropdown && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "calc(100% + 4px)",
                    background: "#fff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    maxHeight: 300,
                    overflowY: "auto",
                    boxShadow:
                      "0 12px 30px rgba(0,0,0,.15)",
                    zIndex: 9999,
                  }}
                >
                  {filteredStyleNames.length ===
                  0 ? (
                    <div
                      style={{
                        padding: 12,
                        color: "#64748b",
                      }}
                    >
                      No style found
                    </div>
                  ) : (
                    filteredStyleNames.map(
                      (style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => {
                            setStyleQuery(style);
                            setShowStyleDropdown(
                              false
                            );
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding:
                              "11px 14px",
                            border: 0,
                            borderBottom:
                              "1px solid #f1f5f9",
                            background: "#fff",
                            cursor: "pointer",
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
          </div>

          {/* STYLE TOTAL */}
          {styleTotal && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(170px,1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <StatCard
                title="Style Count"
                value={styleTotal.count}
              />

              <StatCard
                title="Plan Qty"
                value={styleTotal.planQty.toLocaleString(
                  "en-IN"
                )}
              />

              <StatCard
                title="Cut Qty"
                value={styleTotal.cutQty.toLocaleString(
                  "en-IN"
                )}
                accent
              />

              <StatCard
                title="Difference Qty"
                value={
                  styleTotal.difference > 0
                    ? `+${styleTotal.difference.toLocaleString(
                        "en-IN"
                      )}`
                    : styleTotal.difference.toLocaleString(
                        "en-IN"
                      )
                }
              />

              <StatCard
                title="Difference %"
                value={`${styleTotal.differencePercent >= 0 ? "+" : ""}${styleTotal.differencePercent.toFixed(
                  1
                )}%`}
              />

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Status
                </div>

                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    borderRadius: 7,
                    fontWeight: 800,
                    fontSize: 13,
                    ...getStatusStyle(
                      styleTotal.status
                    ),
                  }}
                >
                  {styleTotal.status}
                </span>
              </div>
            </div>
          )}

          {/* STYLE MONTH WISE */}
          {styleQuery && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin: "0 0 14px",
                  fontSize: 17,
                }}
              >
                📊 Style Month-wise Analysis
              </h2>

              <Table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Count</th>
                    <th>Plan Qty</th>
                    <th>Cut Qty</th>
                    <th>Difference Qty</th>
                    <th>Difference %</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedStyleMonthSummary.map(
                    (item) => (
                      <tr key={item.month}>
                        <td>
                          <strong>
                            {item.month}
                          </strong>
                        </td>

                        <td>{item.count}</td>

                        <td>
                          {item.planQty.toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td>
                          {item.cutQty.toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td>
                          {item.difference > 0
                            ? "+"
                            : ""}
                          {item.difference.toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td>
                          {item.differencePercent >=
                          0
                            ? "+"
                            : ""}
                          {item.differencePercent.toFixed(
                            1
                          )}
                          %
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              item.status
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </Table>
            </div>
          )}

          {/* COLLECTION SEARCH */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              position: "relative",
              zIndex: 20,
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 17,
              }}
            >
              📦 Collection Search
            </h2>

            <div
              style={{
                position: "relative",
                maxWidth: 550,
              }}
            >
              <input
                value={collectionQuery}
                onChange={(e) => {
                  setCollectionQuery(
                    e.target.value
                  );
                  setShowCollectionDropdown(
                    true
                  );
                }}
                onFocus={() =>
                  setShowCollectionDropdown(
                    true
                  )
                }
                placeholder="Search Collection..."
                style={{
                  ...inputStyle,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />

              {showCollectionDropdown && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "calc(100% + 4px)",
                    background: "#fff",
                    border:
                      "1px solid #cbd5e1",
                    borderRadius: 10,
                    maxHeight: 300,
                    overflowY: "auto",
                    boxShadow:
                      "0 12px 30px rgba(0,0,0,.15)",
                    zIndex: 9999,
                  }}
                >
                  {filteredCollectionNames.length ===
                  0 ? (
                    <div
                      style={{
                        padding: 12,
                        color: "#64748b",
                      }}
                    >
                      No collection found
                    </div>
                  ) : (
                    filteredCollectionNames.map(
                      (collection) => (
                        <button
                          key={collection}
                          type="button"
                          onClick={() => {
                            setCollectionQuery(
                              collection
                            );
                            setShowCollectionDropdown(
                              false
                            );
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding:
                              "11px 14px",
                            border: 0,
                            borderBottom:
                              "1px solid #f1f5f9",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          📦 {collection}
                        </button>
                      )
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* COLLECTION SUMMARY */}
          {collectionSummary && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(170px,1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <StatCard
                  title="Total Plan Count"
                  value={
                    collectionSummary.totalPlanCount
                  }
                />

                <StatCard
                  title="Job Card Count"
                  value={
                    collectionSummary.jobCardCount
                  }
                />

                <StatCard
                  title="Plan Qty"
                  value={collectionSummary.planQty.toLocaleString(
                    "en-IN"
                  )}
                />

                <StatCard
                  title="Cut Qty"
                  value={collectionSummary.cutQty.toLocaleString(
                    "en-IN"
                  )}
                  accent
                />

                <StatCard
                  title="Pending Qty"
                  value={collectionSummary.pendingQty.toLocaleString(
                    "en-IN"
                  )}
                  pending
                />
              </div>

              {/* JOB CARD TABLE */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 14px",
                    fontSize: 17,
                  }}
                >
                  📋 Job Card-wise Collection Summary
                </h2>

                {collectionSummary.jobCardSummary
                  .length === 0 ? (
                  <p
                    style={{
                      color: "#64748b",
                    }}
                  >
                    Job Card No. data nahi mila.
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Job Card No.</th>
                        <th>Plan Qty</th>
                        <th>Cut Qty</th>
                        <th>Pending Qty</th>
                      </tr>
                    </thead>

                    <tbody>
                      {collectionSummary.jobCardSummary.map(
                        (item) => (
                          <tr
                            key={item.jobCard}
                          >
                            <td>
                              <strong>
                                {item.jobCard}
                              </strong>
                            </td>

                            <td>
                              {item.planQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td>
                              {item.cutQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td>
                              {item.pendingQty.toLocaleString(
                                "en-IN"
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </Table>
                )}
              </div>
            </>
          )}

          {/* CHARTS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(320px,1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={panelStyle}
            >
              <h2 style={headingStyle}>
                Plan Qty vs Cut Qty
              </h2>

              <ResponsiveContainer
                width="100%"
                height={280}
              >
                <BarChart
                  data={monthChartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="month" />

                  <YAxis />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="planQty"
                    name="Plan Qty"
                    fill="#2563eb"
                  />

                  <Bar
                    dataKey="cutQty"
                    name="Cut Qty"
                    fill="#16a34a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div
              style={panelStyle}
            >
              <h2 style={headingStyle}>
                Orders by Type
              </h2>

              <ResponsiveContainer
                width="100%"
                height={280}
              >
                <PieChart>
                  <Pie
                    data={
                      orderTypeChartData
                    }
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {orderTypeChartData.map(
                      (entry, index) => (
                        <Cell
                          key={
                            entry.name
                          }
                          fill={
                            COLORS[
                              index %
                                COLORS.length
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

          {/* LOCATION CHART */}
          {locationChartData.length > 0 && (
            <div
              style={{
                ...panelStyle,
                marginBottom: 16,
              }}
            >
              <h2 style={headingStyle}>
                Cutting Qty by Location
              </h2>

              <ResponsiveContainer
                width="100%"
                height={250}
              >
                <BarChart
                  data={locationChartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="location" />

                  <YAxis />

                  <Tooltip />

                  <Bar
                    dataKey="cutQty"
                    name="Cut Qty"
                    fill="#7c3aed"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* VIEW TABS */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {[
                ["log", "Order Log"],
                ["month", "Month-wise"],
                ["date", "Date-wise"],
                [
                  "operation",
                  "Operation",
                ],
                ["style", "Style-wise"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() =>
                    setViewMode(key)
                  }
                  style={{
                    border: 0,
                    borderRadius: 8,
                    padding:
                      "9px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                    background:
                      viewMode === key
                        ? "#1e3a8a"
                        : "#e2e8f0",
                    color:
                      viewMode === key
                        ? "#fff"
                        : "#334155",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ORDER LOG */}
            {viewMode === "log" && (
              <>
                <Table>
                  <thead>
                    <tr>
                      {columns.map(
                        (column) => (
                          <th
                            key={
                              column
                            }
                          >
                            {column}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows
                      .slice(0, 200)
                      .map(
                        (row, index) => (
                          <tr
                            key={
                              index
                            }
                          >
                            {columns.map(
                              (
                                column
                              ) => (
                                <td
                                  key={
                                    column
                                  }
                                >
                                  {
                                    row[
                                      column
                                    ]
                                  }
                                </td>
                              )
                            )}
                          </tr>
                        )
                      )}
                  </tbody>
                </Table>

                <p
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 10,
                  }}
                >
                  Showing{" "}
                  {Math.min(
                    filteredRows.length,
                    200
                  )}{" "}
                  of{" "}
                  {
                    filteredRows.length
                  }{" "}
                  rows
                </p>
              </>
            )}

            {/* MONTH */}
            {viewMode === "month" && (
              <SummaryTable
                title="Month"
                data={monthSummary}
              />
            )}

            {/* DATE */}
            {viewMode === "date" && (
              <SummaryTable
                title="Cutting Date"
                data={dateSummary}
              />
            )}

            {/* OPERATION */}
            {viewMode ===
              "operation" && (
              <SummaryTable
                title="Operation"
                data={
                  operationSummary
                }
              />
            )}

            {/* STYLE */}
            {viewMode === "style" && (
              <SummaryTable
                title="Style Name"
                data={styleSummary}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------

function StatCard({
  title,
  value,
  accent,
  pending,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          marginBottom: 7,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 25,
          fontWeight: 800,
          color: pending
            ? "#c2410c"
            : accent
            ? "#15803d"
            : "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: 7,
        fontWeight: 800,
        fontSize: 12,
        ...getStatusStyle(status),
      }}
    >
      {status}
    </span>
  );
}

function Table({ children }) {
  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: 650,
          fontSize: 13,
        }}
      >
        {children}
      </table>
    </div>
  );
}

function SummaryTable({ title, data }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>{title}</th>
          <th>Count</th>
          <th>Plan Qty</th>
          <th>Cut Qty</th>
          <th>Pending Qty</th>
        </tr>
      </thead>

      <tbody>
        {data.map((item) => (
          <tr key={item.key}>
            <td>
              <strong>
                {item.key}
              </strong>
            </td>

            <td>{item.count}</td>

            <td>
              {item.planQty.toLocaleString(
                "en-IN"
              )}
            </td>

            <td>
              {item.cutQty.toLocaleString(
                "en-IN"
              )}
            </td>

            <td>
              {item.pendingQty.toLocaleString(
                "en-IN"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------

const inputStyle = {
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 13,
  outline: "none",
};

const panelStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
};

const headingStyle = {
  margin: "0 0 12px",
  fontSize: 17,
};
