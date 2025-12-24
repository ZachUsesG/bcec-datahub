const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

import { useEffect, useState, useMemo } from "react";
import "./App.css";

/* VITE_API_BASE=https://bcec-datahub-production.up.railway.app */

const isValidSemesterFormat = s => /^\d{4}[SF]$/.test(s);

function App() {
  const [alumni, setAlumni] = useState([]);
  const [memberships, setMemberships] = useState({});
  const [externalProfiles, setExternalProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    name: "",
    email: "",
    linkedin: "",
    graduationYear: "",
    alumniStatus: "alumni",
    roles: new Set(),
    committees: new Set()
  });

  const [editing, setEditing] = useState({});

  const [execPassword, setExecPassword] = useState(
    sessionStorage.getItem("execPassword") || ""
  );
  const [isExecVerified, setIsExecVerified] = useState(
    sessionStorage.getItem("execVerified") === "true"
  );

  const [excludeTerms, setExcludeTerms] = useState("");

  /* ---------------- Semester ---------------- */
  const [currentSemester, setCurrentSemester] = useState("2025F");
  const isValidSemester = /^\d{4}[SF]$/.test(currentSemester);

  /* ---------------- Exec password verify ---------------- */

  const verifyExecPassword = async password => {
    try {
      const res = await fetch(`${API_BASE}/exec/verify`, {
        headers: { "X-Exec-Password": password }
      });

      if (res.ok) {
        setIsExecVerified(true);
        sessionStorage.setItem("execVerified", "true");
      } else {
        setIsExecVerified(false);
        sessionStorage.removeItem("execVerified");
      }
    } catch {
      setIsExecVerified(false);
      sessionStorage.removeItem("execVerified");
    }
  };

  const handlePasswordChange = value => {
    setExecPassword(value);

    if (value) {
      sessionStorage.setItem("execPassword", value);
      verifyExecPassword(value);
    } else {
      sessionStorage.removeItem("execPassword");
      sessionStorage.removeItem("execVerified");
      setIsExecVerified(false);
    }
  };
  const apiFetch = async (url) => {
    const res = await fetch(url, {
      headers: execPassword
        ? { "X-Exec-Password": execPassword }
        : {}
    });

    if (!res.ok) {
      console.error("API error:", url, await res.text());
      return null;
    }

    return res.json();
  };
  /* ---------------- Fetch data ---------------- */

