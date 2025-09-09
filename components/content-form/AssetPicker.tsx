import React from "react";

interface Asset {
  id: string;
  title: string;
  url: string;
}

interface AssetPickerProps {
  assets?: any[];
  onClose: () => void;
  onSelect: (asset: Asset) => void;
}

export default function AssetPicker({
  assets = [],
  onClose,
  onSelect,
}: AssetPickerProps) {
  const normalizeAsset = (asset: any, index: number): Asset | null => {
    if (!asset || typeof asset !== "object") return null;

    const assetId = asset?.id || asset?.sys?.id || `asset-${index}`;
    const assetTitle =
      asset?.title ||
      asset?.fields?.title?.["en-US"] ||
      asset?.fields?.title ||
      "Untitled";

    const assetUrl =
      asset?.url ||
      (asset?.fields?.file?.url && `https:${asset.fields.file.url}`) ||
      (asset?.fields?.file?.["en-US"]?.url &&
        `https:${asset.fields.file["en-US"].url}`);

    if (!assetUrl) return null;

    return { id: assetId, title: assetTitle, url: assetUrl };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {/* Outer container with max height and scroll */}
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4">Select Asset</h2>

        {/* Scrollable asset grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto pr-2 flex-grow">
          {assets
            .map(normalizeAsset)
            .filter(Boolean)
            .map((asset, idx) => (
              <div
                key={asset!.id}
                className="border p-2 rounded hover:shadow cursor-pointer"
                onClick={() => onSelect(asset!)}
              >
                <img
                  src={asset!.url}
                  alt={asset!.title}
                  className="w-full h-32 object-cover rounded"
                />
                <p className="text-sm mt-1 truncate text-center">
                  {asset!.title}
                </p>
              </div>
            ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
