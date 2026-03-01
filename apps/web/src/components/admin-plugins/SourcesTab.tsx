import { useState } from "react";
import { cls } from "./types";
import { usePluginSources, useAddSource, useRemoveSource, useToggleSource } from "./hooks";

export function SourcesTab() {
  const { data: sources, isLoading } = usePluginSources();
  const addMut = useAddSource();
  const removeMut = useRemoveSource();
  const toggleMut = useToggleSource();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    addMut.mutate(
      { name: name.trim(), url: url.trim() },
      {
        onSuccess: () => {
          setName("");
          setUrl("");
          setShowForm(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className={cls.spinner}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source list */}
      {(!sources || sources.length === 0) && !showForm && (
        <p className={cls.empty}>Aucune source configuree</p>
      )}

      {sources && sources.length > 0 && (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s.id} className={cls.row}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/40">
                    {s.pluginCount} plugin{s.pluginCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/40 truncate">{s.url}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => toggleMut.mutate(s.id)}
                  disabled={toggleMut.isPending}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    s.enabled ? "bg-purple-600" : "bg-white/10"
                  }`}
                  title={s.enabled ? "Desactiver" : "Activer"}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      s.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                {/* Remove */}
                <button
                  onClick={() => {
                    if (confirm(`Supprimer la source "${s.name}" ?`)) {
                      removeMut.mutate(s.id);
                    }
                  }}
                  disabled={removeMut.isPending}
                  className={cls.bd}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add source form */}
      {showForm ? (
        <div className={cls.card}>
          <h3 className="mb-3 text-sm font-semibold text-white">Ajouter une source</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={cls.lbl}>Nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ma source"
                className={cls.inp}
              />
            </div>
            <div>
              <label className={cls.lbl}>URL du registre</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://registry.example.com/plugins.json"
                className={cls.inp}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addMut.isPending || !name.trim() || !url.trim()}
              className={cls.bp}
            >
              {addMut.isPending ? "..." : "Ajouter"}
            </button>
            <button onClick={() => setShowForm(false)} className={cls.bs}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className={cls.bp}>
          Ajouter une source
        </button>
      )}
    </div>
  );
}
