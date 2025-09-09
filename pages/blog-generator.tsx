"use client";
import { useEffect, useRef, useState, FormEvent } from "react";
import { createContentfulEntry } from "./api/create-entry";
import { toast } from "react-toastify";
import AssetPicker from "@/components/helpers/AssetPicker";
import MultiSelectDropdown from "@/components/helpers/MultiSelectDropdown";
import ImageUploadWithPreview from "@/components/helpers/ImageUploadWithPreview";
import FieldValueEditor from "@/components/helpers/FieldValueEditor";
import ActionButtons from "@/components/helpers/PublishAndSaveButton";
import useAssetPicker from "@/components/hooks/useAssetPicker";
import GenerateContentBlock from "@/components/helpers/GenerateContentBlock";
import UploadedDetails from "@/components/helpers/UploadDetails";
import SuccessPage from "@/components/helpers/SuccessPage";
import RootFieldRenderer from "@/components/helpers/RootFieldRenderer";
import { collectFormFields } from "@/components/utils/collectDataFromFields";
import { getEntry, publishEntry, getNestedEntryIds, SPACE_ID, ENVIRONMENT }  from "@/components/utils/publishToCms";
import { appendMultiSelectValues } from "@/components/utils/appendMultiSelectValues";
import { normalizeAIResult } from "@/components/utils/normalizeAIResult";
import { appendNestedImages } from "@/components/utils/appendNestedImages";
import { flattenSchemas } from "@/components/utils/flattenSchemas";
import { prefixAndSeparateFields } from "@/components/utils/fieldSeperationRendering";
import { getFullPathFromResult } from "@/components/utils/extractFullPath";
import { uploadFileToContentful } from "@/components/utils/publishToCms";
import { handleNestedImageUpload } from "@/components/utils/nestedImageUpload";
import { NestedSchema } from "@/components/utils/nestedImageUpload";
import ContentUploader from "@/components/helpers/ImportPdforUrl";

