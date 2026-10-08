"use client";
export default function StudioLoading() {
  return (
    <div className="loading" style={{ flexDirection: "column" }}>
      <span>Opening your studio…</span>
      <button className="text-button" onClick={() => window.location.reload()}>
        Taking longer than expected? Reload studio
      </button>
    </div>
  );
}
