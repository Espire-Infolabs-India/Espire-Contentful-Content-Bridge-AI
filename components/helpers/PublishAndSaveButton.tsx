import React from "react";

interface ActionButtonsProps {
  saving: boolean;
  publishing: boolean;
  loading: boolean;
  result: any;
  onSave: () => Promise<void>;
  onPublish: () => Promise<void>;
}

export default function ActionButtons({
  saving,
  publishing,
  loading,
  result,
  onSave,
  onPublish,
}: ActionButtonsProps) {
  return (
    <div className="mb-4 flex justify-end bg-white border-[var(--border-color)] border-[1px] p-4 rounded-lg relative">
      {(saving || publishing) && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 rounded-lg">
          <div className="loader"></div>
        </div>
      )}

      {/* Save Button */}
      <button
        type="button"
        className="primary-button"
        onClick={onSave}
        disabled={saving || publishing}
      >
        <svg
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Keep your original Save button SVG */}
        </svg>
        {saving ? "Saving..." : "Save"}
      </button>

      {/* Publish Button */}
      <button
        className="primary-button active"
        onClick={onPublish}
        disabled={!result || saving || publishing || loading}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Keep your original Publish button SVG */}
        </svg>
        {publishing ? "Publishing..." : "Publish to CMS"}
      </button>
    </div>
  );
}
