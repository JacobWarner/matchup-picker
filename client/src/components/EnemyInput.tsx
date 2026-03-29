import { useState, useRef, useEffect } from "react";
import type { Champion } from "../types";
import { searchChampions } from "../champions";

interface Props {
  allChampions: Champion[];
  onSubmit: (champion: Champion) => void;
  loading: boolean;
}

export default function EnemyInput({ allChampions, onSubmit, loading }: Props) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<Champion | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results = searchChampions(allChampions, query);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(champ: Champion) {
    setSelected(champ);
    setQuery(champ.name);
    setShowDropdown(false);
  }

  function handleSubmit() {
    if (selected) {
      onSubmit(selected);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && selected) {
      handleSubmit();
    }
  }

  return (
    <div className="enemy-input">
      <label className="label">Enemy Champion</label>
      <div className="enemy-row">
        <div className="enemy-search-wrapper">
          <input
            ref={inputRef}
            className="enemy-search"
            placeholder="Search champion..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setShowDropdown(true);
            }}
            onFocus={() => query && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
          />
          {showDropdown && results.length > 0 && (
            <div ref={dropdownRef} className="pool-dropdown">
              {results.map((c) => (
                <button
                  key={c.id}
                  className="pool-dropdown-item"
                  onClick={() => handleSelect(c)}
                >
                  <img src={c.image} alt={c.name} className="pool-tag-icon" />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="find-btn"
          onClick={handleSubmit}
          disabled={!selected || loading}
        >
          {loading ? "Loading..." : "Find Best Pick"}
        </button>
      </div>
    </div>
  );
}
