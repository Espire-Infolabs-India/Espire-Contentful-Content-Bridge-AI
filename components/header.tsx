import React, { useState, useEffect } from 'react';
import Navigation from '@/components/navigation';
import { HeaderProps } from '../typescript/layout';
import { getHeaderResponse  } from '../helper';

export default function Header() {
  const [headerData, setHeaderData] = useState<HeaderProps | null>(null);

  useEffect(() => {
    const fetchAPI = async () => {
      try {
        const data = await getHeaderResponse ();
        setHeaderData(data);
      } catch (error) {
        console.error('Error fetching header from Contentful:', error);
      }
    };

    fetchAPI();
  }, []);

  if (!headerData) {
    return null; // Optionally show a loader
  }

  const logoUrl = headerData?.logo?.fields?.file?.url
    ? `https:${headerData.logo.fields.file.url}`
    : '';

  return (
    <header className='header'>
      <Navigation
        navigation={headerData.navigation}
        logo={logoUrl}
        title={headerData.title}
      />
    </header>
  );
}
