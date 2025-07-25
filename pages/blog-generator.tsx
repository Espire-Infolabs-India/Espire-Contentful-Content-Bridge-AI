"use client";
import { useEffect, useRef, useState, FormEvent } from "react";
import axios from "axios";
import { createContentfulEntry } from "./api/create-entry";
import Settings from "@/components/Settings";

interface Field {
  key: string;
  actual_key: string;
  value: any;
}

export default function HomePage() {
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [assetList, setAssetList] = useState([]);
  const [targetField, setTargetField] = useState<{
    key: string;
    entryIndex: number;
    fieldKey: string;
  } | null>(null);
const [patchedSchemas, setPatchedSchemas] = useState([]);
  const [contentTypeSchemas, setContentTypeSchemas] = useState<any[]>([]);
  const [schemas, setSchemas] = useState<any>(null);
  const [showGeneratedResult, setShowGeneratedResult] = useState(false);
  const [nestedSchemas, setNestedSchemas] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [entryVersion, setEntryVersion] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [uploadedImageId, setUploadedImageId] = useState<string>("");
  const [template, setTemplate] = useState<string>("author");
  const [url, setURL] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<boolean>(false);
  const [result, setResult] = useState<any>({ allowedFields: [] });
  const [referenceFields, setReferenceFields] = useState<any>(null);
  const [fileFieldList, setFileFieldList] = useState<any>(null);
  const [contentTypeResult, setContentTypeResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const imageAssetIdRef = useRef<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState("");
  const [aiModel, setAIModel] = useState<string>("gemini-2.0-flash");
  const [firstPage, setFirstPage] = useState(true);
  const [secondPage, setSecondPage] = useState(false);
  const [uploadedDetails, setUploadedDetails] = useState(false);
  const [sucessPage, setSucessPage] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [isModalOpen, setModalOpen] = useState(false);
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
    const setSuccess: () => void = () => {
    setURL('');
    setFileName('');
    setFileSize(0);
    setSelectedFile(null);
    setSecondPage(false);
    setFirstPage(false);
    setUploads(false);
    setSucessPage(true);
  };

  const setUploads = (val: any): void => {
    setUploadedDetails(val);
  };

  const getAIModel = (e: React.SyntheticEvent) => {
    setAIModel((e.target as HTMLInputElement).value);
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
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    async function loadAuthors() {
      try {
        const res = await fetch("/api/fetch-authors");
        if (!res.ok) throw new Error("Failed to fetch authors");
        const data = await res.json();
        setAuthors(data);
      } catch (error) {
        console.error("Error loading authors:", error);
      }
    }
    fetchData();
    loadAuthors();
  }, []);

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
  const showRegeneratePromptPopup = (id: any) => {
    setModalOpen(true);
  };
  const regeneratePrompt = async (id: any, value: any) => {
    let res = await fetch(
      `${baseUrl}/api/regenerate-prompt?id=${id}&value=${value}&model=${aiModel}`
    );
    if (!res.ok) {
      return alert(
        "We encountered an issue while processing your request via the AI API. Kindly try again"
      );
    }

    let data = await res.json();
    let inputEl = document.getElementById(`${id}`) as HTMLInputElement;
    inputEl.value = data?.title;

    let inputElMessage = document.getElementById(
      `${id}_message`
    ) as HTMLInputElement;
    inputElMessage.innerHTML = "Regenerated Value has been updated.";
    inputElMessage.classList.remove("hidden");
    setTimeout(() => {
      inputElMessage.classList.add("hidden");
    }, 4000);
  };

  const regeneratePromptWithText = async (id: any, value: any) => {
    let res = await fetch(
      `${baseUrl}/api/regenerate-prompt?id=${id}&value=${value}&model=${aiModel}`
    );
    if (!res.ok) {
      return alert(
        "We encountered an issue while processing your request via the AI API. Kindly try again"
      );
    }

    let data = await res.json();
    let inputEl = document.getElementById(`${id}`) as HTMLInputElement;
    inputEl.value = data?.title;

    let inputElMessage = document.getElementById(
      `${id}_message`
    ) as HTMLInputElement;
    inputElMessage.innerHTML = "Regenerated Value has been updated.";
    inputElMessage.classList.remove("hidden");
    setTimeout(() => {
      inputElMessage.classList.add("hidden");
    }, 4000);
  };
  //  Opens the asset picker modal and sets the target field
  const openImagePicker = async (
    key: string,
    entryIndex: number,
    fieldKey: string
  ) => {
    try {
      console.log("📸 Opening image picker for:", {
        key,
        entryIndex,
        fieldKey,
      });

      const response = await fetch("/api/fetchAssets");
      if (!response.ok) throw new Error("Failed to fetch assets");

      const assets = await response.json();
      setAssetList(assets);
      setTargetField({ key, entryIndex, fieldKey });
      setIsAssetPickerOpen(true);
    } catch (error) {
      console.error("Error fetching Contentful assets:", error);
    }
  };

  const handleSelectAsset = (asset: {
    id: string;
    title: string;
    url: string;
  }) => {
    if (!targetField) {
      return;
    }

    const { key: parentKey, entryIndex, fieldKey } = targetField;
    if (!parentKey || typeof parentKey !== "string") {
      return;
    }

    if (entryIndex === -1) {
      // Handle root-level image field
      setResult((prevResult: any) => ({
        ...prevResult,
        [parentKey]: {
          id: asset.id,
          title: asset.title,
          url: asset.url,
        },
      }));
      setIsAssetPickerOpen(false);
      alert(`Selected: ${asset.title}`);
      return;
    }
    // Update result (main form)
    setResult((prevResult: any) => {
      const updated = Array.isArray(prevResult) ? [...prevResult] : [];

      const schemaIndex = updated.findIndex(
        (item) => item.actual_key === parentKey
      );
      if (schemaIndex === -1) {
        return prevResult;
      }

      const schema = updated[schemaIndex];
      const schemaEntries = Array.isArray(schema.entries)
        ? [...schema.entries]
        : [];

      const entry = schemaEntries[entryIndex];
      if (!entry) {
        return prevResult;
      }
      const updatedFields = Array.isArray(entry.fields)
        ? [...entry.fields]
        : [];
      const fieldIdx = updatedFields.findIndex(
        (f) => f.actual_key === fieldKey
      );
      if (fieldIdx === -1) {
        return prevResult;
      }

      updatedFields[fieldIdx] = {
        ...updatedFields[fieldIdx],
        value: {
          id: asset.id,
          title: asset.title,
          url: asset.url,
        },
      };

      const updatedEntry = { ...entry, fields: updatedFields };
      schemaEntries[entryIndex] = updatedEntry;
      updated[schemaIndex] = { ...schema, entries: schemaEntries };
      return updated;
    });
    //  Also update nestedSchemas
    setNestedSchemas((prevSchemas: any) => {
      if (
        !prevSchemas ||
        typeof prevSchemas !== "object" ||
        !(parentKey in prevSchemas)
      ) {
        return prevSchemas;
      }
      const schema = prevSchemas[parentKey];
      if (!schema) return prevSchemas;
      const updatedSchema = { ...schema };
      const updatedEntries = Array.isArray(updatedSchema.entries)
        ? [...updatedSchema.entries]
        : [];
      const entry = updatedEntries[entryIndex];
      if (!entry) {
        console.warn(
          entryIndex
        );
        return prevSchemas;
      }
      const updatedFields = Array.isArray(entry.fields)
        ? [...entry.fields]
        : [];
      const fieldIdx = updatedFields.findIndex(
        (f) => f.actual_key === fieldKey
      );
      if (fieldIdx === -1) {
        return prevSchemas;
      }
      updatedFields[fieldIdx] = {
        ...updatedFields[fieldIdx],
        value: {
          id: asset.id,
          title: asset.title,
          url: asset.url,
        },
      };
      entry.fields = updatedFields;
      updatedEntries[entryIndex] = entry;
      updatedSchema.entries = updatedEntries;
      return {
        ...prevSchemas,
        [parentKey]: updatedSchema,
      };
    });

    alert(` Selected: ${asset.title}`);
    setIsAssetPickerOpen(false);
  };

  function normalizeSchema(rawSchema: any[]): any[] {
    const result: any[] = [];

    for (const item of rawSchema) {
      const key = Object.keys(item)[0];
      const label = item[key];

      if (typeof label === "string" && label.startsWith("[") && label.includes("{")) {
        const nestedFields = [...label.matchAll(/(\w+): \(([^)]+)\)/g)].map(([, id, name]) => ({
          id,
          name,
          type: "Text", // enhance if needed
        }));

        result.push({
          id: key,
          name: key,
          type: "Array",
          nestedFields,
        });
      } else {
        result.push({
          id: key,
          name: typeof label === "string" ? label.replace(/[()]/g, "") : key,
          type: "Text",
        });
      }
    }
    return result;
  }

  const generateContent = async (e: React.SyntheticEvent) => {
    if (!template) return alert("Please select a content type.");
    if ((!selectedFile && !url.trim()) || (selectedFile && url.trim())) {
      return alert("Please provide either a PDF file or a URL, but not both.");
    }
    setLoading(true);

    try {
      // Get schema from backend
      const schemaRes = await fetch(
        `${window.location.origin}/api/get-content-type-schema?template=${template}`
      );
      const schemaJson = await schemaRes.json();
      const schemaFields = schemaJson?.schema || [];
      //Create Azure-style schema object (flat format, but still informative)
      const content_type = schemaFields.map((field: any) => {
        if (field.linkContentType && Array.isArray(field.nestedFields)) {
          const nested = field.nestedFields
            .map((nestedField: any) => {
              return `${nestedField.id}: (${nestedField.name || nestedField.id
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

      // --- ADD THIS CHECK HERE ---
      if (!Array.isArray(content_type) || content_type.length === 0) {
        alert("Content type schema is empty or invalid. Please check.");
        setLoading(false);
        return;
      }
      // Log what we are sending to Azure
      console.log("📤 Full schema payload to send to Azure:", content_type);
      // ✅ 3. Build FormData
      const formData = new FormData();
      formData.append("template", template);
      formData.append("model", aiModel);
      console.log("📤 Sending content_type to Azure:", content_type);
      const normalizedSchema = normalizeSchema(content_type);
      formData.append("content_type", JSON.stringify(normalizedSchema)); // ✅ fixed!


      if (selectedFile) {
        formData.append("pdf", selectedFile);
      } else if (url.trim()) {
        formData.append("url", url.trim());
      }

      // ✅ 4. Call generate-summary API
      const res = await fetch(
        `${window?.location?.origin}/api/generate-summary`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) throw new Error("Failed to generate content");
      const data = await res.json();
      const {
        result,
        referenceFields,
        fileFieldList,
        allowedFields,
        nestedSchemas,
        contentTypeSchema, // ✅ This will now be available as `data.contentTypeSchema`
      } = data;


// ✅ Inject linkContentType for known array fields
const knownLinkTypes: Record<string, string> = {
  productBanner: "componentProductBanner",
};

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

console.log("🔧 Patched contentTypeSchema:", patchedSchema);
setPatchedSchemas(patchedSchema);
      console.log("🎯 generateContent -> API response:", {
        result,
        referenceFields,
        fileFieldList,
        allowedFields,
        nestedSchemas,
        contentTypeSchema,
      });

      setSecondPage(false);
      setFirstPage(false);

      let filteredSummary: any[] = [];

      if (Array.isArray(data?.summary) && data.summary.length > 0) {
        filteredSummary = data.summary.filter(
          (item: { actual_key: string }) =>
            item.actual_key?.toLowerCase() !== "image" &&
            item.actual_key?.toLowerCase() !== "author"
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

            // Remove AI-generated values for any image fields
            if (key.toLowerCase().includes("image")) {
              value = null;
            }
            // Attempt to parse stringified JSON and detect schema errors
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
                `🧪 [${index}] actual_key: ${key} | type of value:`,
                typeof value,
                value,
                "- **error**: Invalid schema format"
              );
              return null;
            }
            if (
              key.toLowerCase() === "author" ||
              key.toLowerCase().includes("image")
            ) {
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

setResult(processedSummary);
      setShowGeneratedResult(true);
      setReferenceFields(data?.referenceFields || []);
      setFileFieldList(data?.fileFieldList || []);

      if (data.nestedSchemas && typeof data.nestedSchemas === "object") {
        const cleanedNestedSchemas: any = {};

        for (const [key, schema] of Object.entries(data.nestedSchemas)) {
          if (!schema || typeof schema !== "object" || !("entries" in schema)) {
            console.warn(`⚠️ Skipping invalid schema for key "${key}"`, schema);
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
    if (!entryId || !entryVersion) {
      alert("No draft entry found to publish. Please save as draft first.");
      return;
    }
    try {
      setLoading(true);
      const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
      const environmentId =
        process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
      const managementToken =
        process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN;
      const publishResponse = await axios.put(
        `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}/published`,
        {},
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "X-Contentful-Version": entryVersion,
          },
        }
      );
      alert("Entry successfully published to Contentful!");
    } catch (err) {
      console.error("Publish error:", err);
      alert("Failed to publish to CMS.");
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
      const assetId = await handleFileUpload(file, inputId);

      if (inputId === "image" && assetId) {
        imageAssetIdRef.current = assetId;
        setUploadedImageId(assetId);
      } else if (inputId === "image" && !assetId) {
      }
    }
    setLoading(false);
  };

  const handleFileUpload = async (
    file: File,
    inputId: string
  ): Promise<string | null> => {
    setLoading(true);
    try {
      const uploadResponse = await axios.post(
        `https://upload.contentful.com/spaces/${process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID}/uploads`,
        file,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN}`,
            "Content-Type": "application/octet-stream",
          },
        }
      );

      const uploadId = uploadResponse.data.sys.id;
      const assetPayload = {
        fields: {
          title: { "en-US": file.name },
          file: {
            "en-US": {
              fileName: file.name,
              contentType: file.type || "application/octet-stream",
              uploadFrom: {
                sys: { type: "Link", linkType: "Upload", id: uploadId },
              },
            },
          },
        },
      };

      const assetResponse = await axios.post(
        `https://api.contentful.com/spaces/${process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID
        }/environments/${process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev"
        }/assets`,
        assetPayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN}`,
            "Content-Type": "application/vnd.contentful.management.v1+json",
          },
        }
      );

      const assetId = assetResponse.data.sys.id;
      const assetVersion = assetResponse.data.sys.version;
      await axios.put(
        `https://api.contentful.com/spaces/${process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID
        }/environments/${process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev"
        }/assets/${assetId}/files/en-US/process`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN}`,
            "X-Contentful-Version": assetVersion,
          },
        }
      );
      let processed = false;
      let retries = 10;
      let check: any = null;
      while (!processed && retries > 0) {
        await new Promise((res) => setTimeout(res, 2000));

        check = await axios.get(
          `https://api.contentful.com/spaces/${process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID
          }/environments/${process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev"
          }/assets/${assetId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN}`,
            },
          }
        );

        if (check.data.fields?.file?.["en-US"]?.url) {
          processed = true;
        }
        retries--;
      }
      if (!processed) {
        setLoading(false);
        return null;
      }
      const finalVersion = check.data.sys.version;
      await axios.put(
        `https://api.contentful.com/spaces/${process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID
        }/environments/${process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev"
        }/assets/${assetId}/published`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN}`,
            "X-Contentful-Version": finalVersion,
          },
        }
      );

      setLoading(false);
      return assetId;
    } catch (err: any) {
      setLoading(false);
      return null;
    }
  };
  const allowedFields = [
    "dataSourceName",
    "title",
    "description",
    "content",
    "url",
    "publishDate",
    "tags",
    "author",
    "image",
  ];
  const handleNestedImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    schemaKey: string,
    entryIndex: number,
    fieldKey: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    // Show preview immediately (functional deep update)
    setNestedSchemas((prev: any) => {
      const updated = structuredClone(prev);
      const schema = updated[schemaKey];
      if (!schema?.entries?.[entryIndex]?.fields) return prev;

      const fields = schema.entries[entryIndex].fields;
      const field = fields.find((f: any) => f.actual_key === fieldKey);
      if (!field) return prev;

      field.value = {
  sys: {
    id: "preview", // or any temporary placeholder
    type: "Link",
    linkType: "Asset",
  },
  previewUrl, // Optional custom field just for UI preview
  title: file.name + " (preview)",
};
      return updated;
    });
    try {
      const assetId = await handleFileUpload(file, fieldKey);
      if (!assetId) return;

      const imageUrl = `https://images.ctfassets.net/${process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID}/${assetId}`;
      const imageTitle = file.name;

      // Replace preview with actual Contentful image
      setNestedSchemas((prev: any) => {
        const updated = structuredClone(prev);
        const schema = updated[schemaKey];
        if (!schema || !Array.isArray(schema.entries)) return prev;

        const updatedEntries = schema.entries.map((entry: any, i: number) => {
          if (i !== entryIndex) return entry;

          const updatedFields = entry.fields.map((field: any) => {
            if (field.actual_key === fieldKey) {
              return {
                ...field,
                value: {
  sys: {
    id: assetId,
    linkType: "Asset",
    type: "Link",
  },
}

              };
            }
            return field;
          });

          return {
            ...entry,
            fields: updatedFields,
          };
        });

        updated[schemaKey] = {
          ...schema,
          entries: updatedEntries,
        };
        return updated;
      });
      URL.revokeObjectURL(previewUrl); // optional cleanup
    } catch (err) {
      console.error("❌ Upload failed", err);
    }
  };

