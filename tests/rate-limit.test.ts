import { describe, expect, it } from "vitest";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

describe("isRateLimited", () => {
  it("allows up to the limit then blocks further requests in the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key)).toBe(false);
    }
    expect(isRateLimited(key)).toBe(true);
  });

  it("tracks each key independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) isRateLimited(a);
    expect(isRateLimited(a)).toBe(true);
    expect(isRateLimited(b)).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers the first entry of x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
