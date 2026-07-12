export default function NotLinkedNotice({ onGoToLink }: { onGoToLink: () => void }) {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="mb-3">
        まだお子さまとの連携が完了していません。教室から受け取った招待コードで連携してください。
      </p>
      <button
        onClick={onGoToLink}
        className="rounded bg-black px-4 py-2 text-sm text-white"
      >
        お子さまと連携する
      </button>
    </div>
  );
}
