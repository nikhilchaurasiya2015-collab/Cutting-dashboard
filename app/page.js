<div
  className="style-search-wrapper"
  style={{
    position: "relative",
    width: 360,
  }}
>
  <input
    className="quick-search"
    type="text"
    value={styleQuery}
    placeholder="🔍 Search Style Name..."
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
        top: 10,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: 18,
      }}
    >
      ×
    </button>
  )}

  {showStyleDropdown && (
    <div
      className="style-dropdown"
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#fff",
        border: "1px solid #dbe3ef",
        borderRadius: 10,
        marginTop: 5,
        maxHeight: 320,
        overflowY: "auto",
        boxShadow:
          "0 10px 30px rgba(15,23,42,0.15)",
      }}
    >

      {filteredStyleNames.length === 0 ? (
        <div
          style={{
            padding: 14,
            color: "#64748b",
          }}
        >
          No style found
        </div>
      ) : (
        filteredStyleNames.map((style) => (
          <button
            type="button"
            key={style}
            onClick={() => {
              setStyleQuery(style);
              setShowStyleDropdown(false);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "11px 14px",
              border: "none",
              borderBottom:
                "1px solid #f1f5f9",
              background: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "#f8fafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "#fff";
            }}
          >
            👕 {style}
          </button>
        ))
      )}

    </div>
  )}
</div>
