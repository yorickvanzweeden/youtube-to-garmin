import { describe, expect, it } from "vitest";

import { mediaCreateSchema } from "./media";

describe("mediaCreateSchema", () => {
  it("accepts YouTube URLs and defaults to music", () => {
    expect(
      mediaCreateSchema.parse({ url: "https://www.youtube.com/watch?v=abc" }),
    ).toEqual({
      url: "https://www.youtube.com/watch?v=abc",
      profile: "music-128",
    });
  });

  it("accepts youtu.be URLs and speech profile", () => {
    expect(
      mediaCreateSchema.parse({
        url: "https://youtu.be/abc",
        profile: "speech-96",
      }).profile,
    ).toBe("speech-96");
  });

  it("rejects lookalike domains", () => {
    expect(() =>
      mediaCreateSchema.parse({ url: "https://youtube.com.example.com/video" }),
    ).toThrow();
  });
});
