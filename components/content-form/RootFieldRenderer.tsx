interface RootFieldRendererProps {
  field: any;
  handleFileChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    key: string
  ) => void;
  openImagePicker: (fieldKey: string, index: number, key: string) => void;
}

const RootFieldRenderer: React.FC<RootFieldRendererProps> = ({
  field,
  handleFileChange,
  openImagePicker,
}) => {
  const actualKey = field.actual_key;
  const isFile =
    field.type === "File" ||
    field.actual_type === "File" ||
    field.key?.toLowerCase().includes("image");

  return (
    <div
      key={actualKey}
      className="mb-4 bg-white border-[var(--border-color)] border-[1px] p-4 rounded-lg"
    >
      <div className="label-bar mb-2 flex justify-between items-center">
        <label htmlFor={actualKey} className="pl-2 font-semibold">
          {field.key} <span className="req">(Required)</span>
        </label>
      </div>

      {isFile ? (
        <>
          {field?.value?.url ? (
            <>
              <img
                src={field.value.url}
                alt={field.value.title || actualKey}
                className="max-w-xs rounded shadow mb-2"
              />
              <p className="text-xs text-gray-400">
                {field.value.title || "Image selected"}
              </p>
            </>
          ) : (
            <div className="text-sm text-gray-500 italic">
              No image selected
            </div>
          )}

          <input
            type="file"
            id={`${actualKey}_input`}
            name={actualKey}
            accept="image/*"
            className="form-control mt-2"
            onChange={(e) => handleFileChange(e, actualKey)}
          />

          <button
            type="button"
            className="form-input mt-2"
            onClick={() => openImagePicker(actualKey, -1, actualKey)}
          >
            Select from Contentful
          </button>
        </>
      ) : (
        <textarea
          className="form-control form-textarea"
          id={actualKey}
          name={actualKey}
          defaultValue={
            typeof field.value === "object"
              ? JSON.stringify(field.value, null, 2)
              : field.value || ""
          }
          rows={Math.min(
            10,
            typeof field.value === "string"
              ? field.value.split("\n").length + 1
              : 4
          )}
          style={{ whiteSpace: "pre-wrap" }}
        />
      )}
    </div>
  );
};

export default RootFieldRenderer;
