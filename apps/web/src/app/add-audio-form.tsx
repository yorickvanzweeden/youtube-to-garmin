"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function AddAudioForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [profile, setProfile] = useState("music-128");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
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
    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  if (!open)
    return (
      <button
        className="primary-button"
        type="button"
        onClick={() => setOpen(true)}
      >
        <span>＋</span> Add audio
      </button>
    );
  return (
    <form className="add-audio-form" onSubmit={submit}>
      <label htmlFor="youtube-url">YouTube URL</label>
      <div className="add-audio-fields">
        <input
          id="youtube-url"
          type="url"
          required
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <select
          aria-label="Audio profile"
          value={profile}
          onChange={(event) => setProfile(event.target.value)}
        >
          <option value="music-128">Music · 128 kbps</option>
          <option value="speech-96">Speech · 96 kbps</option>
        </select>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </button>
        <button
          className="cancel-button"
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
