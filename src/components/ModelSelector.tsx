import { useState, useRef, useEffect } from 'react';
import type { Model } from '../lib/types';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  options: Model[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}

export function ModelSelector({ options, selected, onChange, placeholder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay so the dropdown renders before focus
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  function closeDropdown() {
    setIsOpen(false);
    setSearch('');
  }

  function toggleDropdown() {
    if (isOpen) {
      closeDropdown();
      return;
    }

    setIsOpen(true);
  }

  const selectedModels = options.filter((m) => selected.includes(m.id));
  const unselectedModels = options.filter((m) => !selected.includes(m.id));

  const query = search.toLowerCase();
  const filteredSelected = query
    ? selectedModels.filter((m) => m.name.toLowerCase().includes(query) || m.provider.toLowerCase().includes(query))
    : selectedModels;
  const filteredUnselected = query
    ? unselectedModels.filter((m) => m.name.toLowerCase().includes(query) || m.provider.toLowerCase().includes(query))
    : unselectedModels;

  return (
    <div className="relative">
      <div
        onClick={toggleDropdown}
        className="w-full bg-white border border-[#e0e0d8] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[#14120b]/30 transition-colors cursor-pointer"
      >
        <div className="flex flex-wrap gap-2">
          {selectedModels.length === 0 ? (
            <span className="text-[#14120b]/40">{placeholder}</span>
          ) : (
            selectedModels.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 bg-[#f7f7f4] rounded-full px-3 py-1 text-sm">
                <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[m.provider] || "bg-gray-400"}`} />
                <span className="font-medium">{m.name}</span>
              </span>
            ))
          )}
        </div>
        <svg className={`w-5 h-5 text-[#14120b]/40 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeDropdown} />
          <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-[#e0e0d8] rounded-xl shadow-lg max-h-80 flex flex-col">
            <div className="p-2 border-b border-[#e0e0d8]">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f7f7f4] border border-[#e0e0d8] outline-none focus:border-[#14120b]/30"
              />
            </div>
            <div className="overflow-auto">
              {filteredSelected.length > 0 && (
                <div className="p-2">
                  <p className="text-xs font-medium text-[#14120b]/40 px-3 py-1 uppercase tracking-wide">Selected</p>
                  {filteredSelected.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => onChange(selected.filter((id) => id !== model.id))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-lg text-left"
                    >
                      <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                      <span className="font-medium">{model.name}</span>
                      <span className="ml-auto text-red-500 text-sm">Remove</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredSelected.length > 0 && filteredUnselected.length > 0 && <div className="border-t border-[#e0e0d8]" />}
              {filteredUnselected.length > 0 && (
                <div className="p-2">
                  {filteredUnselected.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { onChange([...selected, model.id]); setSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f7f7f4] rounded-lg text-left"
                    >
                      <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                      <div className="flex-1">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-[#14120b]/40 ml-2">${model.rates.input}/${model.rates.output} per M</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {filteredSelected.length === 0 && filteredUnselected.length === 0 && (
                <p className="p-4 text-sm text-[#14120b]/40 text-center">No models match "{search}"</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
