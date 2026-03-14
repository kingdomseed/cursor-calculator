export function BudgetInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="text-center">
      <p className="text-[#14120b]/60 mb-4">What&apos;s the most you want to spend per month?</p>
      <div className="inline-flex items-baseline gap-1">
        <span className="text-2xl font-medium text-[#14120b]/40">$</span>
        <input
          type="text"
          value={value.toLocaleString()}
          onChange={(e) => {
            const val = parseInt(e.target.value.replace(/,/g, ""), 10);
            onChange(isNaN(val) ? 0 : val);
          }}
          className="w-48 sm:w-56 text-6xl sm:text-7xl md:text-8xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-center p-0"
        />
      </div>
      {value >= 0 && value < 20 && (
        <p className="text-sm text-red-500 mt-2">Minimum budget is $20 (Pro plan subscription)</p>
      )}
      <div className="mt-6 px-4">
        <input
          type="range" min="20" max="500" step="10" value={Math.max(20, Math.min(500, value))}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
        />
        <div className="flex justify-between text-xs text-[#14120b]/40 mt-2">
          <span>$20</span><span>$200</span><span>$500</span>
        </div>
      </div>
    </div>
  );
}