useEffect(() => {
  if (!isValidSemester) return;

  const fetchData = async () => {
    setLoading(true);
    let combined = [];

    if (filters.alumniStatus === "both") {
      const alumniData = await apiFetch(
        `${API_BASE}/get_alumni_members?semester=${currentSemester}`
      );
      const activeData = await apiFetch(
        `${API_BASE}/get_active_members?semester=${currentSemester}`
      );

      const safeAlumni = Array.isArray(alumniData) ? alumniData : [];
      const safeActive = Array.isArray(activeData) ? activeData : [];

      const map = new Map();
      [...safeAlumni, ...safeActive].forEach(p =>
        map.set(p.Person_id, p)
      );
      combined = Array.from(map.values());
    } else {
      const endpoint =
        filters.alumniStatus === "active"
          ? "get_active_members"
          : "get_alumni_members";

      const data = await apiFetch(
        `${API_BASE}/${endpoint}?semester=${currentSemester}`
      );
      combined = Array.isArray(data) ? data : [];
    }

    setAlumni(combined);

    const historyMap = {};
    for (const person of combined) {
      const history = await apiFetch(
        `${API_BASE}/get_membership_history?person_id=${person.Person_id}`
      );
      historyMap[person.Person_id] = Array.isArray(history) ? history : [];
    }
    setMemberships(historyMap);

    if (combined.length > 0) {
      const ids = combined.map(p => p.Person_id);
      const rows = await apiFetch(
        `${API_BASE}/external_profiles?` +
          ids.map(id => `person_ids=${id}`).join("&")
      );

      const profileMap = {};
      if (Array.isArray(rows)) {
        rows.forEach(p => (profileMap[p.Person_id] = p));
      }
      setExternalProfiles(profileMap);
    } else {
      setExternalProfiles({});
    }

    setLoading(false);
  };

  fetchData();
}, [filters.alumniStatus, currentSemester, isValidSemester]);

  /* ---------------- Derived filters ---------------- */

  const availableRoles = useMemo(() => {
    const set = new Set();
    Object.values(memberships).forEach(history =>
      history.forEach(h => h.role && set.add(h.role))
    );
    return Array.from(set).sort();
  }, [memberships]);

  const availableCommittees = useMemo(() => {
    const set = new Set();
    Object.values(memberships).forEach(history =>
      history.forEach(h => h.committee && set.add(h.committee))
    );
    return Array.from(set).sort();
  }, [memberships]);

  /* ---------------- Filtering logic ---------------- */

  const filteredAlumni = useMemo(() => {
    const excluded = excludeTerms
      .toLowerCase()
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    return alumni.filter(person => {
      const history = memberships[person.Person_id] || [];
      const profile = externalProfiles[person.Person_id];

      if (filters.name && !person.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.email && !person.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
      if (filters.linkedin && !person.linkedin?.toLowerCase().includes(filters.linkedin.toLowerCase())) return false;
      if (filters.graduationYear && person.graduation_semester?.toString() !== filters.graduationYear) return false;

      if (filters.roles.size > 0 && !history.some(h => h.role && filters.roles.has(h.role))) return false;
      if (filters.committees.size > 0 && !history.some(h => h.committee && filters.committees.has(h.committee))) return false;

      if (excluded.length > 0 && profile?.current_title) {
        const title = profile.current_title.toLowerCase();
        if (excluded.some(word => title.includes(word))) return false;
      }

      return true;
    });
  }, [alumni, memberships, filters, excludeTerms, externalProfiles]);

  /* ---------------- Render ---------------- */

  return (
    <div className="container">
      <h1>BCEC Alumni</h1>

      {isExecVerified && (
        <div className="exec-banner">
          Exec access enabled
        </div>
      )}

      {loading ? (
        <p className="muted">Loading alumni…</p>
      ) : (
        <>
          <p className="muted">Found {filteredAlumni.length} people</p>

          {/* FILTERS */}
          <div className="filters">
            <div className="filter-row">
              <input placeholder="Name" value={filters.name}
                onChange={e => setFilters(f => ({ ...f, name: e.target.value }))} />

              <input type="password" placeholder="Exec password"
                value={execPassword}
                onChange={e => handlePasswordChange(e.target.value)} />

              <input placeholder="Email" value={filters.email}
                onChange={e => setFilters(f => ({ ...f, email: e.target.value }))} />

              <input placeholder="LinkedIn" value={filters.linkedin}
                onChange={e => setFilters(f => ({ ...f, linkedin: e.target.value }))} />

              <input placeholder="Graduation year" value={filters.graduationYear}
                onChange={e => setFilters(f => ({ ...f, graduationYear: e.target.value }))} />

              <input placeholder="Exclude keywords (e.g. intern, consultant)"
                value={excludeTerms}
                onChange={e => setExcludeTerms(e.target.value)} />

              <select value={filters.alumniStatus}
                onChange={e => setFilters(f => ({ ...f, alumniStatus: e.target.value }))}>
                <option value="alumni">Alumni</option>
                <option value="active">Active members</option>
                <option value="both">Alumni + Active</option>
              </select>
            </div>

            <div className="filter-row">
              <select className="multi-select" multiple value={[...filters.roles]}
                onChange={e => setFilters(f => ({
                  ...f,
                  roles: new Set(Array.from(e.target.selectedOptions).map(o => o.value))
                }))}>
                {availableRoles.map(role => <option key={role}>{role}</option>)}
              </select>

              <select className="multi-select" multiple value={[...filters.committees]}
                onChange={e => setFilters(f => ({
                  ...f,
                  committees: new Set(Array.from(e.target.selectedOptions).map(o => o.value))
                }))}>
                {availableCommittees.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="filter-row actions">
              <input placeholder="Current semester (e.g. 2025F)"
                value={currentSemester}
                onChange={e => setCurrentSemester(e.target.value.toUpperCase())} />
              <button onClick={() => {
                setFilters({
                  name: "", email: "", linkedin: "", graduationYear: "",
                  roles: new Set(), committees: new Set(), alumniStatus: "alumni"
                });
                setExcludeTerms("");
              }}>
                Clear filters
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table">
            <div className="table-header">
              <div>Name</div>
              <div>Email {isExecVerified ? "" : "(Exec)"}</div>
              <div>LinkedIn</div>
              <div>Graduated</div>
              <div>Roles</div>
              <div>Committees</div>
              <div>Where are they now</div>
            </div>

            {filteredAlumni.map(person => {
              const history = memberships[person.Person_id] || [];
              const profile = externalProfiles[person.Person_id];
              const isEditing = !!editing[person.Person_id];
              const edit = editing[person.Person_id] || {};

              return (
                <div className="table-row" key={person.Person_id}>
                  <div className="name">{person.name}</div>

                  <div className="muted">
                    {isExecVerified ? person.email : <span className="email-hidden">Hidden</span>}
                  </div>

                  <div className="muted">{person.linkedin || "—"}</div>
                  <div className="muted">{person.graduation_semester || "—"}</div>

                  <div className="muted">
                    {history.filter(h => h.role).map((h, i) =>
                      <div key={i}>• {h.role} ({h.start_semester})</div>
                    )}
                  </div>

                  <div className="muted">
                    {history.filter(h => h.committee).map((h, i) =>
                      <div key={i}>• {h.committee} ({h.start_semester})</div>
                    )}
                  </div>

                  <div className="muted">
                    {isEditing ? (
                      <>
                        <input placeholder="Manual title"
                          value={edit.manual_title || ""}
                          onChange={e => setEditing(prev => ({
                            ...prev,
                            [person.Person_id]: { ...edit, manual_title: e.target.value }
                          }))} />

                        <input placeholder="Manual company"
                          value={edit.manual_company || ""}
                          onChange={e => setEditing(prev => ({
                            ...prev,
                            [person.Person_id]: { ...edit, manual_company: e.target.value }
                          }))} />

                        <input
                          placeholder="Verification semester (e.g. 2026S)"
                          value={edit.verified_semester || ""}
                          onChange={e =>
                            setEditing(prev => ({
                              ...prev,
                              [person.Person_id]: {
                                ...edit,
                                verified_semester: e.target.value.toUpperCase()
                              }
                            }))
                          }
                        />

<button
  type="button"
  disabled={!isValidSemesterFormat(edit.verified_semester)}
  onClick={async () => {
    const res = await fetch(
        `${API_BASE}/external_profiles/${person.Person_id}/manual`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Exec-Password": execPassword
        },
        body: JSON.stringify({
          manual_title: edit.manual_title || null,
          manual_company: edit.manual_company || null,
          verified_semester: edit.verified_semester
        })
      }
    );

    if (!res.ok) {
      alert("Invalid exec password");
      return;
    }

    setExternalProfiles(prev => ({
      ...prev,
      [person.Person_id]: {
        ...prev[person.Person_id],
        manual_title: edit.manual_title || null,
        manual_company: edit.manual_company || null,
        last_verified_at: edit.verified_semester
      }
    }));

    setEditing(prev => {
      const copy = { ...prev };
      delete copy[person.Person_id];
      return copy;
    });
  }}
>
  Save
</button>

<button
  type="button"
  onClick={() => {
    setEditing(prev => {
      const copy = { ...prev };
      delete copy[person.Person_id];
      return copy;
    });
  }}
>
  Cancel
</button>

                      </>
                    ) : (
                      <>
                        {profile?.manual_title ? (
                          <>
                            {profile.manual_title}
                            {profile.manual_company && ` @ ${profile.manual_company}`}
                            <div className="tiny">Manually entered</div>
                          </>
                        ) : profile?.current_title ? (
                          `${profile.current_title} @ ${profile.current_company}`
                        ) : "—"}

                        {profile?.last_verified_at && (
                          <div className="tiny">Verified {profile.last_verified_at}</div>
                        )}

                        {isExecVerified && (
                          <button onClick={() =>
                            setEditing({
                              ...editing,
                              [person.Person_id]: {
                                manual_title: profile?.manual_title || profile?.current_title || "",
                                manual_company: profile?.manual_company || profile?.current_company || "",
                                verified_semester: ""
                              }
                            })
                          }>
                            Edit
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
