export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public field?: string,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError("Ni povezave s strežnikom. Preveri internet in poskusi znova.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      err?.message ?? `Strežnik je vrnil napako ${res.status}. Poskusi znova čez trenutek.`,
      res.status,
      err?.code,
      err?.field,
    );
  }
  return data as T;
}

// Browser storage can be unavailable (private mode, blocked site data), so every call is guarded.
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const caseKeyStorageKey = (id: string) => `kjk:key:${id}`;

/** Shares through the system sheet when available, otherwise copies the link. */
export async function shareLink(data: { title: string; text: string; url: string }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
