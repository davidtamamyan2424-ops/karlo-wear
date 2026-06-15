import { fileUrl } from "../api/client";
import { ru } from "../i18n/ru";

interface Props {
  imageUrl: string;
  onClose: () => void;
}

export default function SizeChartModal({ imageUrl, onClose }: Props) {
  const src = imageUrl.startsWith("http") ? imageUrl : fileUrl(imageUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ru.product.sizeChart}
    >
      <div
        className="animate-fade-in max-h-[90vh] w-full max-w-lg overflow-hidden rounded-card bg-paper shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">{ru.product.sizeChart}</h2>
          <button
            type="button"
            onClick={onClose}
            className="press rounded-button bg-surface px-3 py-1.5 text-sm font-medium text-ink"
          >
            {ru.product.close}
          </button>
        </div>
        <div className="max-h-[calc(90vh-56px)] overflow-y-auto p-2">
          <img src={src} alt={ru.product.sizeChart} className="w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
