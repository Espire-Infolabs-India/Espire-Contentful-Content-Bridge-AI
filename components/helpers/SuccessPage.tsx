import React from "react";

interface SuccessPageProps {
  title: string;
  url: string; // Contentful entry link
  summary: string;
  onNewContent: () => void;
}

const SuccessPage: React.FC<SuccessPageProps> = ({
  title,
  url,
  summary,
  onNewContent,
}) => {
  return (
    <div className="new-page max-w-xl mx-auto mt-6">
      <div className="bg-white flex items-center justify-between space-x-4 border-[var(--border-color)] border p-4 rounded-t-lg">
        <h2 className="text-lg font-semibold text-green-700">Entry Published - {title}</h2>
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          type="button"
          onClick={onNewContent}
        >
          New Content
        </button>
      </div>
      <div className="bg-white p-4 border-[var(--border-color)] border rounded-b-lg">
        <p className="mb-4">
          URL:{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Open in Contentful
          </a>
        </p>
        <p className="mb-4">Summary: {summary}</p>
      </div>
    </div>
  );
};

export default SuccessPage;
