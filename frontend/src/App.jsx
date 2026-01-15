import { useState, useEffect, useMemo } from "react";
import "./App.css";

const API_BASE = "";

/* VITE_API_BASE=https://bcec-datahub-production.up.railway.app */

const isValidSemesterFormat = s => /^\d{4}[SF]$/.test(s);

const normalizeRole = role =>
  role === "ECP" ? "EVP" : role;

const ROLE_LEGEND = {
  EVP: "Vice President of External Affairs",
  IVP: "Internal Vice President",
  CM: "Committee Member",
  VPBA: "Vice President of Business Affairs",
  VPCE: "Vice President of Club Events",
  VPDEIB: "Vice President of Diversity, Equity, Inclusion, and Belonging",
  VPE: "Vice President of Executive",
  VPF: "Vice President of Finance",
  VPHR: "Vice President of Human Resources",
  VPM: "Vice President of Membership",
  VPMA: "Vice President of Member Affairs",
  VPO: "Vice President of Operations",
  VPP: "Vice President of Projects",
  "General Member": "Member of General Membership",
  "Senior Mentor": "General Senior Advisor I think,,",
  Webmaster: "..Webmaster?"
};

const ROLE_GROUPS = {
  Executive: [
    "President",
    "EVP",
    "IVP",
    "VPBA",
    "VPCE",
    "VPDEIB",
    "VPE",
    "VPF",
    "VPHR",
    "VPM",
    "VPMA",
    "VPO",
    "VPP",
    "Webmaster"
  ],
  
  Directors: [
    "Director of Beauty",
    "Directorof Digital Marketing",
    "Director of Fashion",
    "Director of Film",
    "Director of Games",
    "Director of General Membership",
    "Director of Marketing",
    "Director of Media",
    "Director of Music",
    "Director of Sports",
    "Director of Technology",
    "Director of Television",
    "Director of Video Games",
  ],

  Advisors: [
    "Senior Advisor of Beauty",
    "Senior Advisor of Digital Marketing",
    "Senior Advisor of Film",
    "Senior Advisor of General Membership",
    "Senior Advisor of Media",
    "Senior Advisor of Music",
    "Senior Advisor of Sports",
    "Senior Advisor of Technology",
    "Senior Advisor of Television",
    "Senior Advisor of Video Games",
    "Senior Mentor"
  ],

  "General / Other": [
    "General Member",
    "CM",
  ]
};

const CONTACT_STATUS_OPTIONS = [
  { value: "not_yet", label: "Not yet" },
  { value: "reached_out", label: "Reached out" },
  { value: "consented", label: "Consented for further interaction" },
  { value: "do_not_contact", label: "Do not contact" }
];

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
  const [currentSemester, setCurrentSemester] = useState("2026S");
  const isValidSemester = isValidSemesterFormat(currentSemester);

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
console.log("RAW alumni:", combined.length);

const ids = combined
  .map(p => p.Person_id ?? p.person_id ?? p.personId)
  .filter(Boolean);

