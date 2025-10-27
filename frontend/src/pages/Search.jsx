<<<<<<< HEAD
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Search() {
  const [location, setLocation] = useState('San Jose')
  const [start, setStart] = useState('2025-10-22')
  const [end, setEnd] = useState('2025-10-25')
  const [guests, setGuests] = useState(2)
  const [results, setResults] = useState([])

  const go = async () => {
    const r = await api.get('/api/search', { params: { location, start, end, guests } })
    setResults(r.data.results)
  }

  return (
    <div>
      <div className="bg-white p-4 rounded shadow mb-3 grid grid-cols-5 gap-2">
        <input className="border rounded p-2" placeholder="Location" value={location} onChange={e=>setLocation(e.target.value)} />
        <input className="border rounded p-2" type="date" value={start} onChange={e=>setStart(e.target.value)} />
        <input className="border rounded p-2" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
        <input className="border rounded p-2" type="number" value={guests} onChange={e=>setGuests(e.target.value)} />
        <button onClick={go} className="bg-black text-white rounded">Search</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {results.map(r => (
          <Link to={`/property/${r.id}`} key={r.id} className="bg-white p-3 rounded shadow">
            <div className="font-semibold">{r.title}</div>
            <div className="text-sm">{r.city}, {r.country}</div>
            <div className="text-sm">${r.price_per_night} / night</div>
          </Link>
        ))}
      </div>
    </div>
  )
=======
import React, { useState } from "react";
import api from "../api";

function normalizeDate(d) {
  if (!d) return "";
  // Accept MM/DD/YYYY or YYYY-MM-DD and normalize to YYYY-MM-DD
  const hasSlash = typeof d === "string" && d.includes("/");
  const date = hasSlash ? new Date(d) : new Date(d);
  // If parsing failed, just return original
  if (isNaN(date.getTime())) return d;
  return date.toISOString().slice(0, 10);
}

export default function Search() {
  const [location, setLocation] = useState("San Jose");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guests, setGuests] = useState(2);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]); // ALWAYS an array

  const onSearch = async () => {
    setLoading(true);
    setError("");
    setResults([]);

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);

    try {
      // Backend supports either (city,startDate,endDate) or (location,start,end)
      const res = await api.get("/api/search", {
        params: {
          city: location,
          startDate: start || undefined,
          endDate: end || undefined,
          guests: guests || undefined,
        },
      });

      const items = (res?.data?.properties) || [];
      setResults(Array.isArray(items) ? items : []);
    } catch (e) {
      // Show a helpful message from server if present
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Search failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex gap-3 items-center">
        <input
          className="border rounded px-3 py-2 w-64"
          placeholder="City or location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 w-48"
          type="text"
          placeholder="Start (YYYY-MM-DD or MM/DD/YYYY)"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 w-48"
          type="text"
          placeholder="End (YYYY-MM-DD or MM/DD/YYYY)"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 w-24"
          type="number"
          min={1}
          value={guests}
          onChange={(e) => setGuests(parseInt(e.target.value || "1", 10))}
        />
        <button
          onClick={onSearch}
          className="bg-black text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-sm border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="text-gray-500 text-sm">No results yet. Try a search.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(results || []).map((p) => (
          <div key={p.id} className="border rounded p-3">
            <div className="font-semibold">{p.title || "Untitled"}</div>
            <div className="text-sm text-gray-600">
              {[p.city, p.state, p.country].filter(Boolean).join(", ")}
            </div>
            <div className="text-sm mt-1">Type: {p.type}</div>
            <div className="text-sm">Price: ${p.price_per_night}/night</div>
            <div className="text-xs text-gray-600">
              {Array.isArray(p.amenities) ? p.amenities.join(" • ") : ""}
            </div>
            <a
              className="inline-block mt-2 text-blue-600 underline"
              href={`/property/${p.id}`}
            >
              View details
            </a>
          </div>
        ))}
      </div>
    </div>
  );
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
}
