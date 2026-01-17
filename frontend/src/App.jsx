import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";

const API_BASE = "";

/* VITE_API_BASE=https://bcec-datahub-production.up.railway.app */

const isValidSemesterFormat = s => /^\d{4}[SF]$/.test(s);
const getPid = obj => obj?.Person_id ?? obj?.person_id ?? obj?.personId ?? obj?.personID ?? obj?.PersonID;

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
    /* ---------------- Semester ---------------- */
  const [currentSemester, setCurrentSemester] = useState("2026S");
  const isValidSemester = isValidSemesterFormat(currentSemester);
  const [editingPerson, setEditingPerson] = useState({});
  const verifyTimerRef = useRef(null);
  const verifiedPasswordRef = useRef(
    sessionStorage.getItem("execPasswordVerified") || ""
  );

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
  const [excludeTerms, setExcludeTerms] = useState("");

  const [execPassword, setExecPassword] = useState(
    sessionStorage.getItem("execPassword") || ""
  );
  const [isExecVerified, setIsExecVerified] = useState(
    sessionStorage.getItem("execVerified") === "true"
  );
  const [accessRole, setAccessRole] = useState(
    sessionStorage.getItem("accessRole") || "none"
  );

const openPersonEdit = (pid, person, field) => {
  setEditingPerson(prev => {
    const existing = prev[pid] || {};
    const existingValue =
      existing[field]?.value ??
      (field === "name" ? person.name : person.linkedin) ??
      "";

    return {
      ...prev,
      [pid]: {
        ...existing,
        // was: existing.verified_semester ?? currentSemester
        verified_semester: existing.verified_semester ?? "",
        [field]: { open: true, value: existingValue }
      }
    };
  });
};


const closePersonEdit = (pid, field) => {
  setEditingPerson(prev => {
    const cur = prev[pid];
    if (!cur) return prev;

    const nextPid = {
      ...cur,
      [field]: { ...(cur[field] || {}), open: false }
    };

    const anyOpen = !!nextPid.name?.open || !!nextPid.linkedin?.open;

    if (!anyOpen) {
      const next = { ...prev };
      delete next[pid];
      return next;
    }

    return { ...prev, [pid]: nextPid };
  });
};

const updatePersonDraft = (pid, field, value) => {
  setEditingPerson(prev => ({
    ...prev,
    [pid]: {
      ...(prev[pid] || {}),
      verified_semester: prev[pid]?.verified_semester ?? "",
      [field]: { ...(prev[pid]?.[field] || {}), open: true, value }
    }
  }));
};

const updatePersonSemester = (pid, value) => {
  setEditingPerson(prev => ({
    ...prev,
    [pid]: {
      ...(prev[pid] || {}),
      verified_semester: value.toUpperCase()
    }
  }));
};