// Bulk membership history
{
  const res = await fetch(`${API_BASE}/membership_history/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(execPassword ? { "X-Exec-Password": execPassword } : {})
    },
    body: JSON.stringify({ person_ids: ids })
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Bulk history failed:", res.status, text);
    setMemberships({});
  } else {
    setMemberships(JSON.parse(text));
  }
}

// Bulk external profiles (ALWAYS normalize into a map)
if (ids.length > 0) {
  const res = await fetch(`${API_BASE}/external_profiles/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(execPassword ? { "X-Exec-Password": execPassword } : {})
    },
    body: JSON.stringify({ person_ids: ids })
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("Bulk profiles failed:", res.status, text);
    setExternalProfiles({});
  } else {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Bulk profiles JSON parse failed:", e, text);
      setExternalProfiles({});
      parsed = null;
    }

    const rows = Array.isArray(parsed)
      ? parsed
      : (parsed && typeof parsed === "object" ? Object.values(parsed) : []);

    const profileMap = {};
    rows.forEach(row => {
      const pid = row.person_id ?? row.Person_id ?? row.personId;
      if (pid != null) profileMap[pid] = row;
    });

    setExternalProfiles(profileMap);
  }
} else {
  setExternalProfiles({});
}
setLoading(false);

};

  fetchData();
}, [filters.alumniStatus, currentSemester, isValidSemester, isExecVerified, execPassword]);

  /* ---------------- Derived filters ---------------- */

  const availableRoles = useMemo(() => {
  const set = new Set();
  Object.values(memberships).forEach(history =>
    history.forEach(h => {
      if (!h.role) return;
      set.add(normalizeRole(h.role));
    })
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
const pid = person.Person_id ?? person.person_id ?? person.personId;
const history = (pid != null ? memberships[pid] : []) || [];
const p = (pid != null ? externalProfiles[pid] : {}) || {};

    if (filters.name && !person.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.email && !person.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
    if (filters.linkedin && !person.linkedin?.toLowerCase().includes(filters.linkedin.toLowerCase())) return false;

    if (filters.graduationYear && !person.graduation_semester?.startsWith(filters.graduationYear)) return false;

    if (filters.roles.size > 0 && !history.some(h => h.role && filters.roles.has(normalizeRole(h.role)))) return false;
    if (filters.committees.size > 0 && !history.some(h => h.committee && filters.committees.has(h.committee))) return false;

    // exclude keywords using manual_title first, then current_title
    const titleForExclusion = (
      (p.manual_title ?? "") ||
      (p.current_title ?? "")
    ).toLowerCase();

    if (excluded.length > 0 && titleForExclusion) {
      if (excluded.some(word => titleForExclusion.includes(word))) return false;
    }

    return true;
  });
}, [alumni, memberships, filters, excludeTerms, externalProfiles]);
useEffect(() => {
  console.log("FILTERED alumni:", filteredAlumni.length);
}, [filteredAlumni]);

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
                onChange={e => setExecPassword(e.target.value)}
                onBlur={() => handlePasswordChange(execPassword)} />

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
<select
  className="multi-select"
  multiple
  value={[...filters.roles]}
  onChange={e =>
    setFilters(f => ({
      ...f,
      roles: new Set(
        Array.from(e.target.selectedOptions).map(o => o.value)
      )
    }))
  }
