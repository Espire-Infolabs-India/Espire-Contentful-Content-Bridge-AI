import React, { useRef } from "react";
import Settings from "@/components/Settings";

interface ContentUploaderProps {
  aiModel: string;
  setAIModel: (model: string) => void;
  selectedFile: File | null;
  url: string;
  setURL: (url: string) => void;
  handleFileSelect: (file: File) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  firstPageVisible: boolean;
  onCancel: () => void;
  onImport: () => void;
}

const ContentUploader: React.FC<ContentUploaderProps> = ({
  aiModel,
  setAIModel,
  selectedFile,
  url,
  setURL,
  handleFileSelect,
  handleDrop,
  firstPageVisible,
  onCancel,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!firstPageVisible) return null;

  return (
    <div
      className="text-center mb-5"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="flex justify-between w-full items-center">
        <h1 className="flex items-center">Espire CMS Co-pilot</h1>
      </div>

      <div className="bg-white border-[var(--border-color)] border-t-[1px] border-l-[1px] border-r-[1px] pb-4 rounded-t-lg">
        <div className="topicon flex justify-center py-4">
          <svg
            width="68"
            height="64"
            viewBox="0 0 68 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* SVG paths unchanged */}
          </svg>
          <Settings model={aiModel} setAIModel={setAIModel} />
        </div>

        <div className="flex justify-center flex-col md:flex-row py-2">
          <div className="drag-box w-1/2 text-right pr-6">
            Drag & drop or
            <mark className="text-[var(--blue-color)] bg-transparent">
              <button
                className="bg-transparent"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!url.trim()}
              >
                Choose File
              </button>
              <input
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={(e) =>
                  e.target.files?.[0] && handleFileSelect(e.target.files[0])
                }
              />
              {selectedFile && (
                <p className="mt-2 text-muted">
                  Selected file: {selectedFile.name}
                </p>
              )}
            </mark>{" "}
            to upload <br />
            <span>Supported formats: PDF, DOCX, TXT</span>
          </div>

          <div className="or-divider flex justify-center items-center flex-col">
            <span>or</span>
          </div>

          <div className="import-box w-1/2 text-left pl-6">
            <label htmlFor="url" className="form-label">
              Import from URL
            </label>
            <input
              type="url"
              id="url"
              className="form-control url-input"
              placeholder="Paste URL here"
              value={url}
              disabled={!!selectedFile}
              onChange={(e) => setURL(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white flex justify-end border-[var(--border-color)] p-4 rounded-b-lg">
        <button className="primary-button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button active" onClick={onImport}>
          Import
        </button>
      </div>
    </div>
  );
};

export default ContentUploader;
