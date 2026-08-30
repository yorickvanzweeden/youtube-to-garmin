"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../components/ui/button";

export function DeleteMediaButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Remove “${title}” from your library?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label={`Delete ${title}`}
    >
      {busy ? "…" : "Delete"}
    </Button>
  );
}
