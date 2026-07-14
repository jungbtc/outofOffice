export interface TextStatistics {
  words: number;
  characters: number;
}

/** Counts already-extracted plain text in one pass without allocating a word array. */
export function textStatistics(text: string): TextStatistics {
  let words = 0;
  let inWord = false;
  let firstNonWhitespace = -1;
  let lastNonWhitespace = -1;

  for (let index = 0; index < text.length; index += 1) {
    const whitespace = /\s/u.test(text[index] ?? "");
    if (!whitespace) {
      if (!inWord) words += 1;
      inWord = true;
      if (firstNonWhitespace < 0) firstNonWhitespace = index;
      lastNonWhitespace = index;
    } else {
      inWord = false;
    }
  }

  return {
    words,
    characters: firstNonWhitespace < 0 ? 0 : lastNonWhitespace - firstNonWhitespace + 1,
  };
}