>
  {Object.entries(ROLE_GROUPS).map(([groupName, roles]) => (
    <optgroup key={groupName} label={groupName}>
      {roles
        .map(r => normalizeRole(r))
        .filter(r => availableRoles.includes(r))
        .map(role => (
          <option
            key={role}
            value={role}
            title={ROLE_LEGEND[role] || role}
          >
            {role}
          </option>
        ))}
    </optgroup>
  ))}
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
            <div className="table-inner">
            <div className="table-header">
              <div>Name</div>
              <div>Email {isExecVerified ? "" : "(Exec)"}</div>
              <div>LinkedIn</div>
              <div>Graduated</div>
              <div>Roles</div>
              <div>Committees</div>
              <div>Where are they now</div>

              <div>Reached out?</div>
            </div>

            {filteredAlumni.map(person => {
              const pid = person.Person_id ?? person.person_id ?? person.personId;
              const history = memberships[pid] || [];
              const isEditing = !!editing[pid];
              const edit = editing[pid] || {};

if (pid == null) return null;

return (
  <div className="table-row" key={pid}>
                  <div className="name">{person.name}</div>

                  <div className="muted">
                    {isExecVerified ? person.email : <span className="email-hidden">Hidden</span>}
                  </div>

                  <div className="muted">{person.linkedin || "—"}</div>
                  <div className="muted">{person.graduation_semester || "—"}</div>

                  <div className="muted">
{history.filter(h => h.role).map((h, i) => {
  const role = normalizeRole(h.role);
  return (
<div key={i}>
  • <span
      className="role-abbrev"
      title={ROLE_LEGEND[role]}
    >
      {role}
    </span> ({h.start_semester})
</div>
  );
})}
                  </div>

<div className="muted">
  {history.filter(h => h.committee).map((h, i) =>
    <div key={i}>• {h.committee} ({h.start_semester})</div>
  )}
</div>

{/* Where are they now */}
<div className="muted">
  {(() => {
  const p = externalProfiles[pid] || {};
  const isEditing = !!editing[pid];
  const edit = editing[pid] || {};

  const title =
    (p.manual_title ?? "").trim() ||
    (p.current_title ?? "").trim() ||
    "";

  const company =
    (p.manual_company ?? "").trim() ||
    (p.current_company ?? "").trim() || // remove if not real
    "";

  const displayLine =
    title && company ? `${title} @ ${company}` : (title || company || "—");

  if (!isExecVerified) return <span>{displayLine}</span>;

  if (isEditing) {
    return (
      <div className="inline-edit">
        <input
          placeholder="Title"
          value={edit.manual_title ?? p.manual_title ?? ""}
          onChange={e =>
            setEditing(prev => ({
              ...prev,
              [pid]: {
                ...(prev[pid] || {}),
                manual_title: e.target.value
              }
            }))
          }
        />
        <input
          placeholder="Company"
          value={edit.manual_company ?? p.manual_company ?? ""}
          onChange={e =>
            setEditing(prev => ({
              ...prev,
              [pid]: {
                ...(prev[pid] || {}),
                manual_company: e.target.value
              }
            }))
          }
        />

        <button
          onClick={async () => {
            const payload = {
              manual_title: (edit.manual_title ?? p.manual_title ?? "").trim() || null,
              manual_company: (edit.manual_company ?? p.manual_company ?? "").trim() || null
            };

            const res = await fetch(
              `${API_BASE}/external_profiles/${pid}/manual`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "X-Exec-Password": execPassword
                },
                body: JSON.stringify(payload)
              }
            );

            const text = await res.text();
            if (!res.ok) {
              console.error("Manual override save failed:", res.status, text);
              alert("Failed to save manual override");
              return;
            }

            let saved = null;
try {
  saved = JSON.parse(text);
} catch {
  saved = null;
}

            setExternalProfiles(prev => ({
              ...prev,
              [pid]: {
                ...(prev[pid] || {}),
    manual_title: saved?.manual_title ?? payload.manual_title,
    manual_company: saved?.manual_company ?? payload.manual_company,
    manual_updated_at: saved?.manual_updated_at ?? new Date().toISOString(),
    data_source: saved?.data_source ?? prev?.[pid]?.data_source
              }
            }));

            setEditing(prev => {
              const next = { ...prev };
              delete next[pid];
              return next;
            });
          }}
        >
          Save
        </button>

        <button
          onClick={() => {
            setEditing(prev => {
              const next = { ...prev };
              delete next[pid];
              return next;
            });
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

const isManual =
  !!(p.manual_title || p.manual_company) || p.data_source === "manual";

const sourceLabel = isManual
  ? "Manual"
  : (p.data_source ? p.data_source : "Unknown");

const verified = p.last_verified_at ? `Verified: ${p.last_verified_at}` : null;
const updated = p.manual_updated_at ? `Manual updated: ${p.manual_updated_at}` : null;

return (
  <div className="inline-display">
    <div>{displayLine}</div>

    <div className={`tiny ${isManual ? "manual" : ""}`}>
      <span>{sourceLabel}</span>
      {verified ? ` · ${verified}` : ""}
      {updated ? ` · ${updated}` : ""}
    </div>

    <button
      onClick={() =>
        setEditing(prev => ({
          ...prev,
          [pid]: {
            manual_title: p.manual_title ?? p.current_title ?? "",
            manual_company: p.manual_company ?? p.current_company ?? ""
          }
        }))
      }
    >
      Edit
    </button>
  </div>
);
})()}
</div>

{/* Reached out? (NEW cell) */}
<div className="muted">
  {(() => {
  const p = externalProfiles[pid] || {};
  const contactStatus = p.contact_status || "not_yet";
  const label =
    CONTACT_STATUS_OPTIONS.find(o => o.value === contactStatus)?.label ||
    "Not yet";

  if (!isExecVerified) return label;

  return (
    <>
      <select
        value={contactStatus}
        onChange={async e => {
          const next = e.target.value;

          const res = await fetch(
            `${API_BASE}/external_profiles/${pid}/contact_status`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Exec-Password": execPassword
              },
              body: JSON.stringify({ contact_status: next })
            }
          );

          const text = await res.text();
          if (!res.ok) {
            console.error("Contact status save failed:", res.status, text);
            alert("Failed to save contact status");
            return;
          }

          let payload;
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { contact_status: next, contact_status_updated_at: null };
          }

          setExternalProfiles(prev => ({
            ...prev,
            [pid]: {
              ...(prev[pid] || {}),
              contact_status: payload.contact_status || next,
              contact_status_updated_at: payload.contact_status_updated_at || null
            }
          }));
        }}
      >
        {CONTACT_STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {p.contact_status_updated_at && (
        <div className="tiny">Updated {p.contact_status_updated_at}</div>
      )}
    </>
  );
})()}
</div>
                </div>
              );
            })}
          </div>
          </div>
          <div className="internal-tag">
  BCEC internal system. Not for external distribution. Created by Zach Makari.
</div>
        </>
      )}
    </div>
  );
}

export default App;