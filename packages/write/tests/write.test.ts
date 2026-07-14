import { describe, expect, it } from "vitest";
import { textStatistics } from "../src";

describe("text statistics", () => {
  it("counts plain English and Korean text without building a word array", () => {
    expect(textStatistics("  Hello local world  ")).toEqual({ words: 3, characters: 17 });
    expect(textStatistics("안녕하세요 세계")).toEqual({ words: 2, characters: 8 });
  });

  it("handles empty text", () => {
    expect(textStatistics(" \n\t ")).toEqual({ words: 0, characters: 0 });
  });
});
