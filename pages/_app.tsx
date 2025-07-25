import { useEffect, useState } from 'react';
import { GlobalStyles } from '@contentful/f36-components';
import { SDKProvider } from '@contentful/react-apps-toolkit';
import { useRouter } from 'next/router';
import NProgress from 'nprogress';
import Head from 'next/head';
import Layout from '@/components/layout';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import 'nprogress/nprogress.css';
import '../styles/third-party.css';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Props } from "../typescript/pages";
import { EntryData, PageProps, Posts } from "../typescript/layout";

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#f50057' },
  },
});

const emptyPage: PageProps = {
  locale: '',
  page_components: [],
  uid: '',
  url: '',
  title: '',
  seo: {},
};

const emptyPost: Posts = {
  locale: '',
  author: [],
  body: '',
  date: '',
  featured_image: null,
  is_archived: false,
  related_post: [],
  seo: {},
  url: '',
  title: '',
  _owner: {},
};

export default function App(props: AppProps & Props & { entries: EntryData[] }) {
  const { Component, pageProps, header, footer, entries } = props;
  const { page, posts, archivePost, blogPost } = pageProps;
  const [isInsideContentful, setIsInsideContentful] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const inside = window.self !== window.top;
    setIsInsideContentful(inside);
  }, []);

  useEffect(() => {
    const handleStart = () => NProgress.start();
    const handleStop = () => NProgress.done();

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleStop);
    router.events.on('routeChangeError', handleStop);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleStop);
      router.events.off('routeChangeError', handleStop);
    };
  }, [router]);

  const metaData = (seo: any) => {
    const metaArr = [];
    for (const key in seo) {
      if (seo.enable_search_indexing) {
        metaArr.push(
          <meta
            name={key.includes('meta_') ? key.split('meta_')[1] : key}
            content={seo[key]}
            key={key}
          />
        );
      }
    }
    return metaArr;
  };

  const blogList = posts?.concat(archivePost) || [];

  if (isInsideContentful === null) return null;

  if (isInsideContentful) {
  return (
    <SDKProvider>
      <GlobalStyles />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Component {...pageProps} />
      </ThemeProvider>
    </SDKProvider>
  );
}

  return (
    <>
      <Head>
        <meta name="application-name" content="Contentfull-Nextjs-Starter-App" />
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1" />
        <meta name="theme-color" content="#317EFB" />
        <title>Contentful-Nextjs-Starter-App</title>
        {page?.seo && page.seo.enable_search_indexing && metaData(page.seo)}
      </Head>

      <Layout
        header={header}
        footer={footer}
        page={page || emptyPage}
        blogPost={blogPost || emptyPost}
        blogList={blogList || []}
        entries={entries}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Component {...pageProps} />
        </ThemeProvider>
      </Layout>
    </>
  );
}

App.getInitialProps = async (appContext: any) => {
  const appProps = await (await import('next/app')).default.getInitialProps(appContext);
  const { getHeaderResponse, getFooterRes, getAllEntries } = await import('../helper');

  const header = await getHeaderResponse();
  const footer = await getFooterRes();
  const rawEntries = await getAllEntries();
  const entriesList = rawEntries.map((entry) => entry.fields);

  return { ...appProps, header, footer, entries: entriesList };
};
