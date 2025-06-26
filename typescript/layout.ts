import { Image } from "./action";
import { Component } from "./component";

export type AdditionalParam = {
  title?: string;
  copyright?: string;
  announcement_text?: string;
  label?: string;
  url?: string;
};

export type EntryData = {
  title: string;
  url: string;
  $: AdditionalParam;
};

export type Entry = {
  fields: EntryData;
};

export type Announcement = {
  show_announcement: boolean;
  announcement_text: string;
  $: AdditionalParam;
};

export type PageRef = {
  title: string;
  url: string;
  $: AdditionalParam;
};

export type Share = {
  link: Links;
  icon: Image;
};

export type Social = {
  social_share: Share[];
};

export type Navigation = {
  link: Links[];
};

export type Author = {
  title: string;
  $: AdditionalParam;
};

export type Blog = {
  url: string;
  body: string;
  title: string;
  $: AdditionalParam;
};

export type Posts = {
  locale: string;
  author: Author[];
  body: string;
  date: string;
  featured_image: any;
  is_archived: boolean;
  related_post: Blog[];
  seo: any;
  url: string;
  title: string;
  _owner: any;
};

export type HeaderProps = {
  locale: string;
  logo: Image;
  navigation_menu: NavLinks[];
  notification_bar: Announcement;
  title: string;
  uid: string;
  social: Social;
  navigation: Navigation;
  copyright: string;
  $: AdditionalParam;
};

export type NavLinks = {
  label?: string;
  page_reference: PageRef[];
  $: AdditionalParam;
  href?: string;
};

export type Links = {
  label?: string;
  title: string;
  href: string;
  $: AdditionalParam;
};

export type PageProps = {
  locale: string;
  page_components: Component[];
  uid: string;
  url: string;
  title: string;
  seo: any;
};

export type FooterProps = {
  ctaSection: any;
  alerts: any;
  logo: Image;
  title: string;
  social: Social;
  navigation: Navigation;
  copyright: string;
  locale: string;
  navigation_menu: NavLinks[];
  notification_bar: Announcement;
  uid: string;
  $: AdditionalParam;
};

export type ChilderenProps = {
  props?: any;
  type: Function;
};
