<<<<<<< HEAD

=======
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function Favorites() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      // Your backend lists favorites at /api/favorites
      const r = await api.get("/api/favorites");
      const list = r?.data?.favorites ?? [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to load favourites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (propertyId) => {
    // Optimistic update
    const prev = items;
    setItems((xs) => xs.filter((p) => p.id !== propertyId));
    try {
      await api.delete(`/api/favorites/${propertyId}`);
    } catch (e) {
      // revert on failure
      setItems(prev);
      setErr(e?.response?.data?.error || "Failed to remove favourite");
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white p-3 rounded shadow h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {err && <div className="text-red-600 text-sm">{err}</div>}

      {items.length === 0 ? (
        <div className="text-sm text-gray-600">
          No favourites yet. Go to <Link className="underline" to="/search">Search</Link> and tap “Favourite”.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p) => (
            <div key={p.id} className="bg-white p-4 rounded shadow flex justify-between items-start">
              <div>
                <Link to={`/property/${p.id}`} className="font-semibold hover:underline">
                  {p.title || "Untitled"}
                </Link>
                <div className="text-sm text-gray-600">
                  {[p.city, p.state, p.country].filter(Boolean).join(", ")}
                </div>
              </div>
              <button
                onClick={() => remove(p.id)}
                className="text-red-600 text-sm hover:underline"
                title="Remove from favourites"
              >
                Unfavourite
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
