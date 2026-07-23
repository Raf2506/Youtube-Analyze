import { describe, expect, it } from "vitest";
import { extractVideoId } from "@/lib/youtube-url";

describe("extractVideoId", () => {
  it("parses a standard watch URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("parses a watch URL with extra query params", () => {
    expect(
      extractVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLxxx",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses a youtu.be link", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("parses a youtu.be link with ?si=", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc123")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("parses a /shorts/ URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses an /embed/ URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses an m.youtube.com URL", () => {
    expect(
      extractVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses a bare 11-character ID", () => {
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses URLs without a protocol", () => {
    expect(extractVideoId("youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("rejects invalid inputs", () => {
    expect(extractVideoId("")).toBeNull();
    expect(extractVideoId("not a url at all")).toBeNull();
    expect(extractVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractVideoId("too-short")).toBeNull();
    expect(extractVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(
      extractVideoId("https://www.youtube.com/channel/UC1234567890"),
    ).toBeNull();
    expect(extractVideoId("   ")).toBeNull();
  });
});
