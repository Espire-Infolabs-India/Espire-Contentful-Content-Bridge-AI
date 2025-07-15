// import React, { useState, useEffect } from 'react';
// import Header from './header';
// import Sidebar from './sidebar';
// import Footer from './footer';
// import DevTools from './devtools';

// import { HeaderProps, FooterProps, PageProps, Posts, ChilderenProps, NavLinks, Links, EntryData } from "../typescript/layout";

// export default function Layout({
//   header,
//   footer,
//   page,
//   blogPost,
//   blogList,
//   entries,
//   children,
// }: { header: HeaderProps, footer: FooterProps, page: PageProps, blogPost: Posts, blogList: Posts, entries: EntryData[], children: ChilderenProps }) {

//   const [getLayout, setLayout] = useState<{ header: HeaderProps, footer: FooterProps }>({
//     header,
//     footer
//   });

//   const jsonObj: any = { header, footer };
//   page && (jsonObj.page = page);
//   blogPost && (jsonObj.blog_post = blogPost);
//   blogList && (jsonObj.blog_post = blogList);

//   function buildNavigation(ent: EntryData[] = [], hd: HeaderProps, ft: FooterProps): [HeaderProps, FooterProps] {
//     let newHeader = { ...hd };
//     let newFooter = { ...ft };

//     const navMenu = newHeader?.navigation_menu ?? [];
//     const footerLinks = newFooter?.navigation?.link ?? [];

//     if (Array.isArray(ent) && Array.isArray(navMenu) && ent.length !== navMenu.length) {
//       ent.forEach((entry) => {
//         if (!entry || !entry.title || !entry.url) return;

//         const hFound = navMenu.find(
//           (navLink: NavLinks) => navLink.label === entry.title
//         );

//         if (!hFound) {
//           navMenu.push({
//             label: entry.title,
//             page_reference: [
//               { title: entry.title, url: entry.url, $: entry.$ },
//             ],
//             $: {},
//           });
//         }

//         const fFound = footerLinks.find(
//           (nlink: Links) => nlink.title === entry.title
//         );

//         if (!fFound) {
//           footerLinks.push({
//             title: entry.title,
//             href: entry.url,
//             $: entry.$,
//           });
//         }
//       });

//       newHeader.navigation_menu = navMenu;

//       if (!newFooter.navigation) {
//         newFooter.navigation = { link: [] };
//       }

//       newFooter.navigation.link = footerLinks;
//     }

//     return [newHeader, newFooter];
//   }

//   useEffect(() => {
//     if (footer && header && Array.isArray(entries)) {
//       const [newHeader, newFooter] = buildNavigation(entries, header, footer);
//       setLayout({ header: newHeader, footer: newFooter });
//     }
//   }, [header, footer, entries]);

//   return (
//     <>
//       {header ? <Header /> : ''}
//       <main className='mainClass'>
//         <>
//           {/* <Sidebar /> */}
//           {children}
//           {Object.keys(jsonObj).length && <DevTools response={jsonObj} />}
//         </>
//       </main>
//     </>
//   );
// }


import React from 'react';

export default function Layout({
  children,
}:any) {

  return (
    <>
      {/* {header ? <Header /> : ''} */}
      <main className='mainClass'>
        <>
        {/* <Sidebar /> */}
        {children}
        </>
      </main>
    </>
  );
}
