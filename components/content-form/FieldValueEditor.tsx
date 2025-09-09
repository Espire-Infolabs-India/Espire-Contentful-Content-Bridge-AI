import React from "react";

interface FieldValueEditorProps {
  fieldKey: string;
  groupKey: string;
  fieldValue: any;
}

export default function FieldValueEditor({
  fieldKey,
  groupKey,
  fieldValue,
}: FieldValueEditorProps) {
  if (typeof fieldValue === "object" && fieldValue?.url && fieldValue?.title) {
    return (
      <a
        href={fieldValue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline"
      >
        {fieldValue.title}
      </a>
    );
  }

  return (
    <textarea
      className="form-control form-textarea"
      name={`${groupKey}.${fieldKey}`}
      defaultValue={
        typeof fieldValue === "object"
          ? JSON.stringify(fieldValue, null, 2)
          : fieldValue || ""
      }
      rows={Math.min(
        10,
        typeof fieldValue === "string" ? fieldValue.split("\n").length + 1 : 4
      )}
    />
  );
}
