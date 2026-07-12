export default function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-lg font-bold">{title}</h1>
      <button onClick={onBack} className="text-sm text-gray-500 hover:underline">
        ホームへ
      </button>
    </div>
  );
}
