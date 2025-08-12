import React, { useCallback, useEffect, useState } from 'react';
import { ConfigAppSDK } from '@contentful/app-sdk';
import {
  Heading,
  Form,
  Paragraph,
  Flex,
  FormControl,
  TextInput,
  Box,
} from '@contentful/f36-components';
import { css } from 'emotion';
import { useSDK, useCMA } from '@contentful/react-apps-toolkit';

export interface AppInstallationParameters {
  cmaToken?: string;
  deliveryToken?: string;
}

const ConfigScreen = () => {
  const sdk = useSDK<ConfigAppSDK>();
  const cma = useCMA();
  const [parameters, setParameters] = useState<AppInstallationParameters>({});
  const [spaceInfo, setSpaceInfo] = useState<{
    spaceName?: string;
    spaceId?: string;
    environmentId?: string;
  }>({});

  // 🚀 1. Fetch params from API route
  const fetchInstallationParams = async ({
    spaceId,
    environmentId,
    appId,
  }: {
    spaceId: string;
    environmentId: string;
    appId?: string;
  }) => {
    try {
      const url = new URL('/api/get-installation-params', window.location.origin);
      url.searchParams.set('spaceId', spaceId);
      url.searchParams.set('environmentId', environmentId);
      if (appId) url.searchParams.set('appId', appId);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch installation parameters');
      const data = await res.json();
      setParameters((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Error fetching params from server:', err);
      sdk.notifier.error('Failed to fetch saved installation parameters.');
    }
  };

  // 🚀 2. Save configuration
  const onConfigure = useCallback(async () => {
    if (!parameters.cmaToken || !parameters.deliveryToken) {
      sdk.notifier.error('Please fill in both CMA Token and Delivery Token.');
      return false;
    }

    const currentState = await sdk.app.getCurrentState();
    sdk.notifier.success('Configuration saved successfully!');
    return {
      parameters,
      targetState: currentState,
    };
  }, [parameters, sdk]);

  // ✅ Register save callback
  useEffect(() => {
    sdk.app.onConfigure(() => onConfigure());
  }, [sdk, onConfigure]);

  // 📦 Initial load
  useEffect(() => {
    (async () => {
      const currentParameters = await sdk.app.getParameters();
      if (currentParameters) {
        setParameters(currentParameters);
      }

      const spaceId = sdk.ids.space;
      const environmentId = sdk.ids.environment;
      const appId = sdk.ids.app;

      try {
        const space = await cma.space.get({ spaceId });
        setSpaceInfo({ spaceName: space.name, spaceId, environmentId });
      } catch (err) {
        console.error('Failed to fetch space info:', err);
        sdk.notifier.error('Could not fetch space information.');
        setSpaceInfo({
          spaceName: 'Unavailable',
          spaceId,
          environmentId,
        });
      }

      // 🧠 Fetch saved installation params
      await fetchInstallationParams({ spaceId, environmentId, appId });

      sdk.app.setReady();
    })();
  }, [sdk, cma]);

  return (
    <Flex flexDirection="column" className={css({ margin: '80px', maxWidth: '800px' })}>
      <Form>
        <Heading>App Configuration</Heading>
        <Paragraph>Configure your API tokens and view installation environment info.</Paragraph>

        <Box marginTop="spacingM">
          <h3>Space: {spaceInfo.spaceName}</h3>
          <h3>Space ID: {spaceInfo.spaceId}</h3>
          <h3>Environment: {spaceInfo.environmentId}</h3>
        </Box>

        <Box marginTop="spacingL">
          <FormControl isRequired>
            <FormControl.Label>CMA Token</FormControl.Label>
            <TextInput
              type="password"
              value={parameters.cmaToken || ''}
              onChange={(e) =>
                setParameters({ ...parameters, cmaToken: e.target.value })
              }
            />
          </FormControl>

          <FormControl isRequired marginTop="spacingM">
            <FormControl.Label>Delivery Token</FormControl.Label>
            <TextInput
              type="password"
              value={parameters.deliveryToken || ''}
              onChange={(e) =>
                setParameters({ ...parameters, deliveryToken: e.target.value })
              }
            />
          </FormControl>
        </Box>
      </Form>
    </Flex>
  );
};

export default ConfigScreen;
