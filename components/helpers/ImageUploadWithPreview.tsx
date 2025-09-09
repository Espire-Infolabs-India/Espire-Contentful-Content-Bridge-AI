import React from "react";

interface ImageUploadWithPreviewProps {
  value: any;
  groupKey: string;
  fieldKey: string;
  fieldIndex: number;
  onUpload: (
    file: File,
    groupKey: string,
    fieldIndex: number,
    fieldKey: string
  ) => void;
  onOpenPicker: (
    groupKey: string,
    fieldIndex: number,
    fieldKey: string
  ) => void;
}

export default function ImageUploadWithPreview({
  value,
  groupKey,
  fieldKey,
  fieldIndex,
  onUpload,
  onOpenPicker,
}: ImageUploadWithPreviewProps) {
  return (
    <>
      {/* Preview */}
      {value?._preview?.url ? (
        <>
          <img
            src={
              value?._preview?.url ?? (value?.url ? `https:${value.url}` : "")
            }
            alt={value?._preview?.title || value?.title || fieldKey}
            className="max-w-xs rounded shadow mb-2"
          />
          <p className="text-xs text-gray-400">
            {value._preview.title || "Image selected"}
          </p>
        </>
      ) : (
        <div className="text-sm text-gray-500 italic mb-2">
          No image selected
        </div>
      )}

      {/* File Input */}
      <input
        type="file"
        name={`${groupKey}.${fieldKey}`}
        accept="image/*"
        className="form-input mt-2"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUpload(e.target.files[0], groupKey, fieldIndex, fieldKey);
          }
        }}
      />

      {/* Contentful Picker Button */}
      <button
        type="button"
        name={`${groupKey}.${fieldKey}`}
        className="form-input mt-2"
        onClick={() => onOpenPicker(groupKey, fieldIndex, fieldKey)}
      >
        Select from Contentful
      </button>
    </>
  );
}
