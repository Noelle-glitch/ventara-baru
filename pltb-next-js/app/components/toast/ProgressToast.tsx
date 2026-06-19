interface ProgressToastProps {
  visible: boolean;
  percent: number;
  status: string;
  eta: string;
  elapsed: string;
}

export default function ProgressToast({
  visible,
  percent,
  status,
  eta,
  elapsed,
}: ProgressToastProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-white border border-teal-200 shadow-2xl rounded-2xl p-4 transition-all duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-teal-700">
            Generating Forecast
          </h3>

          <p className="text-xs text-gray-500">
            AI Forecast Progress
          </p>
        </div>

        <span className="text-xs font-semibold text-teal-600">
          {percent}%
        </span>
      </div>

      {/* BAR */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
          }}
        />
      </div>

      {/* STATUS */}
      <p className="text-sm text-gray-700 font-medium">
        {status}
      </p>

      {/* ETA */}
      <p className="text-xs text-gray-500 mt-1">
        ETA {eta} • Elapsed {elapsed}
      </p>
    </div>
  );
}