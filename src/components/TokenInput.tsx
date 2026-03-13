export function TokenInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="text-center">
      <p className="text-[#14120b]/60 mb-4">How many tokens will you use this month?</p>
      <div className="inline-flex items-baseline gap-2">
        <input
          type="text"
          value={value.toLocaleString()}
          onChange={(e) => {
            const val = parseInt(e.target.value.replace(/,/g, ""), 10);
            onChange(isNaN(val) ? 0 : val);
          }}
          className="w-72 sm:w-96 md:w-[28rem] text-4xl sm:text-5xl md:text-6xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-center p-0 overflow-visible"
        />
        <span className="text-lg sm:text-xl text-[#14120b]/40">tokens</span>
      </div>
      {value >= 1_000 && (
        <p className="text-lg text-[#14120b]/50 mt-2 font-medium">
          {value >= 1_000_000_000
            ? `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 2)} billion`
            : value >= 1_000_000
            ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2)} million`
            : `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`}
        </p>
      )}
      <div className="mt-6 px-4">
        <input
          type="range" min="100000" max="1000000000" step="100000"
          value={Math.min(value, 1_000_000_000)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
        />
        <div className="flex justify-between text-xs text-[#14120b]/40 mt-2">
          <span>100k</span><span>500M</span><span>1B</span>
        </div>
      </div>
    </div>
  );
}
