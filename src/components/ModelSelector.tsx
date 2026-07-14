import { useState, useRef } from 'react';
import type { Model } from '../lib/types';
import { PROVIDER_COLORS } from '../lib/constants';
import { getCurrentBaseRates, isPoolUsagePromotionActive, isRatePromotionActive } from '../domain/recommendation/rates';

interface Props {
  options: Model[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  labelledBy?: string;
}

export function ModelSelector({ options, selected, onChange, placeholder, labelledBy }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const selectedSet = new Set(selected);
  const selectedModels = options.filter((m) => selectedSet.has(m.id));
  const unselectedModels = options.filter((m) => !selectedSet.has(m.id));

  const query = search.toLowerCase();
  const filteredSelected = query
    ? selectedModels.filter((m) => m.name.toLowerCase().includes(query) || m.provider.toLowerCase().includes(query))
    : selectedModels;
  const filteredUnselected = query
    ? unselectedModels.filter((m) => (
        m.name.toLowerCase().includes(query)
        || m.provider.toLowerCase().includes(query)
        || (m.pool === 'first_party' ? 'first-party models pool' : 'api pool').includes(query)
      ))
    : unselectedModels;
  const unselectedSections = [
    {
      key: 'first_party',
      label: 'First-party models pool',
      models: filteredUnselected.filter((model) => model.pool === 'first_party'),
    },
    {
      key: 'api',
      label: 'API pool',
      models: filteredUnselected.filter((model) => model.pool === 'api'),
    },
  ].filter((section) => section.models.length > 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className="w-full bg-white border border-[#e0e0d8] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[#14120b]/30 transition-colors cursor-pointer"
        aria-expanded={isOpen}
        aria-labelledby={labelledBy}
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
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close model selector"
            className="fixed inset-0 z-10 cursor-default bg-transparent"
            onClick={closeDropdown}
          />
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
                      type="button"
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
              {unselectedSections.map((section) => (
                <div key={section.key} className="p-2">
                  <p className="text-xs font-medium text-[#14120b]/40 px-3 py-1 uppercase tracking-wide">
                    {section.label}
                  </p>
                  {section.models.map((model) => {
                    const rates = getCurrentBaseRates(model);

                    return (
                      <button
                        type="button"
                        key={model.id}
                        onClick={() => { onChange([...selected, model.id]); setSearch(''); }}
                        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[#f7f7f4] rounded-lg text-left"
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-[#14120b]/40 ml-2">${rates.input}/${rates.output} per M</span>
                          {isRatePromotionActive(model) && model.rate_promotion && (
                            <span className="block text-xs text-emerald-700">{model.rate_promotion.label}</span>
                          )}
                          {model.availability_note && (
                            <span className="block text-xs text-amber-700">{model.availability_note}</span>
                          )}
                          {model.usage_note && (
                            <span className="block text-xs text-[#14120b]/45">{model.usage_note}</span>
                          )}
                          {isPoolUsagePromotionActive(model) && model.pool_usage_promotion && (
                            <span className="block text-xs text-emerald-700">
                              {model.pool_usage_promotion.label}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
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
