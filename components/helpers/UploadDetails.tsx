// components/UploadedDetails.tsx
import React from "react";

interface UploadedDetailsProps {
  fileName?: string;
  fileSize?: number;
  url?: string;
}

const UploadedDetails: React.FC<UploadedDetailsProps> = ({
  fileName,
  fileSize,
  url,
}) => {
  if (!fileName && !url) return null;

  return (
    <div className="bg-white border-[var(--border-color)] border-[1px] p-4 flex items-center justify-between mb-4 rounded-lg">
      <span className="w-1/2 flex items-center">
        {fileName && (
          <>
            {/* File SVG icon */}
            <svg
              width="100"
              height="100"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* ...your SVG paths here... */}
            </svg>
            <h3>{fileName}</h3>
          </>
        )}

        {url && (
          <>
            {/* URL SVG icon */}
            <svg
              width="100"
              height="100"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* ...your SVG paths here... */}
            </svg>
            <h3>{url}</h3>
          </>
        )}
      </span>

      {fileName && fileSize && (
        <span className="w-1/2 flex items-center justify-end">
          {fileSize} KB
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="ml-4"
          >
            {/* check icon */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M19.8442 6.65567C19.9439 6.75548 20 6.89077 20 7.03184C20 7.1729 19.9439 7.30819 19.8442 7.408L9.89657 17.3443C9.79665 17.444 9.66121 17.5 9.51999 17.5C9.37877 17.5 9.24332 17.444 9.1434 17.3443L4.16961 12.3762C4.11725 12.3274 4.07526 12.2687 4.04613 12.2034C4.01701 12.1381 4.00135 12.0676 4.00008 11.9961C3.99882 11.9246 4.01198 11.8536 4.03879 11.7874C4.06559 11.7211 4.10548 11.6609 4.15608 11.6103C4.20669 11.5598 4.26697 11.5199 4.33332 11.4932C4.39968 11.4664 4.47075 11.4532 4.54231 11.4545C4.61386 11.4558 4.68443 11.4714 4.7498 11.5005C4.81517 11.5296 4.874 11.5715 4.92279 11.6238L9.51999 16.2158L19.091 6.65567C19.1909 6.55599 19.3263 6.5 19.4676 6.5C19.6088 6.5 19.7442 6.55599 19.8442 6.65567Z"
              fill="#198754"
              stroke="#198754"
              strokeWidth="2"
            />
          </svg>
        </span>
      )}
    </div>
  );
};

export default UploadedDetails;
