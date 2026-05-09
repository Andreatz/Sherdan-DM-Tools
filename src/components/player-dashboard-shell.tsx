"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

interface AccessStatus {
  configured: boolean;
  authenticated: boolean;
}

interface PlayerCampaign {
  id: string;
  name: string;
  updatedAt: string | null;
}

interface PlayerEntity {
  id: string;
  campaignId: string;
  type: string;
  name: string;
  description: string;
  parentId: string | null;
  visibility: "public" | "discovered";
  updatedAt: string | null;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

const fallbackMessage = "Operazione non riuscita.";

export function PlayerDashboardShell() {
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [code, setCode] = useState("");
  const [campaigns, setCampaigns] = useState<PlayerCampaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [entities, setEntities] = useState<PlayerEntity[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [entityLoading, setEntityLoading] = useState(false);

  const canLoadEntities = useMemo(
    () => Boolean(status?.authenticated && campaignId.trim()),
    [campaignId, status?.authenticated],
  );

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (status?.authenticated) void loadCampaigns();
  }, [status?.authenticated]);

  async function refreshStatus() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/player/access/status", { cache: "no-store" });
      const data = (await res.json()) as AccessStatus;
      setStatus(data);
    } catch {
      setMessage("Impossibile leggere lo stato dell'accesso player.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/player/access/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error(await readApiError(res));

      setCode("");
      setMessage("Accesso player attivo.");
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/player/access/logout", { method: "POST" });
      if (!res.ok) throw new Error(await readApiError(res));
      setCampaigns([]);
      setCampaignId("");
      setEntities([]);
      setMessage("Accesso player chiuso.");
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setLoading(false);
    }
  }

  async function loadCampaigns() {
    setCampaignLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/player/campaigns", { cache: "no-store" });
      if (!res.ok) throw new Error(await readApiError(res));

      const data = (await res.json()) as PlayerCampaign[];
      setCampaigns(data);
      setCampaignId((current) => current || data[0]?.id || "");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setCampaignLoading(false);
    }
  }

  async function loadEntities(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!campaignId.trim()) {
      setMessage("Seleziona una campagna prima di caricare la dashboard.");
      return;
    }

    setEntityLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ campaign_id: campaignId.trim(), limit: "50" });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/player/entities?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await readApiError(res));

      const data = (await res.json()) as PlayerEntity[];
      setEntities(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setEntityLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Player Dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Portale giocatori
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Prima shell player-facing: accesso protetto, nessuna lore raw, nessun campo GM-only.
          I dati arrivano solo da <code>/api/player/*</code>.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Accesso
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Stato: {status ? renderStatus(status) : "lettura in corso..."}
            </p>
          </div>
          {status?.authenticated && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loading}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Esci
            </button>
          )}
        </div>

        {!status?.configured && status && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Accesso player non configurato. Imposta <code>SHERDAN_PLAYER_ACCESS_CODE</code> lato server.
          </div>
        )}

        {status?.configured && !status.authenticated && (
          <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Codice accesso giocatori"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              Entra
            </button>
          </form>
        )}
      </section>

      {status?.authenticated && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Entità conosciute
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Seleziona una campagna. La lista mostra solo entità public/discovered.
          </p>

          <form onSubmit={(event) => void loadEntities(event)} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <select
              value={campaignId}
              onChange={(event) => {
                setCampaignId(event.target.value);
                setEntities([]);
              }}
              disabled={campaignLoading || campaigns.length === 0}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {campaigns.length === 0 ? (
                <option value="">Nessuna campagna disponibile</option>
              ) : (
                campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))
              )}
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca per nome o descrizione pubblica"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={!canLoadEntities || entityLoading}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              Carica
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {entities.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nessuna entità caricata.
              </p>
            ) : (
              entities.map((entity) => (
                <article
                  key={entity.id}
                  className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">
                      {entity.name}
                    </h3>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {entity.type}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {entity.visibility}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {entity.description || "Nessuna descrizione pubblica disponibile."}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {message && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {message}
        </div>
      )}
    </div>
  );
}

function renderStatus(status: AccessStatus): string {
  if (!status.configured) return "non configurato";
  return status.authenticated ? "autenticato" : "richiede codice";
}

async function readApiError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as ApiErrorPayload;
    return payload.error?.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
