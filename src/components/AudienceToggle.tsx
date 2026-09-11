import type { Audience } from '../domain/catalog/types';

interface Props {
  audience: Audience;
  onChange: (audience: Audience) => void;
}

const SWITCH_ID = 'teams-enterprise-audience';

export function AudienceToggle({ audience, onChange }: Props) {
  const checked = audience === 'teams_enterprise';

  return (
    <section className="p-4 bg-white rounded-xl border border-[#e0e0d8]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor={SWITCH_ID} className="text-sm font-semibold text-[#14120b]">
            Teams / Enterprise
          </label>
          <p id={`${SWITCH_ID}-description`} className="mt-1 text-xs text-[#14120b]/55">
            Unchecked compares personal plans and personal included-usage rules.
            Checked filters to Teams and Enterprise, keeps Cursor Models included,
            and adds the $0.25/M Cursor Token Rate on third-party Other Models.
          </p>
        </div>
        <input
          id={SWITCH_ID}
          type="checkbox"
          checked={checked}
          aria-describedby={`${SWITCH_ID}-description`}
          onChange={(event) => onChange(event.target.checked ? 'teams_enterprise' : 'personal')}
          className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-[#b9b9ad] text-[#14120b] accent-[#14120b] focus:ring-2 focus:ring-[#14120b] focus:ring-offset-2"
        />
      </div>
    </section>
  );
}
