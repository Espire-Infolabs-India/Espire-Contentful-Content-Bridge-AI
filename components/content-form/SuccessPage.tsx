import React from "react";

interface SuccessPageProps {
  title: string;
  url: string;
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
    <div className="new-page">
      <div className="bg-white flex items-center space-x-4 border-[var(--border-color)] border-t-[1px] rounded-t-lg border-l-[1px] border-r-[1px] border-b-[1px] p-4">
        <h2>New Page - {title}</h2>
        <button className="primary-button" type="button" onClick={onNewContent}>
          New Content
        </button>
      </div>
      <div className="bg-white p-4 border-[var(--border-color)] border-l-[1px] border-b-[1px] border-r-[1px] rounded-b-lg">
        <p className="mb-4">Url : {url}</p>
        <p className="mb-4">Summary: {summary}</p>
      </div>
    </div>
  );
};

export default SuccessPage;
