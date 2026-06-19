interface Props {
  title?: string;
}

export default function LoadingState({
  title = "Memproses prediksi..."
}: Props) {
  return (
    <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-10 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" />

        <div>
          <p className="text-base font-semibold text-teal-700 mb-1">
            {title}
          </p>

          <p className="text-sm text-teal-500">
            Mohon tunggu, jangan tutup halaman ini
          </p>
        </div>
      </div>
    </div>
  );
}