interface Field {
  key: string;
  actual_key: string;
  value: any;
}
let allowedFields: string[] = [];
export default function HomePage() {
  const fieldsToSendRef = useRef<any[]>([]);
  const [multiSelectValues, setMultiSelectValues] = useState<
    Record<string, string[]>
  >({});
  const [patchedSchemas, setPatchedSchemas] = useState([]);
  const [showGeneratedResult, setShowGeneratedResult] = useState(false);
  const [nestedSchemas, setNestedSchemas] = useState<
    Record<string, NestedSchema>
  >({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [entryVersion, setEntryVersion] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [uploadedImageId, setUploadedImageId] = useState<string>("");
  const [template, setTemplate] = useState<string>("");
  const [url, setURL] = useState<string>("");
  const [result, setResult] = useState<any>({ allowedFields: [] });
  const [referenceFields, setReferenceFields] = useState<any>(null);
  const [fileFieldList, setFileFieldList] = useState<any>(null);
  const [contentTypeResult, setContentTypeResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const imageAssetIdRef = useRef<string | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<
    Record<string, any[]>
  >({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiModel, setAIModel] = useState<string>("");
  const [firstPage, setFirstPage] = useState(true);
  const [secondPage, setSecondPage] = useState(false);
  const [uploadedDetails, setUploadedDetails] = useState(false);
  const [sucessPage, setSucessPage] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [schema, setSchema] = useState<any[]>([]);

  const setSecond: () => void = () => {
    if (url == "" && fileName == "") {
      alert("Please choose file or enter any url for import.");
      return false;
    } else {
      setSecondPage(true);
      setFirstPage(false);
      setSucessPage(false);
      setUploads(true);
    }
  };
  const setCancel: () => void = () => {
    setURL("");
    setFileName("");
    setFileSize(0);
    setSelectedFile(null);
    setSecondPage(false);
    setFirstPage(true);
    setUploads(false);
    setSucessPage(false);
  };
const resetToNewContent = () => {
  setURL("");
  setFileName("");
  setFileSize(0);
  setSelectedFile(null);
  setSecondPage(false);
  setFirstPage(true); // go back to first page
  setShowGeneratedResult(false);
  setSucessPage(false);
  setFinalResult(null);
};

  const setUploads = (val: any): void => {
    setUploadedDetails(val);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          `${window?.location?.origin}/api/get-content-types`
        );
        if (!res.ok) throw new Error("Failed to fetch content types");
        const data = await res.json();
        setContentTypeResult(data);
      } catch (err) {}
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!generatedContent || !template) return;
    const fetchSchemaAndOptions = async () => {
      try {
        const res = await fetch(
          `${window.location.origin}/api/get-content-type-schema?template=${template}`
        );
        if (!res.ok) throw new Error("Failed to fetch schema");
        const data = await res.json();
        const schemaData = data.schema || [];
        setSchema(schemaData);
        const tripleMap: Record<string, string> = {};
        const walk = (node: any) => {
          if (!node) return;
          if (
            Array.isArray(node.dropdownContentTypes) &&
            node.dropdownContentTypes.length > 0
          ) {
            tripleMap[node.id] = node.dropdownContentTypes[0];
          }
          if (Array.isArray(node.nestedFields)) {
            for (const nf of node.nestedFields) {
              walk(nf);
            }
          }
        };

        for (const f of schemaData) {
          walk(f);
        }
        const fetched: Record<string, any[]> = {};
        await Promise.all(
          Object.entries(tripleMap).map(async ([childId, ct]) => {
            try {
              const r = await fetch(
                `/api/getReferenceFieldOptions?contentType=${encodeURIComponent(
                  ct
                )}&limit=1000`
              );
              if (!r.ok)
                throw new Error(`Failed to fetch options for ${childId}`);
              const { options } = await r.json();
              fetched[childId] = Array.isArray(options) ? options : [];
            } catch (e) {
              fetched[childId] = [];
            }
          })
        );
        setReferenceOptions((prev) => ({ ...prev, ...fetched }));
      } catch (err) {}
    };

    fetchSchemaAndOptions();
  }, [generatedContent, template]);

  const handleFileSelect = (file: File) => {
    if (url.trim()) {
      alert("You can't upload a file when a URL is provided.");
      return;
    }
    if (file.type === "application/pdf") {
      setFileName(file.name);
      setFileSize(file.size);
      setSelectedFile(file);
    } else {
      alert("Please upload a PDF file");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };
  const {
    isAssetPickerOpen,
    assetList,
    closeAssetPicker,
    openImagePicker,
    handleSelectAsset,
  } = useAssetPicker(setResult, setNestedSchemas);

  const generateContent = async (e: React.SyntheticEvent) => {
    if (!template) return alert("Please select a content type.");
    if ((!selectedFile && !url.trim()) || (selectedFile && url.trim())) {
      return alert("Please provide either a PDF file or a URL, but not both.");
    }
    setLoading(true);
    try {
      const schemaRes = await fetch(
        `${window.location.origin}/api/get-content-type-schema?template=${template}`
      );
      const schemaJson = await schemaRes.json();
      const schemaFields = schemaJson?.schema || [];
      const content_type = schemaFields.flatMap((field: any) => {
        if (
          field.type === "Array" &&
          field.items?.linkType === "Entry" &&
          Array.isArray(field.nestedFields)
        ) {
          return field.nestedFields.map((refSchema: any) => {
            const refFields = (refSchema.fields || [])
              .map((nestedField: any) => {
                return `${nestedField.id}: (${
                  nestedField.name || nestedField.id
                })`;
              })
              .join(", ");

            return {
              [`${field.id} (${refSchema.id})`]: `[ { ${refFields} } ]`,
            };
          });
        }

        if (Array.isArray(field.nestedFields)) {
          const nested = field.nestedFields
            .map((nestedField: any) => {
              return `${nestedField.id}: (${
                nestedField.name || nestedField.id
              })`;
            })
            .join(", ");
          return {
            [field.id]: `[ { ${nested} } ]`,
          };
        }
        return {
          [field.id]: `(${field.name || field.id})`,
        };
      });
      if (!Array.isArray(content_type) || content_type.length === 0) {
        alert("Content type schema is empty or invalid. Please check.");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("template", template);
      formData.append("model", aiModel);
      formData.append("content_type", JSON.stringify(schemaFields));

      if (selectedFile) {
        formData.append("pdf", selectedFile);
      } else if (typeof url === "string" && url.trim().startsWith("http")) {
        formData.append("url", url.trim());
      } else {
        alert("Please provide a valid URL starting with http or https.");
        setLoading(false);
        return;
      }
      const res = await fetch(
        `${window?.location?.origin}/api/generate-summary`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) throw new Error("Failed to generate content");
      const data = await res.json();
      const { result, nestedSchemas, contentTypeSchema } = data;

      const knownLinkTypes: Record<string, string> = {};

      if (nestedSchemas && typeof nestedSchemas === "object") {
        for (const key in nestedSchemas) {
          if (nestedSchemas[key]?.contentTypeId) {
            knownLinkTypes[key] = nestedSchemas[key].contentTypeId;
          }
        }
      }
      const patchedSchema = (contentTypeSchema || []).map((field: any) => {
        if (field.type === "Array" && !field.linkContentType) {
          const inferred = knownLinkTypes[field.id];
          if (inferred) {
            return {
              ...field,
              linkContentType: inferred,
            };
          }
        }
        return field;
      });
      setPatchedSchemas(patchedSchema);

      allowedFields = patchedSchema.map((f: any) => f.id);
      setGeneratedContent(result);
      setSchema(contentTypeSchema || []);
      setSecondPage(false);
      setFirstPage(false);

      let filteredSummary: any[] = [];

      if (Array.isArray(data?.summary) && data.summary.length > 0) {
        filteredSummary = data.summary.filter(
          (item: { actual_key: string }) =>
            item.actual_key?.toLowerCase() !== "image"
        );
      } else if (Array.isArray(data?.result)) {
        filteredSummary = data.result;
      } else if (
        data?.result &&
        typeof data.result === "object" &&
        !Array.isArray(data.result)
      ) {
        filteredSummary = Object.entries(data.result)
          .map(([key, rawValue], index) => {
            let value: any = rawValue;
            if (key.toLowerCase().includes("image")) {
              value = null;
            }
            let isErrorObject: boolean = false;

            try {
              if (typeof value === "string") {
                const maybeParsed = JSON.parse(value);
                if (
                  maybeParsed &&
                  typeof maybeParsed === "object" &&
                  !Array.isArray(maybeParsed) &&
                  "error" in maybeParsed &&
                  maybeParsed.error === "invalid_schema"
                ) {
                  isErrorObject = true;
                }
              } else if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                "error" in value &&
                (value as any).error === "invalid_schema"
              ) {
                isErrorObject = true;
              }
            } catch (e) {
              isErrorObject = false;
            }

            const isBadSchema =
              key === "content_schema" ||
              key === "dynamic_example" ||
              key.toLowerCase().includes("schema");

            if (isErrorObject || isBadSchema) {
              console.warn(
                ` [${index}] actual_key: ${key} | type of value:`,
                typeof value,
                value,
                "- **error**: Invalid schema format"
              );
              return null;
            }
            if (key.toLowerCase().includes("image")) {
              return {
                key,
                actual_key: key,
                value: undefined,
              };
            }

            return {
              key,
              actual_key: key,
              value,
            };
          })
          .filter(Boolean);
      }

      if (Array.isArray(filteredSummary) && Array.isArray(schemaFields)) {
        const fieldOrder = schemaFields.map((f: any) => f.id);
        filteredSummary.sort((a, b) => {
          const indexA = fieldOrder.indexOf(a.actual_key);
          const indexB = fieldOrder.indexOf(b.actual_key);
          return indexA - indexB;
        });
      }

      const processedSummary = filteredSummary.map((item) => {
        const { value } = item;

        let flatValue = "";

        if (typeof value === "string" || typeof value === "number") {
          flatValue = String(value);
        } else if (Array.isArray(value)) {
          flatValue = value
            .map((v) => {
              if (typeof v === "string" || typeof v === "number") return v;
              if (typeof v === "object" && v !== null) {
                if ("value" in v && typeof v.value === "object") {
                  return Object.values(v.value).join(" | ");
                }
                if ("value" in v) return v.value;
              }
              return JSON.stringify(v);
            })
            .join(", ");
        } else if (typeof value === "object" && value !== null) {
          if ("value" in value) {
            flatValue =
              typeof value.value === "object"
                ? Object.values(value.value).join(" | ")
                : value.value;
          } else {
            flatValue = JSON.stringify(value);
          }
        }

        return {
          ...item,
          value: flatValue,
        };
      });

      const groupedSummary: Record<string, any[]> = {};

      for (const item of processedSummary) {
        const keyParts = item.actual_key?.split(".");

        if (keyParts.length >= 3) {
          const parent = keyParts[keyParts.length - 2];
          const child = keyParts[keyParts.length - 1];
          if (!groupedSummary[parent]) groupedSummary[parent] = [];
          groupedSummary[parent].push({
            ...item,
            actual_key: child,
            display_name: child.replace(/([A-Z])/g, " $1").trim(),
            parent_name: parent.replace(/([A-Z])/g, " $1").trim(),
          });
        } else {
          if (!groupedSummary["_root"]) groupedSummary["_root"] = [];

          groupedSummary["_root"].push({
            ...item,
            display_name: item.actual_key.replace(/([A-Z])/g, " $1").trim(),
            parent_name: "_root",
          });
        }
      }

      setResult(groupedSummary);
      setShowGeneratedResult(true);
      setReferenceFields(data?.referenceFields || []);
      setFileFieldList(data?.fileFieldList || []);

      if (data.nestedSchemas && typeof data.nestedSchemas === "object") {
        const cleanedNestedSchemas: any = {};

        for (const [key, schema] of Object.entries(data.nestedSchemas)) {
          if (!schema || typeof schema !== "object" || !("entries" in schema)) {
            console.warn(` Skipping invalid schema for key "${key}"`, schema);
            cleanedNestedSchemas[key] = schema;
            continue;
          }

          const entries = Array.isArray((schema as any).entries)
            ? (schema as any).entries
            : [];
          const cleanedEntries = entries.map((entry: any) => {
            if (!entry || typeof entry !== "object") return entry;
            const fields = Array.isArray(entry.fields) ? entry.fields : [];
            const cleanedFields = fields.map((field: any) => {
              if (
                field &&
                typeof field === "object" &&
                typeof field.actual_key === "string" &&
                field.actual_key.toLowerCase().includes("image")
              ) {
                console.warn(
                  ` Removing AI-generated value for nested image field "${field.actual_key}"`
                );
                return {
                  ...field,
                  value: undefined,
                };
              }
              return field;
            });

            return {
              ...entry,
              fields: cleanedFields,
            };
          });

          cleanedNestedSchemas[key] = {
            ...schema,
            entries: cleanedEntries,
          };
        }

        setNestedSchemas(cleanedNestedSchemas);
      }
    } catch (err) {
      setFirstPage(true);
      console.error(err);
      alert("Error generating content.");
    } finally {
      setLoading(false);
    }
  };
const publishToCMS = async () => {
  if (!entryId) return alert("No draft entry found to publish.");

  try {
    setLoading(true);

    // Get main entry
    const entryData = await getEntry(entryId);
    const latestVersion = entryData.sys.version;

    // Publish nested entries first
    const nestedIds = getNestedEntryIds(entryData);
    for (const id of nestedIds) {
      try {
        const nestedData = await getEntry(id);
        await publishEntry(id, nestedData.sys.version);
      } catch (err) {
        console.warn(`Failed to publish nested entry ${id}`, err);
      }
    }

    // Publish main entry
    await publishEntry(entryId, latestVersion);

    // ✅ Build Contentful entry URL
    const entryUrl = `https://app.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}/entries/${entryId}`;

    // ✅ Show Success Page
    setFinalResult({
      entry: {
        title: entryData.fields?.title?.["en-US"] || "Untitled Entry",
        url: entryUrl,
        summary: "Entry published successfully!",
      },
    });

    setFirstPage(false);
    setSecondPage(false);
    setShowGeneratedResult(false);
    setSucessPage(true); // <--- this will render your SuccessPage

  } catch (err) {
    console.error(err);
    alert("Failed to publish entry.");
  } finally {
    setLoading(false);
  }
};


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    const input = e.target as HTMLInputElement;
    const inputId = input.id.replace("_file", "").replace("_input", "");
    const file = e.target.files?.[0];

    if (file) {
      const assetId = await handleFileUpload(file);
      if (inputId === "image" && assetId) {
        imageAssetIdRef.current = assetId;
        setUploadedImageId(assetId);
      } else if (inputId === "image" && !assetId) {
      }
    }
    setLoading(false);
  };
  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      return await uploadFileToContentful(file);
    } finally {
      setLoading(false);
    }
  };
  const onNestedImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    schemaKey: string,
    entryIndex: number,
    fieldKey: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleNestedImageUpload({
      file,
      schemaKey,
      entryIndex,
      fieldKey,
      nestedSchemas,
      setNestedSchemas,
      fieldsToSendRef,
      handleFileUpload,
    }).catch((err) => console.error("Nested image upload failed", err));
  };

  const handleSubmit = async (
    publish: boolean,
    contentTypeSchemas: any[],
    contentTypeId: string
  ) => {
    try {
      setLoading(true);
      let fieldsToSend: Field[] = collectFormFields();
      appendMultiSelectValues(
        fieldsToSend,
        multiSelectValues,
        result,
        getFullPathFromResult
      );
      normalizeAIResult(result, fieldsToSend, allowedFields);
      appendNestedImages(fieldsToSend, uploadedImageId, nestedSchemas);
      const allSchemaObjects = flattenSchemas(contentTypeSchemas);
      const { remainingParentFields, childEntriesToCreate, childToParents } =
        prefixAndSeparateFields(fieldsToSend, allSchemaObjects);
      const childIdMap: Record<string, string> = {};
      for (const [childType, childFields] of Object.entries(
        childEntriesToCreate
      )) {
        const childEntry = await createContentfulEntry(
          childFields,
          childType,
          publish,
          allSchemaObjects
        );
        if (!childEntry?.sys?.id)
          throw new Error(`Failed to create child entry: ${childType}`);
        childIdMap[childType] = childEntry.sys.id;
      }
      for (const [childType, childId] of Object.entries(childIdMap)) {
        const parentFields = childToParents.get(childType) || [];
        for (const parentFieldId of parentFields) {
          remainingParentFields.push({
            key: parentFieldId,
            actual_key: parentFieldId,
            value: { sys: { type: "Link", linkType: "Entry", id: childId } },
          });
        }
      }
      const entry = await createContentfulEntry(
        remainingParentFields,
        contentTypeId,
        publish,
        allSchemaObjects,
        {},
        multiSelectValues
      );
      if (!entry?.sys?.id || !entry?.sys?.version) {
        throw new Error("Entry creation failed or invalid response.");
      }
      setEntryId(entry.sys.id);
      setEntryVersion(entry.sys.version);

      if (publish) {
        toast.success("Entry successfully published to Contentful!");
      } else {
        toast.info("Entry saved as draft in Contentful.");
      }
    } catch (err: unknown) {
      console.error("handleSubmit error:", err);
      toast.error("One or more uploads failed.");
    } finally {
      setLoading(false);
    }
  };
  if (Array.isArray(result)) {
    result.forEach((item, i) => {
      console.log(
        ` [${i}] actual_key: ${item?.actual_key} | type of value:`,
        typeof item?.value,
        item?.value
      );
    });
  } else result && typeof result === "object";

  {
    result && typeof result === "object" ? (
      <div className="grid gap-2">
        {Object.entries(result).map(([key, value]) => (
          <div key={key}>
            <strong>{key}:</strong>{" "}
            {Array.isArray(value) ? (
              <ul className="list-disc list-inside">
                {value.map((v, i) => (
                  <li key={i}>
                    {v && typeof v === "object" ? (
                      <pre className="bg-gray-100 p-2 rounded">
                        {JSON.stringify(v, null, 2)}
                      </pre>
                    ) : (
                      String(v)
                    )}
                  </li>
                ))}
              </ul>
            ) : value && typeof value === "object" ? (
              <pre className="bg-gray-100 p-2 rounded">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              <span>{String(value)}</span>
            )}
          </div>
        ))}
      </div>
    ) : (
      <p> No result received or result is not a valid object.</p>
    );
  }
  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .replace(
        /\w\S*/g,
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .trim();
  };
  const hasTripleNestedChild = (fieldKey: string, schema: any[]): boolean => {
    if (!Array.isArray(schema)) return false;

    for (const field of schema) {
      if (field.id === fieldKey || field.actual_key === fieldKey) {
        if (Array.isArray(field.nestedFields)) {
          const hasTripleNested = field.nestedFields.some(
            (child: any) => child.isTripleNested && child._depth === 3
          );
          return hasTripleNested;
        }
        return false;
      }
      if (Array.isArray(field.nestedFields)) {
        if (hasTripleNestedChild(fieldKey, field.nestedFields)) {
          return true;
        }
      }
    }
    return false;
  };

  const hasTripleNestedChildInList = (fields: any[]): boolean =>
    fields.some(
      (child: any) =>
        (child.isTripleNested && child._depth === 3) ||
        (Array.isArray(child.nestedFields) &&
          hasTripleNestedChildInList(child.nestedFields))
    );

  const renderResult = () => {
    if (!result) {
      console.warn(" No result found.");
      return null;
    }

    let json: any = result;
    try {
      if (typeof json === "string") {
        json = JSON.parse(json);
      }
    } catch (err) {
      console.warn(" result is invalid JSON string:", result);
      return (
        <div className="alert alert-warning">
          Invalid result format: not valid JSON.
        </div>
      );
    }
    if (json?.result && typeof json.result === "object") {
      json = json.result;
    }

    if (typeof json === "object" && !Array.isArray(json)) {
      json = Object.entries(json)
        .filter(([key]) => isNaN(Number(key)))
        .map(([key, value]) => ({
          actual_key: key,
          key,
          value,
        }));
    }
    if (!Array.isArray(json)) {
      return (
        <div className="alert alert-warning">
          Invalid result: expected array after processing.
        </div>
      );
    }

    return (
      <div className="genrate-content">
        {isAssetPickerOpen && (
          <AssetPicker
            assets={assetList}
            onClose={closeAssetPicker} //
            onSelect={handleSelectAsset}
          />
        )}

        <form encType="multipart/form-data" method="post">
          {/* Grouped render */}
          {Object.entries(result || {}).map(([groupKey, fields]) => {
            if (!Array.isArray(fields) || fields.length === 0) return null;
            {
              groupKey === "_root" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {fields.map((item: any, index: number) => (
                    <RootFieldRenderer
                      key={item.actual_key || index}
                      field={item}
                      handleFileChange={handleFileChange}
                      openImagePicker={openImagePicker}
                    />
                  ))}
                </div>
              );
            }
            return (
              <div key={groupKey} className="nested-schema-block mb-8">
                <div className="bg-gray-100 border-l-4 border-blue-500 p-2 mb-4">
                  <h3 className="text-lg font-semibold capitalize text-blue-800">
                    {groupKey.replace(/([A-Z])/g, " $1")}
                  </h3>
                </div>

                <div className="flex flex-col gap-4">
                  {fields.map((field, fieldIndex) => {
                    const fieldKey = field.actual_key;
                    const schemaEntries: any[] =
                      (nestedSchemas as any)?.[groupKey]?.entries ?? [];
                    const entry =
                      schemaEntries[fieldIndex] ??
                      schemaEntries.find((e: any) =>
                        e.fields?.some((f: any) => f.actual_key === fieldKey)
                      ) ??
                      {};

                    const updatedField =
                      entry.fields?.find(
                        (f: any) => f.actual_key === fieldKey
                      ) ?? field;
                    const fieldValue = updatedField.value;
                    const selected = multiSelectValues[fieldKey] || [];
                    const tripleNested = hasTripleNestedChild(fieldKey, schema);
                    const dropdownOptions =
                      tripleNested && referenceOptions?.[fieldKey]
                        ? referenceOptions[fieldKey]
                        : tripleNested
                        ? []
                        : [];
                    return (
                      <div
                        key={`${groupKey}-${fieldKey}-${fieldIndex}`}
                        className="bg-white border p-4 rounded shadow"
                      >
                        <label className="block font-medium mb-1">
                          {formatLabel(fieldKey)}
                        </label>

                        {tripleNested ? (
                          <MultiSelectDropdown
                            options={
                              Array.isArray(dropdownOptions)
                                ? dropdownOptions.map((opt: any) => ({
                                    value:
                                      opt.value ??
                                      opt.id ??
                                      opt.sys?.id ??
                                      String(opt),
                                    label:
                                      opt.label ??
                                      opt.title ??
                                      opt.name ??
                                      String(opt),
                                  }))
                                : []
                            }
                            selected={selected}
                            onChange={(newSelected) =>
                              setMultiSelectValues((prev) => ({
                                ...prev,
                                [fieldKey]: newSelected,
                              }))
                            }
                          />
                        ) : fieldKey.toLowerCase().includes("image") ? (
                          <ImageUploadWithPreview
                            value={fieldValue}
                            groupKey={groupKey}
                            fieldKey={fieldKey}
                            fieldIndex={fieldIndex}
                            onUpload={(file) => {
                              onNestedImageChange(
                                { target: { files: [file] } } as any,
                                groupKey,
                                fieldIndex,
                                fieldKey
                              );
                              toast.success(`Image selected: ${file.name}`);
                            }}
                            onOpenPicker={openImagePicker}
                          />
                        ) : (
                          <FieldValueEditor
                            fieldKey={fieldKey}
                            groupKey={groupKey}
                            fieldValue={fieldValue}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="my-2">
            {fileFieldList?.map((item: any, index: number) => (
              <div
                key={index}
                className="mb-4 bg-white border-[var(--border-color)] border-[1px] p-4 rounded-lg"
              >
                <label className="mb-2 pl-2">
                  <strong>
                    {item?.displayName} <span className="req">(Required)</span>
                  </strong>
                </label>
                <input
                  type="file"
                  className="form-control form-file-input"
                  id={`${item?.actual_key}_input`}
                  name={item?.actual_key}
                  onChange={handleFileChange}
                />
                <input
                  type="hidden"
                  className="input_file_field form-textarea"
                  name={item?.actual_key}
                  id={`${item?.actual_key}_input_file`}
                />
              </div>
            ))}
          </div>

          <ActionButtons
            saving={saving}
            publishing={publishing}
            loading={loading}
            result={result}
            onSave={async () => {
              setSaving(true);
              await handleSubmit(false, patchedSchemas, template);
              setSaving(false);
            }}
            onPublish={async () => {
              setPublishing(true);
              await publishToCMS();
              setPublishing(false);
            }}
          />
        </form>
      </div>
    );
  };

  return (
    <div className="container py-3">
      {firstPage && (
        <ContentUploader
          aiModel={aiModel}
          setAIModel={setAIModel}
          selectedFile={selectedFile}
          url={url}
          handleFileSelect={handleFileSelect}
          handleDrop={handleDrop}
          setURL={setURL}
          onCancel={setCancel}
          onImport={setSecond}
          firstPageVisible={firstPage}
        />
      )}
      <UploadedDetails
        fileName={selectedFile?.name}
        fileSize={
          selectedFile ? Math.round(selectedFile.size / 1024) : undefined
        }
        url={url}
      />
      {secondPage && (
        <GenerateContentBlock
          template={template}
          setTemplate={setTemplate}
          contentTypes={contentTypeResult?.content_types || []}
          selectedFile={selectedFile}
          url={url}
          loading={loading}
          onGenerate={generateContent}
          onCancel={setCancel}
        />
      )}
      {showGeneratedResult && renderResult()}
      {sucessPage && (
        <SuccessPage
          title={finalResult?.entry?.title || ""}
          url={finalResult?.entry?.url || ""}
          summary={finalResult?.entry?.summary || ""}
          onNewContent={resetToNewContent}
        />
      )}
    </div>
  );
}
