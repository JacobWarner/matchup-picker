import type { MatchupResult, Champion } from "../types";

interface Props {
  result: MatchupResult;
  rank: number;
  totalResults: number;
  allChampions: Champion[];
}

export default function ResultCard({
  result,
  rank,
  totalResults,
  allChampions,
}: Props) {
  const isBest = rank === 1;
  const isWorst = rank === totalResults && totalResults > 1;
  const icon = allChampions.find((c) => c.id === result.championId)?.image;

  const cardClass = isBest
    ? "result-card result-card-best"
    : isWorst
      ? "result-card result-card-worst"
      : "result-card";

  function formatGd(gd: number | null): string {
    if (gd === null) return "—";
    return gd > 0 ? `+${gd}` : `${gd}`;
  }

  function formatGames(g: number | null): string {
    if (g === null) return "—";
    if (g >= 1000) return `${(g / 1000).toFixed(1)}k`;
    return `${g}`;
  }

  return (
    <div className={cardClass}>
      <div className="result-left">
        <div className={`result-rank ${isBest ? "result-rank-best" : ""}`}>
          #{rank}
        </div>
        {icon && <img src={icon} alt={result.champion} className="result-icon" />}
        <div>
          <div className="result-name">{result.champion}</div>
          {isBest && <div className="result-label-best">BEST PICK</div>}
          {isWorst && <div className="result-label-worst">WORST PICK</div>}
          {result.confidence === "low" && (
            <div className="result-label-low">LOW DATA</div>
          )}
        </div>
      </div>
      <div className="result-stats">
        <div className="result-stat">
          <div
            className={`result-stat-value ${
              result.winRate !== null && result.winRate >= 50
                ? "stat-green"
                : "stat-red"
            }`}
          >
            {result.winRate !== null ? `${result.winRate}%` : "—"}
          </div>
          <div className="result-stat-label">WIN RATE</div>
        </div>
        <div className="result-stat">
          <div
            className={`result-stat-value ${
              result.goldDiff15 !== null && result.goldDiff15 >= 0
                ? "stat-blue"
                : "stat-red"
            }`}
          >
            {formatGd(result.goldDiff15)}
          </div>
          <div className="result-stat-label">GD@15</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value">
            {formatGames(result.gamesPlayed)}
          </div>
          <div className="result-stat-label">GAMES</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value stat-gold">
            {result.tier ?? "—"}
          </div>
          <div className="result-stat-label">TIER</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value">
            {result.pickRate !== null ? `${result.pickRate}%` : "—"}
          </div>
          <div className="result-stat-label">PICK RATE</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value">
            {result.banRate !== null ? `${result.banRate}%` : "—"}
          </div>
          <div className="result-stat-label">BAN RATE</div>
        </div>
      </div>
    </div>
  );
}
