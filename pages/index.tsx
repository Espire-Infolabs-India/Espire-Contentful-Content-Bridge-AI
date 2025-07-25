import { SDKProvider, useSDK } from '@contentful/react-apps-toolkit';
import { useEffect, useState } from 'react';

const ContentfulApp = () => {
  const sdk = useSDK();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>✅ App Loaded Inside Contentful</h1>
      <p>Space ID: {sdk.ids.space}</p>
      <p>Environment ID: {sdk.ids.environment}</p>
    </div>
  );
};

export default function IndexPage() {
  const [isInsideContentful, setIsInsideContentful] = useState<boolean | null>(null);

  useEffect(() => {
    const inside = window.self !== window.top;
    setIsInsideContentful(inside);
  }, []);

  if (isInsideContentful === null) return null; // Still checking

  if (!isInsideContentful) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '50px' }}>
        <h2>This app only works inside Contentful.</h2>
      </div>
    );
  }

  // Only render SDKProvider + useSDK when inside iframe
  return (
    <SDKProvider>
      <ContentfulApp />
    </SDKProvider>
  );
}
