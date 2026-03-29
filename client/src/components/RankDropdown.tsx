import { RANKS } from "../types";

interface Props {
  selected: string;
  onChange: (rank: string) => void;
}

export default function RankDropdown({ selected, onChange }: Props) {
  return (
    <div className="rank-dropdown">
      <label className="label">Rank</label>
      <select
        className="rank-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {RANKS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
