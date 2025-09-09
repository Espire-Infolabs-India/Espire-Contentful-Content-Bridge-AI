import { useState } from "react";

interface TargetField {
  key: string;
  entryIndex: number;
  fieldKey: string;
}

export default function useAssetPicker(
  setResult: React.Dispatch<any>,
  setNestedSchemas: React.Dispatch<any>
) {
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [assetList, setAssetList] = useState<any[]>([]);
  const [targetField, setTargetField] = useState<TargetField | null>(null);

  const openImagePicker = async (
    key: string,
    entryIndex: number,
    fieldKey: string
  ) => {
    const response = await fetch("/api/fetchAssets");
    if (!response.ok) throw new Error("Failed to fetch assets");

    const assets = await response.json();
    setAssetList(assets);
    setTargetField({ key, entryIndex, fieldKey });
    setIsAssetPickerOpen(true);
  };

  const handleSelectAsset = (asset: {
    id: string;
    title: string;
    url: string;
  }) => {
    if (!targetField) return;

    const { key: parentKey, entryIndex, fieldKey } = targetField;
    if (!parentKey) return;

    const newValue = {
      sys: { id: asset.id, linkType: "Asset", type: "Link" },
      _preview: { url: asset.url, title: asset.title },
    };

    // Update main result state
    setResult((prevResult: any) => {
      const updated = Array.isArray(prevResult) ? [...prevResult] : [];
      const schemaIndex = updated.findIndex(
        (item) => item.actual_key === parentKey
      );
      if (schemaIndex === -1) return prevResult;

      const schema = updated[schemaIndex];
      const schemaEntries = Array.isArray(schema.entries)
        ? [...schema.entries]
        : [];

      while (schemaEntries.length <= entryIndex)
        schemaEntries.push({ fields: [] });

      const entry = schemaEntries[entryIndex];
      if (!Array.isArray(entry.fields)) entry.fields = [];

      const fieldIdx = entry.fields.findIndex(
        (f: any) => f.actual_key === fieldKey
      );
      if (fieldIdx === -1)
        entry.fields.push({ actual_key: fieldKey, value: newValue });
      else entry.fields[fieldIdx].value = newValue;

      schemaEntries[entryIndex] = entry;
      updated[schemaIndex] = { ...schema, entries: schemaEntries };
      return updated;
    });

    // Update nestedSchemas
    setNestedSchemas((prevSchemas: any) => {
      const updatedSchemas = { ...prevSchemas };
      if (!updatedSchemas[parentKey])
        updatedSchemas[parentKey] = { entries: [] };

      const schema = updatedSchemas[parentKey];
      if (!Array.isArray(schema.entries)) schema.entries = [];

      while (schema.entries.length <= entryIndex)
        schema.entries.push({ fields: [] });

      const entry = schema.entries[entryIndex];
      if (!Array.isArray(entry.fields)) entry.fields = [];

      const fieldIdx = entry.fields.findIndex(
        (f: any) => f.actual_key === fieldKey
      );
      if (fieldIdx === -1)
        entry.fields.push({ actual_key: fieldKey, value: newValue });
      else entry.fields[fieldIdx].value = newValue;

      schema.entries[entryIndex] = entry;
      updatedSchemas[parentKey] = schema;
      return updatedSchemas;
    });

    setIsAssetPickerOpen(false);
  };

  // ✅ New function to close the picker from outside
  const closeAssetPicker = () => setIsAssetPickerOpen(false);

  return {
    isAssetPickerOpen,
    assetList,
    targetField,
    openImagePicker,
    handleSelectAsset,
    closeAssetPicker,
  };
}
