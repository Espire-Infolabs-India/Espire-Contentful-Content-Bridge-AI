// components/GenerateContentBlock.tsx
import React from "react";

interface GenerateContentBlockProps {
  template: string;
  setTemplate: (value: string) => void;
  contentTypes: { uid: string; title: string; options: any }[];
  selectedFile: File | null;
  url: string;
  loading: boolean;
  onGenerate: (e: React.SyntheticEvent) => void;
  onCancel: () => void;
}

const GenerateContentBlock: React.FC<GenerateContentBlockProps> = ({
  template,
  setTemplate,
  contentTypes,
  selectedFile,
  url,
  loading,
  onGenerate,
  onCancel,
}) => {
  return (
    <div className="mb-5">
      <div className="bg-white content-box">
        <div className="p-4 border-[var(--border-color)] border-l-[1px] border-r-[1px]">
          <label htmlFor="contentTypeSelect" className="block mb-2 font-medium">
            Choose a Content Type
          </label>
          <select
            id="contentTypeSelect"
            className="w-full border px-3 py-2 rounded"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="">-- Select a Content Type --</option>
            {contentTypes?.map(
              (field) =>
                field.options.is_page && (
                  <option key={field.uid} value={field.uid}>
                    {field.title}
                  </option>
                )
            )}
          </select>
        </div>
      </div>

      <div className="bg-white flex justify-content-end border-[1px] p-4 rounded-b-lg">
        <button className="primary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="bg-[var(--blue-color)] primary-button active flex space-x-4"
          disabled={!template || (!selectedFile && !url.trim()) || loading}
          onClick={onGenerate}
          type="button"
        >
          {loading ? (
            "Generating..."
          ) : (
            <>
              <svg
                width="21"
                height="20"
                viewBox="0 0 21 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12.6492 18.2645H6.27425M11.75 6.19402L1.25 16.694M18.5 12.2645V16.7645M20.75 14.5145H16.25M14.93 9.37477C15.7538 8.52615 16.2106 7.38752 16.2018 6.20488C16.193 5.02224 15.7193 3.89053 14.883 3.05425C14.0467 2.21797 12.915 1.74427 11.7324 1.73548C10.5497 1.72669 9.41112 2.18351 8.5625 3.00727L3.5 8.06977V14.4448H9.875L14.93 9.37477Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              Generate Content
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default GenerateContentBlock;
