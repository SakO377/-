import Link from "next/link";

export default function PageHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-lg font-bold">{title}</h1>
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ホームへ
      </Link>
    </div>
  );
}
