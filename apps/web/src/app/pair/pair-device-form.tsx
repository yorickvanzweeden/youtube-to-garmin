"use client";

import { type FormEvent, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function PairDeviceForm() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const response = await fetch("/api/garmin/pair/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Pairing failed");
      setMessage("Watch paired. You can return to the dashboard.");
      setCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pairing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pair-form" onSubmit={submit}>
      <label htmlFor="pairing-code">Pairing code</label>
      <Input
        id="pairing-code"
        name="code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="482931"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        required
      />
      <Button type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Pairing…" : "Pair device"}
      </Button>
      {message ? <output>{message}</output> : null}
    </form>
  );
}