const savePersonField = async (pid, field) => {
  const draft = editingPerson[pid];
  if (!draft?.[field]?.open) return;

  const sem = (draft.verified_semester ?? "").trim();
  if (sem && !isValidSemesterFormat(sem)) {
    alert("Semester must look like 2026S or 2025F");
    return;
  }

  const value = (draft[field].value ?? "").trim() || null;

  const payload =
    field === "name"
      ? { name: value, verified_semester: sem || null }
      : { linkedin: value, verified_semester: sem || null };

  const res = await fetch(`${API_BASE}/people/${pid}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Exec-Password": execPassword
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("Person update failed:", res.status, text);
    alert("Failed to update person");
    return;
  }

  let saved = null;
  try {
    saved = JSON.parse(text);
  } catch {
    saved = null;
  }
const manualMetaPatch =
  field === "name"
    ? { name_data_source: "manual", name_verified_semester: sem || null }
    : { linkedin_data_source: "manual", linkedin_verified_semester: sem || null };
  // Don't keep verified_semester on the in-memory person record unless your GET returns it
const { verified_semester, ...personPatch } = payload;

setAlumni(prev =>
  prev.map(p => {
    if (getPid(p) !== pid) return p;

    const next = { ...p, ...personPatch, ...manualMetaPatch };

    // If backend returns metadata too, keep it
    return saved && typeof saved === "object" ? { ...next, ...saved } : next;
  })
);


  closePersonEdit(pid, field);
};



  /* ---------------- Exec password verify ---------------- */

  const verifyExecPassword = async password => {
    try {
      const res = await fetch(`${API_BASE}/exec/verify`, {
        headers: { "X-Exec-Password": password }
      });

      if (res.ok) {
  const data = await res.json(); // { ok: true, role: "exec" | "editor" }

  setIsExecVerified(true);
  setAccessRole(data.role);

  sessionStorage.setItem("execVerified", "true");
  sessionStorage.setItem("accessRole", data.role);

  verifiedPasswordRef.current = password;
  sessionStorage.setItem("execPasswordVerified", password);
} else {
  setIsExecVerified(false);
  setAccessRole("none");

  sessionStorage.removeItem("execVerified");
  sessionStorage.removeItem("accessRole");

  verifiedPasswordRef.current = "";
  sessionStorage.removeItem("execPasswordVerified");
}
    } catch {
  setIsExecVerified(false);
  setAccessRole("none");

  sessionStorage.removeItem("execVerified");
  sessionStorage.removeItem("accessRole");

  verifiedPasswordRef.current = "";
  sessionStorage.removeItem("execPasswordVerified");
}
  };

const handlePasswordChange = value => {
  setExecPassword(value);

  // Persist typed value
  if (value) sessionStorage.setItem("execPassword", value);
  else sessionStorage.removeItem("execPassword");

  // Clear any pending verify
  if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);

  // If not exactly the verified password, drop exec immediately
  if (value !== verifiedPasswordRef.current) {
  setIsExecVerified(false);
  setAccessRole("none");

  sessionStorage.removeItem("execVerified");
  sessionStorage.removeItem("accessRole");

  verifiedPasswordRef.current = "";
  sessionStorage.removeItem("execPasswordVerified");
}

  // If empty, clear verified record and stop
  if (!value) {
  verifiedPasswordRef.current = "";
  setAccessRole("none");
  sessionStorage.removeItem("execPasswordVerified");
  sessionStorage.removeItem("accessRole");
  return;
}

  // Debounced verify
  verifyTimerRef.current = setTimeout(() => {
    verifyExecPassword(value);
  }, 200);
};

  useEffect(() => {
  return () => {
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
  };
}, []);
useEffect(() => {
  if (!execPassword) return;

  // If already verified for this exact password, keep exec on
  if (
  execPassword === verifiedPasswordRef.current &&
  sessionStorage.getItem("execVerified") === "true"
) {
  setIsExecVerified(true);
  setAccessRole(sessionStorage.getItem("accessRole") || "none"); // <- add this
  return;
}

  // Otherwise force off until verified
  setIsExecVerified(false);
setAccessRole("none");
sessionStorage.removeItem("execVerified");
sessionStorage.removeItem("accessRole");

  verifyExecPassword(execPassword);

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
const apiFetch = async (url) => {
  const res = await fetch(url, {
    headers: isExecVerified && execPassword
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
      [...safeAlumni, ...safeActive].forEach(p => {
  const pid = getPid(p);
  if (pid != null) map.set(pid, p);
});
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

const ids = combined.map(getPid).filter(Boolean);


// Bulk membership history
{
  const res = await fetch(`${API_BASE}/membership_history/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isExecVerified && execPassword ? { "X-Exec-Password": execPassword } : {})
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
      ...(isExecVerified && execPassword ? { "X-Exec-Password": execPassword } : {})
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
const pid = getPid(row);
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
}, [filters.alumniStatus, currentSemester, isValidSemester, isExecVerified, accessRole]);

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
const pid = getPid(person);
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
    {accessRole === "editor" ? "Editor access enabled" : "Exec access enabled"}
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
<input
  type="password"
  placeholder="Exec password"
  value={execPassword}
  onChange={e => handlePasswordChange(e.target.value)}
