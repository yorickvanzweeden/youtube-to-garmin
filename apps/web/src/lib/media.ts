import { z } from "zod";

export const mediaCreateSchema = z.object({
  url: z.url().refine((value) => {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host.endsWith(".youtube.com")
    );
  }, "Only YouTube URLs are supported"),
  profile: z.enum(["music-128", "speech-96"]).default("music-128"),
});

export type MediaStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

export type MediaRecord = {
  id: string;
  title?: string;
  source: { type: "youtube"; url: string };
  profile: "music-128" | "speech-96";
  status: MediaStatus;
  syncToGarmin: boolean;
  activeJobId: string;
  createdAt: string;
  updatedAt: string;
};