const handleSubmit = async (
  publish: boolean,
  contentTypeSchemas: any[],
  contentTypeId: string // ✅ Add this
) => {
  try {
    setLoading(true);
    let fieldsToSend: Field[] = [];

    // Textareas
    document.querySelectorAll<HTMLTextAreaElement>("textarea.form-textarea").forEach((t) => {
      if (t.name && t.value) {
        if (t.name === "description" || t.name === "content") return;
        fieldsToSend.push({
          key: t.name,
          actual_key: t.name,
          value: t.value,
        });
      }
    });

    // Dropdowns
    document.querySelectorAll<HTMLSelectElement>("select.form-dropdown").forEach((s) => {
      if (s.name && s.value) {
        const entryReferences = ["author"];
        const assetReferences: string[] = [];
        if (entryReferences.includes(s.name)) {
          fieldsToSend.push({
            key: s.name,
            actual_key: s.name,
            value: {
              sys: { id: s.value, linkType: "Entry", type: "Link" },
            },
          });
        } else if (assetReferences.includes(s.name)) {
          fieldsToSend.push({
            key: s.name,
            actual_key: s.name,
            value: {
              sys: { id: s.value, linkType: "Asset", type: "Link" },
            },
          });
        } else {
          fieldsToSend.push({
            key: s.name,
            actual_key: s.name,
            value: s.value,
          });
        }
      }
    });

    // Normalize AI result
    let safeResult = Array.isArray(result)
      ? result
      : Object.entries(result)
          .filter(([key]) => isNaN(Number(key)))
          .map(([key, value]) => ({
            actual_key: key,
            key,
            value,
          }));
const nestedKeysInForm = fieldsToSend.map((f) => f.key).filter((k) => k.includes("["));
const topLevelKeysToSkip = new Set(
  nestedKeysInForm.map(k => k.split("[")[0]) // Extract parent keys like 'productBanner'
);
const seenKeys = new Set(fieldsToSend.map(f => f.key));
safeResult = safeResult.filter(item => !topLevelKeysToSkip.has(item.key));

    safeResult.forEach((item) => {
       const alreadyExists = seenKeys.has(item.actual_key);
      if (
        !item.actual_key ||
        item.value === undefined ||
        item.value === null ||
        alreadyExists || // Skip if already exists
    !allowedFields.includes(item.actual_key)
      )
        return;
         seenKeys.add(item.actual_key);

      let finalValue = item.value;

      if (item.actual_key === "description" || item.actual_key === "content") {
        if (typeof item.value === "object" && item.value?.nodeType === "document") {
          finalValue = item.value;
        } else {
          finalValue = {
            nodeType: "document",
            data: {},
            content: [
              {
                nodeType: "paragraph",
                data: {},
                content: [
                  {
                    nodeType: "text",
                    value: String(item.value || "").trim(),
                    marks: [],
                    data: {},
                  },
                ],
              },
            ],
          };
        }
      }

      if (item.actual_key === "tags" && Array.isArray(item.value)) {
        finalValue = item.value.join(", ");
      }

      fieldsToSend.push({
        key: item.actual_key,
        actual_key: item.actual_key,
        value: finalValue,
      });
    });

    // Author field
    if (selectedAuthor) {
      fieldsToSend.push({
        key: "author",
        actual_key: "author",
        value: {
          sys: { id: selectedAuthor, linkType: "Entry", type: "Link" },
        },
      });
    }

    // Image field
    if (uploadedImageId) {
      fieldsToSend.push({
        key: "image",
        actual_key: "image",
        value: {
          sys: { id: uploadedImageId, linkType: "Asset", type: "Link" },
        },
      });
    }

// Expand global_fields and referenced schemas for backend matching
function flattenSchemas(schemaList: any[]): any[] {
  const result: any[] = [];
  const visited = new Set<string>();
  const queue: any[] = [...schemaList];

  while (queue.length) {
    const schema = queue.shift();
    if (!schema?.id || visited.has(schema.id)) continue;

    visited.add(schema.id);
   result.push({
  id: schema.id,
  name: schema.name,
  type: schema.type || schema.data_type || "Object",
  fields: schema.fields || schema.schema || [],
  validations: schema.validations || [],
  items: schema.items || {},
  linkContentType:
    schema.linkContentType ||
    schema?.validations?.[0]?.linkContentType ||
    schema?.items?.validations?.[0]?.linkContentType || [],
});

    // Flatten global_field inner schemas
    if (schema.data_type === "global_field" && Array.isArray(schema.schema)) {
      for (const subSchema of schema.schema) {
        if (subSchema?.id && !visited.has(subSchema.id)) {
          queue.push({
            id: subSchema.id,
            fields: subSchema.fields || [],
            type: subSchema.type || "Object",
          });
        }
      }
    }
    //  Flatten referenced content types (Link or Array<Link>)
    if (Array.isArray(schema.fields)) {
      for (const field of schema.fields) {
        if (field.id === "productBanner") {
        }
 //  Add debug here
    if (field.linkContentType || field?.items?.validations) {
      console.log("🔍 Link field types:", {
        linkContentType: field.linkContentType,
        itemsValidations: field?.items?.validations,
      });
    }
        const nestedTypeIds =
          field?.validations?.[0]?.linkContentType ||
          field?.items?.validations?.[0]?.linkContentType;

        if (Array.isArray(nestedTypeIds)) {
          for (const nestedId of nestedTypeIds) {
            const nestedSchema = schemaList.find((s) => s.id === nestedId);
            if (nestedSchema && !visited.has(nestedId)) {
              queue.push(nestedSchema);
            } else if (!nestedSchema) {
              console.warn(" Missing schema for nested content type:", nestedId);
            }
          }
        }
      }
    }
  }

  return result;
}

//  Flatten full schema before sending to backend
console.log("🚀 contentTypeSchemas:", contentTypeSchemas); // Initial raw check
const allSchemaObjects = flattenSchemas(contentTypeSchemas);

// ✅ Helpful debug logs before backend call
console.log("🚀 contentTypeSchemas:", contentTypeSchemas.map(s => s.id));
console.log("📦 Flattened schema (allSchemaObjects):", allSchemaObjects.map(s => s.id));
console.log("🧪 Payload before sending to backend:", {
  contentTypeId,
  fieldsToSend: fieldsToSend.map(f => ({ key: f.key, value: f.value })),
});

    const entry = await createContentfulEntry(
      fieldsToSend,
      
      contentTypeId, //  Use the correct one
      publish,
      allSchemaObjects  // backend now detects nested structure using this
    );

    if (!entry?.sys?.id || !entry?.sys?.version) {
      throw new Error("Entry creation failed or invalid response.");
    }

    setEntryId(entry.sys.id);
    setEntryVersion(entry.sys.version);

    if (publish) {
      const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
      const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
      const managementToken = process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN;

      if (!spaceId || !environmentId || !managementToken) {
        throw new Error("Missing Contentful environment variables.");
      }

      const publishResponse = await axios.put(
        `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entry.sys.id}/published`,
        {},
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "X-Contentful-Version": entry.sys.version,
          },
        }
      );
      alert("Entry successfully published to Contentful!");
    } else {
      console.log("✅ Entry saved as draft:", entry);
      alert("Entry saved as draft in Contentful.");
    }
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error(" Submit error:", err.response?.data || err.message);
    } else if (err instanceof Error) {
      console.error(" Submit error:", err.message);
    } else {
      console.error(" Submit error:", String(err));
    }
    alert("One or more uploads failed.");
  } finally {
    setLoading(false);
  }
};

  // Safe check and logging
  if (Array.isArray(result)) {
    result.forEach((item, i) => {
      console.log(
        `🧪 [${i}] actual_key: ${item?.actual_key} | type of value:`,
        typeof item?.value,
        item?.value
      );
    });
  } else  (result && typeof result === "object") 
    

  // Render result safely
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

  const renderResult = () => {
    if (!result) {
      console.warn(" No result found.");
      return null;
    }

    let json: any = result;
    // Step 1: Attempt to parse if result is string
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

    // Step 2: Handle .result wrapper
    if (json?.result && typeof json.result === "object") {
      json = json.result;
    }

    if (typeof json === "object" && !Array.isArray(json)) {
      json = Object.entries(json)
        .filter(([key]) => isNaN(Number(key))) // filter out "0", "1", etc.
        .map(([key, value]) => ({
          actual_key: key,
          key,
          value,
        }));
    }

    // Step 4: Final check — must be array now
    if (!Array.isArray(json)) {
      return (
        <div className="alert alert-warning">
           Invalid result: expected array after processing.
        </div>
      );
    }

    return (
      <div className="genrate-content">
        {/* Regenerate Prompt Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center modal-body">
            <div className="bg-white rounded-lg w-[500px]">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold text-black">Prompt</h2>
                <button onClick={() => setModalOpen(false)}>X</button>
              </div>

              <div className="px-4 ">
                <label className="block mb-1 text-black py-3">
                  Enter Prompt:
                </label>
                <textarea
                  className="form-control modal-textarea"
                  placeholder="Enter your prompt here."
                  defaultValue={""}
                />
              </div>

              <div className="flex justify-end gap-2 px-4 py-4 border-t mt-4">
                <button
                  onClick={() => setModalOpen(false)}
                  className="primary-button"
                >
                  Close
                </button>
                <button
                  onClick={() => regeneratePromptWithText("id", "value")}
                  className="primary-button"
                >
                  Update Prompt
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Regenerate Prompt Modal End */}

        {isAssetPickerOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white w-[90%] md:w-[600px] max-h-[80vh] overflow-y-auto p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">
                Select Image from Contentful
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {Array.isArray(assetList) &&
                  assetList
                    .filter((asset) => asset && typeof asset === "object") // Skip null/undefined
                    .map((asset: any, index: number) => {
                      //  Normalize asset values
                      const assetId =
                        asset?.id || asset?.sys?.id || `asset-${index}`;
                      const assetTitle =
                        asset?.title ||
                        asset?.fields?.title?.["en-US"] ||
                        asset?.fields?.title ||
                        "Untitled";

                      const assetUrl =
                        asset?.url ||
                        (asset?.fields?.file?.url &&
                          `https:${asset.fields.file.url}`) ||
                        (asset?.fields?.file?.["en-US"]?.url &&
                          `https:${asset.fields.file["en-US"].url}`);

                      if (!assetUrl) return null;

                      return (
                        <div
                          key={assetId}
                          className="border p-2 rounded hover:shadow cursor-pointer"
                          onClick={() =>
                            handleSelectAsset({
                              id: assetId,
                              title: assetTitle,
                              url: assetUrl,
                            })
                          }
                        >
                          <img
                            src={assetUrl}
                            alt={assetTitle}
                            className="w-full h-32 object-cover rounded"
                          />
                          <p className="text-sm mt-1 truncate text-center">
                            {assetTitle}
                          </p>
                        </div>
                      );
                    })}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  className="secondary-button"
                  onClick={() => setIsAssetPickerOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <form encType="multipart/form-data" method="post">
          {json?.map((item: any, index: number) => {
            const actualKey = item.actual_key;
            // If it's a referenced component
            if (actualKey === "author") return null;
            if (nestedSchemas?.hasOwnProperty(actualKey)) {
              const schema = nestedSchemas[actualKey];

              const actualEntries = Array.isArray(result[actualKey])
                ? result[actualKey]
                : [];

              return (
                <div
                  key={`${actualKey}-${index}`}
                  className="nested-schema-block mb-8"
                >
                  <div className="bg-gray-100 border-l-4 border-blue-500 p-2 mb-4">
                    <h3 className="text-lg font-semibold capitalize text-blue-800">
                      {actualKey.replace(/([A-Z])/g, " $1")}
                    </h3>
                  </div>

                  {Array.isArray(schema?.entries) &&
                    schema.entries.length > 0 ? (
                    schema.entries.map((entry: any, entryIndex: number) => {
                      const aiEntryData = actualEntries[entryIndex] || {};

                      return (
                        <div
                          key={`${actualKey}-${entryIndex}`}
                          className="bg-white border p-4 rounded mb-4 shadow"
                        >
                          <h4 className="text-md font-bold mb-2">
                            Entry {entryIndex + 1}
                          </h4>

                          {Array.isArray(entry?.fields) &&
                            entry.fields.length > 0 ? (
                            entry.fields.map(
                              (field: any, fieldIndex: number) => {
                                const fieldKey = field.actual_key;
                                const fieldValue =
                                  aiEntryData?.[fieldKey] ?? field.value;

                                const isAsset =
                                  typeof fieldValue === "object" &&
                                  (fieldValue?.url || field?.type === "Asset");

                                return (
                                  <div
                                    key={`${fieldKey}-${fieldIndex}`}
                                    className="mb-4"
                                  >
                                    <label className="block font-medium mb-1">
                                      {fieldKey}
                                    </label>

                                    {fieldKey
                                      .toLowerCase()
                                      .includes("image") ? (
                                      <>
                                        {fieldValue?.url ? (
                                          <>
                                            <img
                                              src={fieldValue.url}
                                              alt={fieldValue.title || fieldKey}
                                              className="max-w-xs rounded shadow mb-2"
                                            />
                                            <p className="text-xs text-gray-400">
                                              {fieldValue.title ||
                                                "Image selected"}
                                            </p>
                                          </>
                                        ) : (
                                          <div className="text-sm text-gray-500 italic mb-2">
                                            No image selected
                                          </div>
                                        )}

                                        <input
                                          type="file"
                                          name={`${actualKey}[${entryIndex}][${fieldKey}]`}
                                          accept="image/*"
                                          className="form-input mt-2"
                                          onChange={(e) =>
                                            handleNestedImageUpload(
                                              e,
                                              actualKey,
                                              entryIndex,
                                              fieldKey
                                            )
                                          }
                                        />

                                        <button
                                          type="button"
                                          className="secondary-button ml-2"
                                          onClick={() =>
                                            openImagePicker(
                                              actualKey,
                                              entryIndex,
                                              fieldKey
                                            )
                                          }
                                        >
                                          Select from Contentful
                                        </button>
                                      </>
                                    ) : typeof fieldValue === "object" &&
                                      typeof fieldValue.url === "string" &&
                                      typeof fieldValue.title === "string" ? (
                                      <a
                                        href={fieldValue.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline"
                                      >
                                        {fieldValue.title}
                                      </a>
                                    ) : (
                                      <textarea
                                        className="form-control form-textarea"
                                        name={`${actualKey}[${entryIndex}][${fieldKey}]`}
                                        defaultValue={
                                          typeof fieldValue === "object" && fieldValue !== null && "value" in fieldValue
                                            ? fieldValue.value
                                            : typeof fieldValue === "object"
                                              ? JSON.stringify(fieldValue, null, 2)
                                              : fieldValue || ""
                                        }

                                        rows={Math.min(
                                          10,
                                          typeof fieldValue === "string"
                                            ? fieldValue.split("\n").length + 1
                                            : 4
                                        )}
                                      />
                                    )}
                                  </div>
                                );
                              }
                            )
                          ) : (
                            <div className="text-red-600">
                              No fields found for entry {entryIndex + 1}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-red-600">
                      No entries found for {actualKey}
                    </div>
                  )}
                </div>
              );
            }

            // Root-level field

            return (
              <div
                key={actualKey || index}
                className="mb-4 bg-white border-[var(--border-color)] border-[1px] p-4 rounded-lg"
              >
                <div className="label-bar">
                  <label htmlFor={actualKey} className="mb-2 pl-2">
                    <strong>
                      {item.key} <span className="req">(Required)</span>
                    </strong>
                  </label>
                  <span>
                    <button
                      type="button"
                      onClick={() => regeneratePrompt(actualKey, item?.value)}
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() => showRegeneratePromptPopup(actualKey)}
                    >
                      Prompt
                    </button>
                  </span>
                </div>

                {item.type === "File" ||
                  item.actual_type === "File" ||
                  item.key?.toLowerCase().includes("image") ? (
                  <>
                    {item?.value?.url ? (
                      <>
                        <img
                          src={item.value.url}
                          alt={item.value.title || actualKey}
                          className="max-w-xs rounded shadow mb-2"
                        />
                        <p className="text-xs text-gray-400">
                          {item.value.title || "Image selected"}
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
                      onChange={handleFileChange}
                    />

                    <button
                      type="button"
                      className="secondary-button ml-2"
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
                      typeof item.value === "object"
                        ? JSON.stringify(item.value, null, 2)
                        : item.value || ""
                    }
                    rows={Math.min(
                      10,
                      typeof item.value === "string"
                        ? item.value.split("\n").length + 1
                        : 4
                    )}
                    style={{ whiteSpace: "pre-wrap" }}
                  />
                )}
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

          <div className="form-group">
            <label htmlFor="author">Author</label>
            <select
              id="author"
              className="form-control"
              value={selectedAuthor}
              onChange={(e) => setSelectedAuthor(e.target.value)}
            >
              <option value="">Select Author</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4 flex justify-end bg-white border-[var(--border-color)] border-[1px] p-4 rounded-lg">
            <button
              type="button"
              className="primary-button"
              
              onClick={() => {
  console.log("Sending template to backend:", template);
  handleSubmit(false, patchedSchemas, template);
}}
              disabled={loading}
              
            >
              <svg
                width="18"
                height="20"
                viewBox="0 0 18 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M1.29767 1.33782C1.34434 1.29754 1.40391 1.27604 1.46512 1.27739H12.4007C12.4593 1.27739 12.5146 1.30292 12.5548 1.34547L16.6889 5.89847C16.7246 5.9379 16.7443 5.98957 16.7442 6.04315V18.5813C16.7442 18.6001 16.7367 18.6307 16.7023 18.663C16.6557 18.7033 16.5961 18.7248 16.5349 18.7235H13.7989C13.8089 18.6537 13.814 18.583 13.814 18.5107V13.4045C13.814 13.0095 13.6596 12.6307 13.3848 12.3514C13.1101 12.0721 12.7374 11.9152 12.3488 11.9152H5.65116C5.26259 11.9152 4.88993 12.0721 4.61517 12.3514C4.34041 12.6307 4.18605 13.0095 4.18605 13.4045V18.5107C4.18605 18.583 4.19107 18.6537 4.20112 18.7235H1.46512C1.40391 18.7248 1.34434 18.7033 1.29767 18.663C1.26335 18.6307 1.25581 18.6001 1.25581 18.5813V1.41951C1.25581 1.40079 1.26335 1.37015 1.29767 1.33782ZM5.65116 18.7235H12.3488C12.4043 18.7235 12.4576 18.701 12.4968 18.6611C12.5361 18.6212 12.5581 18.5671 12.5581 18.5107V13.4045C12.5581 13.3481 12.5361 13.294 12.4968 13.2541C12.4576 13.2142 12.4043 13.1918 12.3488 13.1918H5.65116C5.59565 13.1918 5.54242 13.2142 5.50316 13.2541C5.46391 13.294 5.44186 13.3481 5.44186 13.4045V18.5107C5.44186 18.6281 5.53563 18.7235 5.65116 18.7235ZM1.46512 20C1.0934 20 0.726697 19.863 0.448744 19.6034C0.308311 19.4742 0.195887 19.3166 0.118629 19.1408C0.0413709 18.965 0.000970478 18.7747 0 18.5822V1.41866C0 1.02379 0.169116 0.656993 0.448744 0.396579C0.726697 0.137016 1.0934 0 1.46512 0H12.4007C12.8101 0 13.2003 0.173609 13.4774 0.479128L17.6115 5.03213C17.861 5.30701 18 5.66699 18 6.04144V18.5805C18 18.9762 17.8309 19.3422 17.5513 19.6026C17.2733 19.8621 16.9066 19.9991 16.5349 19.9991L1.46512 20Z"
                  fill="#6C5CE7"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M5.86047 6.32994C5.86047 6.20298 5.91008 6.08122 5.9984 5.99145C6.08671 5.90168 6.2065 5.85124 6.3314 5.85124H10.4128C10.5377 5.85124 10.6575 5.90168 10.7458 5.99145C10.8341 6.08122 10.8837 6.20298 10.8837 6.32994C10.8837 6.4569 10.8341 6.57866 10.7458 6.66844C10.6575 6.75821 10.5377 6.80865 10.4128 6.80865H6.3314C6.2065 6.80865 6.08671 6.75821 5.9984 6.66844C5.91008 6.57866 5.86047 6.4569 5.86047 6.32994Z"
                  fill="#6C5CE7"
                />
              </svg>
              
              Save
            </button>
            <button
              className="primary-button active"
              disabled={!result || !selectedAuthor || loading}
              onClick={publishToCMS}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16.5014 14.1665L17.1198 13.7422L15.7514 11.7478V14.1665H16.5014ZM16.8793 14.7174L16.2609 15.1417L16.2612 15.1421L16.8793 14.7174ZM13.1249 19.389H12.3749V19.8928L12.8413 20.0833L13.1249 19.389ZM9.84876 16.1959V15.4459L9.84742 15.4459L9.84876 16.1959ZM9.66549 16.1203L9.13517 16.6506L9.13584 16.6513L9.66549 16.1203ZM5.87893 12.3339L5.34795 12.8636L5.34862 12.8643L5.87893 12.3339ZM5.80335 12.1507L6.55335 12.152V12.1507H5.80335ZM2.62769 8.87474L1.92541 9.13798L2.10786 9.62474H2.62769V8.87474ZM7.32128 5.15982L6.90527 5.78387L6.90585 5.78425L7.32128 5.15982ZM7.84107 5.50564L8.2575 4.88187L8.2565 4.88121L7.84107 5.50564ZM8.91273 5.40003L9.44292 5.9305L9.44305 5.93037L8.91273 5.40003ZM9.64789 4.66491L10.1782 5.19526L10.1782 5.19524L9.64789 4.66491ZM16.9901 1.28752L16.9326 0.539729L16.9325 0.539739L16.9901 1.28752ZM20.7218 1.00073L20.6657 0.252825L20.6643 0.25293L20.7218 1.00073ZM20.9993 1.27821L21.7471 1.33568L21.7472 1.33431L20.9993 1.27821ZM20.7125 5.00969L21.4602 5.06723L21.4603 5.06717L20.7125 5.00969ZM17.3349 12.3526L17.8648 12.8833L17.8652 12.8829L17.3349 12.3526ZM16.5997 13.0866L16.0698 12.5559L16.0688 12.5569L16.5997 13.0866ZM16.5014 14.1676L15.8835 14.5928L17.2514 16.5803V14.1676H16.5014ZM4.4586 14.2081C4.75145 13.9152 4.75138 13.4403 4.45844 13.1474C4.1655 12.8546 3.69063 12.8547 3.39778 13.1476L4.4586 14.2081ZM0.46959 16.0767C0.176741 16.3696 0.176812 16.8445 0.46975 17.1373C0.762687 17.4302 1.23756 17.4301 1.53041 17.1372L0.46959 16.0767ZM5.19149 17.8694C5.48445 17.5765 5.48454 17.1017 5.19171 16.8087C4.89887 16.5157 4.424 16.5156 4.13105 16.8085L5.19149 17.8694ZM1.20182 19.7365C0.908872 20.0294 0.908776 20.5042 1.20161 20.7972C1.49444 21.0901 1.96932 21.0902 2.26227 20.7974L1.20182 19.7365ZM8.85201 18.6C9.14481 18.3071 9.14465 17.8322 8.85166 17.5394C8.55867 17.2466 8.0838 17.2467 7.791 17.5397L8.85201 18.6ZM4.86281 20.4698C4.57002 20.7628 4.57017 21.2377 4.86316 21.5305C5.15615 21.8233 5.63102 21.8231 5.92382 21.5302L4.86281 20.4698ZM16.5014 14.1665L15.883 14.5909L16.2609 15.1417L16.8793 14.7174L17.4977 14.293L17.1198 13.7422L16.5014 14.1665ZM16.8793 14.7174L16.2612 15.1421C17.6018 17.0931 15.582 19.5823 13.4084 18.6946L13.1249 19.389L12.8413 20.0833C16.3874 21.5314 19.6856 17.477 17.4974 14.2926L16.8793 14.7174ZM13.1249 19.389H13.8749V17.3586H13.1249H12.3749V19.389H13.1249ZM13.1249 17.3586H13.8749C13.8749 16.3024 13.0182 15.4459 11.9621 15.4459V16.1959V16.9459C12.1899 16.9459 12.3749 17.1309 12.3749 17.3586H13.1249ZM11.9621 16.1959V15.4459H9.84876V16.1959V16.9459H11.9621V16.1959ZM9.84876 16.1959L9.84742 15.4459C9.91197 15.4458 9.97589 15.4584 10.0355 15.483L9.7496 16.1763L9.46366 16.8697C9.58621 16.9202 9.71752 16.9461 9.8501 16.9459L9.84876 16.1959ZM9.7496 16.1763L10.0355 15.483C10.0952 15.5076 10.1494 15.5437 10.1951 15.5893L9.66549 16.1203L9.13584 16.6513C9.22972 16.7449 9.34112 16.8191 9.46366 16.8697L9.7496 16.1763ZM9.66549 16.1203L10.1958 15.5899L6.40925 11.8036L5.87893 12.3339L5.34862 12.8643L9.13517 16.6506L9.66549 16.1203ZM5.87893 12.3339L6.40992 11.8043C6.4555 11.8499 6.49163 11.9042 6.51624 11.9638L5.8229 12.2498L5.12956 12.5358C5.18011 12.6583 5.25432 12.7697 5.34795 12.8636L5.87893 12.3339ZM5.8229 12.2498L6.51624 11.9638C6.54085 12.0235 6.55346 12.0875 6.55335 12.152L5.80335 12.1507L5.05335 12.1493C5.05311 12.2819 5.07901 12.4132 5.12956 12.5358L5.8229 12.2498ZM5.80335 12.1507H6.55335V10.0261H5.80335H5.05335V12.1507H5.80335ZM5.80335 10.0261H6.55335C6.55335 8.97611 5.70188 8.12474 4.65195 8.12474V8.87474V9.62474C4.87353 9.62474 5.05335 9.80461 5.05335 10.0261H5.80335ZM4.65195 8.87474H3.90195V9.65127H4.65195H5.40195V8.87474H4.65195ZM4.65195 8.87474V8.12474H2.62769V8.87474V9.62474H4.65195V8.87474ZM2.62769 8.87474L3.32998 8.6115C2.51822 6.44587 4.96593 4.49104 6.90527 5.78387L7.32128 5.15982L7.73729 4.53577C4.58233 2.43257 0.604185 5.6132 1.92541 9.13798L2.62769 8.87474ZM7.32128 5.15982L6.90585 5.78425L7.42563 6.13007L7.84107 5.50564L8.2565 4.88121L7.73672 4.53539L7.32128 5.15982ZM7.84107 5.50564L7.42463 6.1294C7.73217 6.33472 8.10135 6.4271 8.46934 6.39084L8.39579 5.64445L8.32223 4.89807C8.29943 4.90032 8.27655 4.89459 8.2575 4.88187L7.84107 5.50564ZM8.39579 5.64445L8.46934 6.39084C8.83733 6.35457 9.18138 6.1919 9.44292 5.9305L8.91273 5.40003L8.38255 4.86955C8.36635 4.88574 8.34504 4.89582 8.32223 4.89807L8.39579 5.64445ZM8.91273 5.40003L9.44305 5.93037L10.1782 5.19526L9.64789 4.66491L9.11757 4.13457L8.38242 4.86968L8.91273 5.40003ZM9.64789 4.66491L10.1782 5.19524C12.0175 3.35593 14.4541 2.23511 17.0477 2.03531L16.9901 1.28752L16.9325 0.539739C13.982 0.767036 11.21 2.04211 9.11756 4.13458L9.64789 4.66491ZM16.9901 1.28752L17.0476 2.03532L20.7793 1.74852L20.7218 1.00073L20.6643 0.25293L16.9326 0.539729L16.9901 1.28752ZM20.7218 1.00073L20.7779 1.74862C20.7074 1.75391 20.6366 1.74392 20.5703 1.71933L20.8312 1.01616L21.092 0.312993C20.9559 0.262487 20.8105 0.241966 20.6657 0.252826L20.7218 1.00073ZM20.8312 1.01616L20.5703 1.71933C20.504 1.69474 20.4438 1.65614 20.3939 1.60616L20.9242 1.07581L21.4545 0.54547C21.3518 0.442801 21.2282 0.3635 21.092 0.312993L20.8312 1.01616ZM20.9242 1.07581L20.3939 1.60616C20.3439 1.55615 20.3053 1.49596 20.2807 1.4297L20.9838 1.16881L21.687 0.907918C21.6365 0.771801 21.5572 0.648164 21.4545 0.54547L20.9242 1.07581ZM20.9838 1.16881L20.2807 1.4297C20.2561 1.36342 20.2461 1.29261 20.2514 1.2221L20.9993 1.27821L21.7472 1.33431C21.758 1.18949 21.7375 1.04405 21.687 0.907918L20.9838 1.16881ZM20.9993 1.27821L20.2515 1.22073L19.9647 4.95221L20.7125 5.00969L21.4603 5.06717L21.7471 1.33568L20.9993 1.27821ZM20.7125 5.00969L19.9647 4.95215C19.7651 7.54592 18.6442 9.98274 16.8046 11.8222L17.3349 12.3526L17.8652 12.8829C19.958 10.7903 21.2332 8.01802 21.4602 5.06723L20.7125 5.00969ZM17.3349 12.3526L16.805 11.8218L16.0698 12.5559L16.5997 13.0866L17.1297 13.6174L17.8648 12.8833L17.3349 12.3526ZM16.5997 13.0866L16.0688 12.5569C15.8051 12.8212 15.6422 13.1695 15.6083 13.5414L16.3553 13.6093L17.1022 13.6773C17.1043 13.6543 17.1144 13.6327 17.1307 13.6164L16.5997 13.0866ZM16.3553 13.6093L15.6083 13.5414C15.5745 13.9132 15.6719 14.2852 15.8835 14.5928L16.5014 14.1676L17.1192 13.7424C17.1061 13.7233 17.1001 13.7003 17.1022 13.6773L16.3553 13.6093ZM16.5014 14.1676H17.2514V14.1665H16.5014H15.7514V14.1676H16.5014ZM3.92819 13.6778L3.39778 13.1476L0.46959 16.0767L1 16.6069L1.53041 17.1372L4.4586 14.2081L3.92819 13.6778ZM4.66127 17.3389L4.13105 16.8085L1.20182 19.7365L1.73205 20.267L2.26227 20.7974L5.19149 17.8694L4.66127 17.3389ZM8.32151 18.0699L7.791 17.5397L4.86281 20.4698L5.39332 21L5.92382 21.5302L8.85201 18.6L8.32151 18.0699ZM15.8263 9.468L15.296 8.93766C14.679 9.55454 13.6788 9.55454 13.0619 8.93766L12.5316 9.468L12.0012 9.99834C13.2039 11.201 15.1539 11.201 16.3566 9.99834L15.8263 9.468ZM12.5316 9.468L13.0619 8.93766C12.445 8.32079 12.445 7.32067 13.0619 6.7038L12.5316 6.17346L12.0012 5.64312C10.7985 6.84578 10.7985 8.79569 12.0012 9.99834L12.5316 9.468ZM12.5316 6.17346L13.0619 6.7038C13.6788 6.08692 14.679 6.08692 15.296 6.7038L15.8263 6.17346L16.3566 5.64312C15.1539 4.44048 13.2039 4.44048 12.0012 5.64312L12.5316 6.17346ZM15.8263 6.17346L15.296 6.7038C15.9129 7.32067 15.9129 8.32079 15.296 8.93766L15.8263 9.468L16.3566 9.99834C17.5593 8.79569 17.5593 6.84578 16.3566 5.64312L15.8263 6.17346Z"
                  fill="white"
                />
              </svg>
              {loading ? "Publishing..." : "Publish to CMS"}
            </button>
          </div>
        </form>
        {successMsg && (
          <div className="alert alert-success mt-3">
            Successfully Created Entry.
          </div>
        )}
        {sucessPage && (
          <div className="new-page">
            <div className="bg-white flex items-center space-x-4 border-[var(--border-color)] border-t-[1px] rounded-t-lg border-l-[1px] border-r-[1px] border-b-[1px] p-4">
              <h2>
                New Page - Espire&apos;s Enterprise Solutions: Streamlining
                Operations and Driving Digital Transformation
              </h2>
              <button className="primary-button" type="button">
                New Content
              </button>
            </div>
            <div className="bg-white p-4 border-[var(--border-color)] border-l-[1px] border-b-[1px] border-r-[1px] rounded-b-lg">
              <p className="mb-4">
                Product Family: Espire&apos;s Enterprise Solutions
              </p>
              <p className="mb-4">
                Description: In today&apos;s dynamic business environment,
                organizations need robust enterprise solutions to streamline
                operations, enhance digital experiences, and drive sustainable
                growth. Espire Infolabs offers a comprehensive suite of
                enterprise solutions encompassing ERP, CRM, SCM, and HCM systems
                designed to modernize and scale business operations while
                accelerating ROI.{" "}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container py-3">
      {firstPage && (
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
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M2.17021 38.5096C2.74579 38.5096 3.29779 38.7383 3.70478 39.1453C4.11178 39.5523 4.34043 40.1043 4.34043 40.6799V58.0416C4.34043 58.4409 4.66451 58.765 5.06383 58.765H62.9362C63.128 58.765 63.312 58.6887 63.4477 58.5531C63.5834 58.4174 63.6596 58.2334 63.6596 58.0416V40.6799C63.6596 40.1043 63.8882 39.5523 64.2952 39.1453C64.7022 38.7383 65.2542 38.5096 65.8298 38.5096C66.4054 38.5096 66.9574 38.7383 67.3644 39.1453C67.7714 39.5523 68 40.1043 68 40.6799V58.0416C68 59.3846 67.4665 60.6726 66.5168 61.6222C65.5672 62.5719 64.2792 63.1054 62.9362 63.1054H5.06383C3.72082 63.1054 2.43281 62.5719 1.48316 61.6222C0.533508 60.6726 0 59.3846 0 58.0416V40.6799C0 40.1043 0.228646 39.5523 0.63564 39.1453C1.04263 38.7383 1.59464 38.5096 2.17021 38.5096Z"
                  fill="#101010"
                  fill-opacity="0.3"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M18.6551 15.3405L32.4664 1.52922C32.8733 1.12281 33.4249 0.894531 34 0.894531C34.5751 0.894531 35.1267 1.12281 35.5336 1.52922L49.3448 15.3405C49.7282 15.7519 49.9369 16.296 49.927 16.8582C49.9171 17.4205 49.6893 17.9569 49.2917 18.3545C48.8941 18.7521 48.3576 18.9799 47.7954 18.9898C47.2332 18.9997 46.689 18.791 46.2776 18.4077L36.1702 8.30317V52.2543C36.1702 52.8299 35.9416 53.3819 35.5346 53.7889C35.1276 54.1959 34.5756 54.4245 34 54.4245C33.4244 54.4245 32.8724 54.1959 32.4654 53.7889C32.0584 53.3819 31.8298 52.8299 31.8298 52.2543V8.30028L21.7253 18.4106C21.5266 18.6238 21.287 18.7948 21.0208 18.9134C20.7546 19.032 20.4672 19.0958 20.1758 19.101C19.8844 19.1061 19.595 19.0525 19.3247 18.9434C19.0545 18.8342 18.809 18.6717 18.603 18.4657C18.3969 18.2596 18.2344 18.0141 18.1253 17.7439C18.0161 17.4737 17.9625 17.1842 17.9676 16.8928C17.9728 16.6014 18.0366 16.314 18.1552 16.0478C18.2738 15.7816 18.4448 15.542 18.658 15.3433L18.6551 15.3405Z"
                  fill="#101010"
                  fill-opacity="0.3"
                />
              </svg>
              <Settings model={aiModel} setAIModel={getAIModel} />
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
                    <p className="mt-2 text-muted hidden">
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

          <div className="bg-white flex justify-content-end border-b-[1px] border-t-[1px] border-l-[1px] border-r-[1px] p-4 rounded-b-lg">
            <button className="primary-button" onClick={setCancel}>
              Cancel
            </button>
            <button className="primary-button active" onClick={setSecond}>
              Import
            </button>
          </div>
        </div>
      )}

      {/* Uploaded Document and Url Details Are Below */}
      {uploadedDetails && (
        <div className="bg-white border-[var(--border-color)] border-[1px] p-4 flex items-center justify-between mb-4 rounded-lg">
          <span className="w-1/2 flex items-center">
            {fileName && (
              <>
                <svg
                  width="100"
                  height="100"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M18.7651 65.2653C18.7651 64.7132 18.9845 64.1838 19.3748 63.7934C19.7652 63.403 20.2947 63.1837 20.8468 63.1837H25.7039C28.4643 63.1837 31.1117 64.2803 33.0636 66.2322C35.0155 68.1841 36.1121 70.8314 36.1121 73.5918C36.1121 76.3523 35.0155 78.9996 33.0636 80.9515C31.1117 82.9034 28.4643 84 25.7039 84H20.8468C20.2947 84 19.7652 83.7807 19.3748 83.3903C18.9845 82.9999 18.7651 82.4705 18.7651 81.9184V65.2653ZM22.9284 67.3469V79.8367H25.7039C27.3602 79.8367 28.9486 79.1788 30.1197 78.0076C31.2909 76.8365 31.9488 75.2481 31.9488 73.5918C31.9488 71.9356 31.2909 70.3472 30.1197 69.176C28.9486 68.0049 27.3602 67.3469 25.7039 67.3469H22.9284ZM50.6835 67.3469C47.7859 67.3469 45.1325 69.9698 45.1325 73.5918C45.1325 77.2139 47.7859 79.8367 50.6835 79.8367C53.5811 79.8367 56.2345 77.2139 56.2345 73.5918C56.2345 69.9698 53.5811 67.3469 50.6835 67.3469ZM40.9692 73.5918C40.9692 68.0186 45.1519 63.1837 50.6835 63.1837C56.2151 63.1837 60.3978 68.0186 60.3978 73.5918C60.3978 79.1651 56.2151 84 50.6835 84C45.1519 84 40.9692 79.1651 40.9692 73.5918ZM74.267 67.3469C71.3527 67.3525 68.7243 69.9559 68.7243 73.5918C68.7243 77.2278 71.3555 79.8312 74.267 79.8367C75.5493 79.8229 76.7816 79.3371 77.7281 78.474C77.9291 78.2852 78.1655 78.1383 78.4238 78.0417C78.682 77.945 78.9569 77.9007 79.2324 77.9112C79.5079 77.9217 79.7786 77.9868 80.0287 78.1028C80.2789 78.2188 80.5035 78.3833 80.6895 78.5868C80.8756 78.7903 81.0193 79.0287 81.1124 79.2882C81.2056 79.5477 81.2462 79.8232 81.232 80.0985C81.2178 80.3739 81.1491 80.6437 81.0297 80.8922C80.9104 81.1408 80.7429 81.3632 80.5369 81.5464C78.8296 83.1073 76.6052 83.9813 74.292 84H74.2753C68.7243 84 64.5611 79.1817 64.5611 73.5918C64.5611 68.002 68.7243 63.1837 74.2753 63.1837H74.292C76.6052 63.2024 78.8296 64.0763 80.5369 65.6372C80.7429 65.8205 80.9104 66.0429 81.0297 66.2914C81.1491 66.54 81.2178 66.8098 81.232 67.0851C81.2462 67.3605 81.2056 67.6359 81.1124 67.8955C81.0193 68.155 80.8756 68.3934 80.6895 68.5969C80.5035 68.8004 80.2789 68.9649 80.0287 69.0809C79.7786 69.1969 79.5079 69.262 79.2324 69.2725C78.9569 69.283 78.682 69.2386 78.4238 69.142C78.1655 69.0454 77.9291 68.8985 77.7281 68.7097C76.7817 67.8446 75.5492 67.3593 74.267 67.3469ZM25.01 20.1633C24.826 20.1633 24.6495 20.2364 24.5194 20.3665C24.3893 20.4966 24.3162 20.6731 24.3162 20.8571V51.3878C24.3162 51.9398 24.0968 52.4693 23.7065 52.8597C23.3161 53.2501 22.7866 53.4694 22.2345 53.4694C21.6824 53.4694 21.153 53.2501 20.7626 52.8597C20.3722 52.4693 20.1529 51.9398 20.1529 51.3878V20.8571C20.1529 19.5689 20.6646 18.3335 21.5755 17.4226C22.4864 16.5117 23.7218 16 25.01 16H58.3162C58.8681 16.0005 59.3972 16.2201 59.7872 16.6106L79.2158 36.0392C79.6071 36.4278 79.8264 36.9579 79.8264 37.5102V51.3878C79.8264 51.9398 79.6071 52.4693 79.2167 52.8597C78.8263 53.2501 78.2968 53.4694 77.7447 53.4694C77.1926 53.4694 76.6632 53.2501 76.2728 52.8597C75.8824 52.4693 75.6631 51.9398 75.6631 51.3878V38.3706L57.4558 20.1633H25.01Z"
                    fill="#475161"
                  />
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M58.3162 16C58.8681 16.0005 59.3972 16.2201 59.7872 16.6106C60.1776 17.001 60.3978 17.5295 60.3978 18.0816V35.4286H77.7447C78.2968 35.4286 78.8254 35.6488 79.2158 36.0392C79.6071 36.4278 79.8264 36.9579 79.8264 37.5102C79.8264 38.0623 79.6071 38.5918 79.2167 38.9821C78.8263 39.3725 78.2968 39.5918 77.7447 39.5918H58.3162C57.7641 39.5918 57.2346 39.3725 56.8442 38.9821C56.4538 38.5918 56.2345 38.0623 56.2345 37.5102V18.0816C56.2345 17.5295 56.4538 17.0001 56.8442 16.6097C57.2346 16.2193 57.7641 16 58.3162 16Z"
                    fill="#475161"
                  />
                </svg>
                <h3>{fileName}</h3>
              </>
            )}

            {url && (
              <>
                <svg
                  width="100"
                  height="100"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M24.4681 23.8298C24.2988 23.8298 24.1364 23.897 24.0167 24.0167C23.897 24.1364 23.8298 24.2988 23.8298 24.4681V75.5319C23.8298 75.8843 24.1157 76.1702 24.4681 76.1702H75.5319C75.7012 76.1702 75.8636 76.103 75.9833 75.9833C76.103 75.8636 76.1702 75.7012 76.1702 75.5319V58.4255C76.1702 57.9177 76.372 57.4306 76.7311 57.0715C77.0902 56.7124 77.5772 56.5106 78.0851 56.5106C78.593 56.5106 79.08 56.7124 79.4391 57.0715C79.7983 57.4306 80 57.9177 80 58.4255V75.5319C80 76.7169 79.5293 77.8534 78.6913 78.6913C77.8534 79.5293 76.7169 80 75.5319 80H24.4681C23.2831 80 22.1466 79.5293 21.3087 78.6913C20.4707 77.8534 20 76.7169 20 75.5319V24.4681C20 22.0017 22.0017 20 24.4681 20H41.5745C42.0823 20 42.5694 20.2017 42.9285 20.5609C43.2876 20.92 43.4894 21.407 43.4894 21.9149C43.4894 22.4228 43.2876 22.9098 42.9285 23.2689C42.5694 23.628 42.0823 23.8298 41.5745 23.8298H24.4681ZM56.5106 21.9149C56.5106 21.407 56.7124 20.92 57.0715 20.5609C57.4306 20.2017 57.9177 20 58.4255 20H75.537C78.0136 20 80 22.0068 80 24.4681V28.9362H76.1702V24.4681C76.1702 24.1106 75.8843 23.8298 75.537 23.8298H58.4255C57.9177 23.8298 57.4306 23.628 57.0715 23.2689C56.7124 22.9098 56.5106 22.4228 56.5106 21.9149ZM76.1702 28.9362V41.5745C76.1702 42.0823 76.372 42.5694 76.7311 42.9285C77.0902 43.2876 77.5772 43.4894 78.0851 43.4894C78.593 43.4894 79.08 43.2876 79.4391 42.9285C79.7983 42.5694 80 42.0823 80 41.5745V28.9362H76.1702Z"
                    fill="#475161"
                  />
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M76.8851 23.1149C77.2437 23.4739 77.4451 23.9606 77.4451 24.4681C77.4451 24.9755 77.2437 25.4622 76.8851 25.8213L43.6936 59.0128C43.5183 59.2009 43.3069 59.3518 43.072 59.4565C42.8371 59.5611 42.5836 59.6174 42.3264 59.6219C42.0693 59.6265 41.8139 59.5792 41.5755 59.4829C41.3371 59.3866 41.1205 59.2432 40.9386 59.0614C40.7568 58.8795 40.6134 58.6629 40.5171 58.4245C40.4208 58.1861 40.3735 57.9307 40.3781 57.6736C40.3826 57.4164 40.4389 57.1629 40.5435 56.928C40.6482 56.6931 40.7991 56.4817 40.9872 56.3064L74.1787 23.1149C74.5378 22.7563 75.0245 22.5549 75.5319 22.5549C76.0394 22.5549 76.5261 22.7563 76.8851 23.1149Z"
                    fill="#475161"
                  />
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
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M19.8442 6.65567C19.9439 6.75548 20 6.89077 20 7.03184C20 7.1729 19.9439 7.30819 19.8442 7.408L9.89657 17.3443C9.79665 17.444 9.66121 17.5 9.51999 17.5C9.37877 17.5 9.24332 17.444 9.1434 17.3443L4.16961 12.3762C4.11725 12.3274 4.07526 12.2687 4.04613 12.2034C4.01701 12.1381 4.00135 12.0676 4.00008 11.9961C3.99882 11.9246 4.01198 11.8536 4.03879 11.7874C4.06559 11.7211 4.10548 11.6609 4.15608 11.6103C4.20669 11.5598 4.26697 11.5199 4.33332 11.4932C4.39968 11.4664 4.47075 11.4532 4.54231 11.4545C4.61386 11.4558 4.68443 11.4714 4.7498 11.5005C4.81517 11.5296 4.874 11.5715 4.92279 11.6238L9.51999 16.2158L19.091 6.65567C19.1909 6.55599 19.3263 6.5 19.4676 6.5C19.6088 6.5 19.7442 6.55599 19.8442 6.65567Z"
                  fill="#198754"
                  stroke="#198754"
                  stroke-width="2"
                />
              </svg>
            </span>
          )}
        </div>
      )}

      {/* Uploaded Document and Url Details */}

      {secondPage && (
        <div className="mb-5">
          <div className="bg-white content-box">
            <div className="border-[var(--border-color)] border-t-[1px] rounded-t-lg border-l-[1px] border-r-[1px] border-b-[1px] p-4">
              <h2>Select Content Types</h2>
            </div>
            <div className="p-4 border-[var(--border-color)] border-l-[1px] border-r-[1px]">
              {contentTypeResult?.content_types?.map(
                (field: { options: any; title: string; uid: string }) =>
                  field.options.is_page && (
                    <div className="form-check" key={field.uid}>
                      <label className="form-check-label">
                        <input
                          type="radio"
                          className="form-check-input"
                          name="template"
                          value={field.uid}
                          checked={template === field.uid}
                          onChange={() => setTemplate(field.uid)}
                        />
                        {field.title}
                      </label>
                    </div>
                  )
              )}
            </div>
          </div>
          <div className="bg-white flex justify-content-end border-b-[1px] border-t-[1px] border-l-[1px] border-r-[1px] p-4 rounded-b-lg">
            <button
              className="primary-button"
              type="button"
              onClick={setCancel}
            >
              Cancel
            </button>
            <button
              className="bg-[var(--blue-color)] primary-button active flex space-x-4"
              disabled={!template || (!selectedFile && !url.trim()) || loading}
              onClick={generateContent}
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
                      stroke-width="1.5"
                      stroke-linejoin="round"
                    />
                  </svg>
                  Generate Content
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {showGeneratedResult && renderResult()}

      {sucessPage && (
        <div className="new-page">
          <div className="bg-white flex items-center space-x-4 border-[var(--border-color)] border-t-[1px] rounded-t-lg border-l-[1px] border-r-[1px] border-b-[1px] p-4">
            <h2>New Page - {finalResult?.entry?.title}</h2>
            <button
              className="primary-button"
              type="button"
              onClick={setSuccess}
            >
              New Content
            </button>
          </div>
          <div className="bg-white p-4 border-[var(--border-color)] border-l-[1px] border-b-[1px] border-r-[1px] rounded-b-lg">
            <p className="mb-4">Url : {finalResult?.entry?.url}</p>
            <p className="mb-4">Summary: {finalResult?.entry?.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}