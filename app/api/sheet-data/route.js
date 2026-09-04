import Papa from "papaparse";

// Revalidate every 5 minutes — matches "3-4 updates a day" cadence
export const revalidate = 300;

export async function GET() {
  const sheetId = process.env.SHEET_ID;
  const gid = process.env.SHEET_GID || "0";

  if (!sheetId) {
    return Response.json(
      { error: "SHEET_ID environment variable is not set" },
      { status: 500 }
    );
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;

  try {
    const res = await fetch(csvUrl, { next: { revalidate: 300 } });

    if (!res.ok) {
      return Response.json(
        {
          error:
            "Could not fetch the sheet. Make sure it's shared as 'Anyone with the link — Viewer'.",
        },
        { status: 502 }
      );
    }

    const csvText = await res.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    // Drop fully-empty rows
    const rows = parsed.data.filter((row) =>
      Object.values(row).some((v) => String(v).trim() !== "")
    );

    return Response.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch or parse sheet data", detail: String(err) },
      { status: 500 }
    );
  }
}
