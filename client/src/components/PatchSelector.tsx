interface Props {
  patches: string[];
  selected: string;
  onChange: (patch: string) => void;
}

export default function PatchSelector({ patches, selected, onChange }: Props) {
  return (
    <div className="patch-selector">
      <label className="label">Patch</label>
      <select
        className="rank-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {patches.map((p) => (
          <option key={p} value={p}>
            {p.replace("_", ".")}
          </option>
        ))}
      </select>
    </div>
  );
}
