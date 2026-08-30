"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

export function AddAudioForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [profile, setProfile] = useState("music-128");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, profile }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.error ?? "Could not add this video");
        setSaving(false);
        return;
      }
      setUrl("");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="add-audio-form" onSubmit={submit} aria-label="Add audio">
      <div className="add-audio-heading">
        <div className="add-audio-icon">＋</div>
        <div>
          <h3>Add audio from YouTube</h3>
          <p>Paste a link and we’ll prepare it for your Garmin.</p>
        </div>
      </div>
      <label htmlFor="youtube-url">YouTube video URL</label>
      <div className="add-audio-fields">
        <Input
          id="youtube-url"
          type="url"
          required
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Select
          aria-label="Audio profile"
          value={profile}
          onChange={(event) => setProfile(event.target.value)}
        >
          <option value="music-128">Music · 128 kbps</option>
          <option value="speech-96">Speech · 96 kbps</option>
        </Select>
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