/>
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
  const pid = getPid(person);
  if (pid == null) return null;

  const history = memberships[pid] || [];

  return (
    <div className="table-row" key={pid}>

{/* 1) Name */}
<div className="name">
  {accessRole === "editor" && editingPerson[pid]?.name?.open ? (
    <div className="inline-edit">
      <input
        placeholder="Name"
        value={editingPerson[pid]?.name?.value ?? ""}
        onChange={e => updatePersonDraft(pid, "name", e.target.value)}
      />

<input
  placeholder={`Semester (e.g. ${currentSemester})`}
  value={editingPerson[pid]?.verified_semester ?? ""}
  onChange={e => updatePersonSemester(pid, e.target.value)}
/>

      <button onClick={() => savePersonField(pid, "name")}>Save</button>
      <button onClick={() => closePersonEdit(pid, "name")}>Cancel</button>
    </div>
  ) : (
    <div className="inline-display">
      <div>{person.name || "—"}</div>

      {person.name_data_source === "manual" && (
        <div className="tiny manual">
          Manually entered
          {person.name_verified_semester ? ` · ${person.name_verified_semester}` : ""}
        </div>
      )}

      {accessRole === "editor" && (
        <button onClick={() => openPersonEdit(pid, person, "name")}>Edit</button>
      )}
    </div>
  )}
</div>



      {/* 2) Email */}
      <div className="muted">
        {isExecVerified ? person.email : <span className="email-hidden">Hidden</span>}
      </div>

{/* 3) LinkedIn */}
<div className="muted">
  {accessRole === "editor" && editingPerson[pid]?.linkedin?.open ? (
    <div className="inline-edit">
      <input
        placeholder="LinkedIn"
        value={editingPerson[pid]?.linkedin?.value ?? ""}
        onChange={e => updatePersonDraft(pid, "linkedin", e.target.value)}
      />

      <input
        placeholder={`Semester (e.g. ${currentSemester})`}
        value={editingPerson[pid]?.verified_semester ?? ""}
        onChange={e => updatePersonSemester(pid, e.target.value)}
      />

      <button onClick={() => savePersonField(pid, "linkedin")}>Save</button>
      <button onClick={() => closePersonEdit(pid, "linkedin")}>Cancel</button>
    </div>
  ) : (
    <div className="inline-display">
      <div>{person.linkedin || "—"}</div>

      {person.linkedin_data_source === "manual" && (
        <div className="tiny manual">
          Manually entered
          {person.linkedin_verified_semester ? ` · ${person.linkedin_verified_semester}` : ""}
        </div>
      )}

      {accessRole === "editor" && (
        <button onClick={() => openPersonEdit(pid, person, "linkedin")}>Edit</button>
      )}
    </div>
  )}
</div>



      {/* 4) Graduated */}
      <div className="muted">{person.graduation_semester || "—"}</div>

      {/* 5) Roles */}
      <div className="muted">
        {history.filter(h => h.role).map((h, i) => {
          const role = normalizeRole(h.role);
          return (
            <div key={i}>
              • <span className="role-abbrev" title={ROLE_LEGEND[role]}>{role}</span> ({h.start_semester})
            </div>
          );
        })}
      </div>

      {/* 6) Committees */}
      <div className="muted">
        {history.filter(h => h.committee).map((h, i) => (
          <div key={i}>• {h.committee} ({h.start_semester})</div>
        ))}
      </div>

      {/* 7) Where are they now */}
      <div className="muted">
        {(() => {
          const p = externalProfiles[pid] || {};

          const title =
            (p.manual_title ?? "").trim() ||
            (p.current_title ?? "").trim() ||
            "";

          const company =
            (p.manual_company ?? "").trim() ||
            (p.current_company ?? "").trim() ||
            "";

          const displayLine =
            title && company ? `${title} @ ${company}` : (title || company || "—");

          const isManual = p.data_source === "manual";
          const semester = p.last_verified_at || "";

          const metaLine = isManual
            ? `Manually entered${semester ? ` · ${semester}` : ""}`
            : null;

          const isEditing = !!editing[pid];
const edit = editing[pid] || {};

if (!isExecVerified) {
  return (
    <div className="inline-display">
      <div>{displayLine}</div>
      {metaLine && <div className="tiny manual">{metaLine}</div>}
    </div>
  );
}

if (isEditing) {
  return (
    <div className="inline-edit">
      <input
        placeholder="Title"
        value={edit.manual_title ?? p.manual_title ?? ""}
        onChange={e =>
          setEditing(prev => ({
            ...prev,
            [pid]: { ...(prev[pid] || {}), manual_title: e.target.value }
          }))
        }
      />

      <input
        placeholder="Company"
        value={edit.manual_company ?? p.manual_company ?? ""}
        onChange={e =>
          setEditing(prev => ({
            ...prev,
            [pid]: { ...(prev[pid] || {}), manual_company: e.target.value }
          }))
        }
      />

      <input
        placeholder={`Semester (e.g. ${currentSemester})`}
        value={edit.last_verified_at ?? p.last_verified_at ?? ""}
        onChange={e =>
          setEditing(prev => ({
            ...prev,
            [pid]: {
              ...(prev[pid] || {}),
              last_verified_at: e.target.value.toUpperCase()
            }
          }))
        }
      />

      <button
        onClick={async () => {
          const payload = {
            manual_title: (edit.manual_title ?? p.manual_title ?? "").trim() || null,
            manual_company: (edit.manual_company ?? p.manual_company ?? "").trim() || null,
            last_verified_at: (edit.last_verified_at ?? p.last_verified_at ?? "").trim() || null
          };

          const res = await fetch(`${API_BASE}/external_profiles/${pid}/manual`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "X-Exec-Password": execPassword
            },
            body: JSON.stringify(payload)
          });

          const text = await res.text();
          if (!res.ok) {
            console.error("Manual override save failed:", res.status, text);
            alert("Failed to save manual override");
            return;
          }

          let saved = null;
          try { saved = JSON.parse(text); } catch { saved = null; }

          setExternalProfiles(prev => ({
            ...prev,
            [pid]: {
              ...(prev[pid] || {}),
              manual_title: saved?.manual_title ?? payload.manual_title,
              manual_company: saved?.manual_company ?? payload.manual_company,
              last_verified_at: saved?.last_verified_at ?? payload.last_verified_at,
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
        onClick={() =>
          setEditing(prev => {
            const next = { ...prev };
            delete next[pid];
            return next;
          })
        }
      >
        Cancel
      </button>
    </div>
  );
}

return (
  <div className="inline-display">
    <div>{displayLine}</div>
    {metaLine && <div className="tiny manual">{metaLine}</div>}

    <button
      onClick={() =>
        setEditing(prev => ({
          ...prev,
          [pid]: {
            manual_title: p.manual_title ?? p.current_title ?? "",
            manual_company: p.manual_company ?? p.current_company ?? "",
            last_verified_at: p.last_verified_at ?? ""
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

         {/* 8) Reached out */}
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
                <div className="tiny">
                  Updated {p.contact_status_updated_at.slice(0, 10)}
                </div>
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