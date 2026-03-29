import { LANES, LANE_LABELS, type Lane } from "../types";

interface Props {
  selected: Lane;
  onChange: (lane: Lane) => void;
}

export default function LaneSelector({ selected, onChange }: Props) {
  return (
    <div className="lane-selector">
      <label className="label">Lane</label>
      <div className="lane-buttons">
        {LANES.map((lane) => (
          <button
            key={lane}
            className={`lane-btn ${selected === lane ? "lane-btn-active" : ""}`}
            onClick={() => onChange(lane)}
          >
            {LANE_LABELS[lane]}
          </button>
        ))}
      </div>
    </div>
  );
}
