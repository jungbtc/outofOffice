export interface TextStatistics {
  words: number;
  characters: number;
}

export function textStatistics(html: string): TextStatistics {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return { words: text ? text.split(" ").length : 0, characters: text.length };
}
