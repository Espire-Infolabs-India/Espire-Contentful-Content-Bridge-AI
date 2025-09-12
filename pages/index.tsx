import React, { useEffect, useState } from "react";
import { getContentfulInfo, SafeContentfulInfo } from "../helper/get-contentful-details";
import BlogGenerator from "../pages/blog-generator"; // ✅ updated import

export default function Home() {
  const [contentfulData, setContentfulData] = useState<SafeContentfulInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await getContentfulInfo();
        if (data) {
          setContentfulData(data);
        } else {
          setError("No Contentful data found.");
        }
      } catch (err) {
        console.error("Error fetching Contentful info", err);
        setError("Failed to fetch Contentful info.");
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, []);

  return (

      <BlogGenerator />
  );
}
