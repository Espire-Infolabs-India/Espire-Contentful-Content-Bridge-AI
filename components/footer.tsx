import React, { useState, useEffect } from 'react';
import { getFooterRes } from '../helper';
import { FooterProps, Entry, Links } from "../typescript/layout";


export default function Footer({ footer, entries }: { footer: FooterProps, entries: Entry[] }) {

  const [getFooter, setFooter] = useState(footer);

  function buildNavigation(ent: Entry[], ft: FooterProps) {
    let newFooter = { ...ft };
    if (ent.length !== newFooter.navigation.link.length) {
      ent.forEach((entry) => {
        const fFound = newFooter?.navigation.link.find(
          (nlink: Links) => nlink.title === entry.fields.title
        );
        if (!fFound) {
          newFooter.navigation.link?.push({
            title: entry.fields.title,
            href: entry.fields.url,
            $: entry.fields.$,
          });
        }
      });
    }
    return newFooter;
  }

  async function fetchData() {
    try {
      if (footer && entries) {
        const footerRes = await getFooterRes();
        if (footerRes) {
          const newfooter = buildNavigation(entries, footerRes);
          setFooter(newfooter);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchData();
  }, [footer,entries]);

  return (
    <footer className="bg-gray-50 border-t border-gray-200 text-sm text-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Resources */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Resources</h3>
          <ul className="space-y-2">
            <li><a href=''>Download Center</a></li>
            <li><a href=''>Warranty Information</a></li>
            <li><a href=''>Products End of Service</a></li>
            <li><a href=''>Security Advisory</a></li>
            <li><a href=''>Report Vulnerability</a></li>
            <li><a href=''>Declarations of Conformity</a></li>
            <li><a href=''>Premium Support Options</a></li>
            <li><a href=''>Australian Consumer Rights</a></li>
          </ul>
        </div>

        {/* Alerts */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Alerts</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <a href=""><span className="text-red-500">❗</span>
              <span>2/1/25 – Security Advisory for Unauthenticated RCE on Some WiFi Routers, PSV-2023-0039</span>
              </a>
            </li>
            <li className="flex items-start gap-2">
              <a href=""><span className="text-red-500">❗</span>
              <span>2/1/25 – Security Advisory for Remote Exploitation on Some Wireless Access Points, PSV-2024-0117</span>
              </a>
            </li>
          </ul>
        </div>

        {/* MyNETGEAR */}
        <div>
          <h3 className="text-lg font-semibold mb-3">MyNETGEAR</h3>
          <div className="flex flex-col space-y-3">
            <a href="#" className="bg-white shadow rounded px-4 py-2 flex items-center gap-2 hover:bg-gray-100">
              🔑 Register Your Product
            </a>
            <a href="#" className="bg-white shadow rounded px-4 py-2 flex items-center gap-2 hover:bg-gray-100">
              🛡️ Check Your Product Warranty
            </a>
            <a href="#" className="bg-white shadow rounded px-4 py-2 flex items-center gap-2 hover:bg-gray-100">
              🚚 Track Your Return
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 mt-10 py-4 px-4 text-center text-xs text-gray-500">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto">
          <div className="mb-2 sm:mb-0">
            <strong className="text-gray-700">NETGEAR</strong> ©1996–2025 NETGEAR® &nbsp;
            <a href="#" className="hover:underline">Privacy Policy</a> &nbsp; | &nbsp;
            <a href="#" className="hover:underline">Terms and Conditions</a>
          </div>

          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <span className="bg-black text-white px-2 py-1 rounded">f</span>
            <span className="bg-black text-white px-2 py-1 rounded">X</span>
            <span className="bg-black text-white px-2 py-1 rounded">▶</span>
            <span className="bg-black text-white px-2 py-1 rounded">📷</span>
            <button className="ml-2 px-2 py-1 border rounded text-sm">
              United States (English)
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
