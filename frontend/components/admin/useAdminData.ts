"use client";

import { createElement, useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";

export function useAdminData<T>(path: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    return clientApi<T>(path, {}, true)
      .then(setData)
      .catch((error: unknown) => {
        setError(error instanceof Error ? error.message : "Request failed");
      })
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}

export function AdminLoading() {
  return createElement("div", { className: "admin-card" }, "Loading…");
}

export function AdminError({ message }: { message: string }) {
  return createElement(
    "div",
    { className: "admin-card", style: { color: "#b91c1c" } },
    message.replace(/_/g, " "),
  );
}
