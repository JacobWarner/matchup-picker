export function parseWinRate(text: string): number | null {
  const match = text.match(/([\d.]+)%/);
  return match ? parseFloat(match[1]) : null;
}

export function parseGames(text: string): number | null {
  const match = text.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : null;
}

export function parseGoldDiff(text: string): number | null {
  const match = text.match(/([+-]?\d+)\s*GD/i);
  return match ? parseInt(match[1], 10) : null;
}
