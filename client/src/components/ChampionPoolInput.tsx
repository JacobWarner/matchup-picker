import { useState, useRef, useEffect } from "react";
import type { Champion } from "../types";
import { searchChampions } from "../champions";

interface Props {
  pool: Champion[];
  allChampions: Champion[];
  onAdd: (champion: Champion) => void;
  onRemove: (championId: string) => void;
}

export default function ChampionPoolInput({
  pool,
  allChampions,
  onAdd,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results = searchChampions(allChampions, query).filter(
    (c) => !pool.some((p) => p.id === c.id)
  );

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
    if (pool.length >= 5) return;
    onAdd(champ);
    setQuery("");
    setShowDropdown(false);
  }

  return (
    <div className="pool-input">
      <label className="label">Your Champion Pool</label>
      <div className="pool-tags">
        {pool.map((c) => (
          <span key={c.id} className="pool-tag">
            <img src={c.image} alt={c.name} className="pool-tag-icon" />
            {c.name}
            <button
              className="pool-tag-remove"
              onClick={() => onRemove(c.id)}
            >
              ×
            </button>
          </span>
        ))}
        {pool.length < 5 && (
          <div className="pool-add-wrapper">
            <input
              ref={inputRef}
              className="pool-add-input"
              placeholder="+ Add Champion"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => query && setShowDropdown(true)}
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
        )}
      </div>
    </div>
  );
}
