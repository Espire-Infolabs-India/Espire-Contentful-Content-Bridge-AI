export interface HeaderEntryResponse {
  uid: string;
  _version: number;
  locale: string;
  ACL: Record<string, unknown>;
  _in_progress: boolean;
  created_at: string;
  created_by: string;
  logo: Logo;
  navigation_links: NavigationLink[];
  tags: string[];
  title: string;
  updated_at: string;
  updated_by: string;
}

export interface Logo {
  uid: string;
  _version: number;
  parent_uid: string;
  title: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  content_type: string;
  file_size: string;
  filename: string;
  ACL: Record<string, unknown>;
  is_dir: boolean;
  tags: string[];
   publish_details: HeaderEntryResponse;
  url: string;
}

export interface NavigationLink {
  link_text: string;
  _metadata: {
    uid: string;
  };
  link_url: string;
}

export interface Entry {
  uid: string;
  _version: number;
  locale: string;
  ACL: Record<string, unknown>;
  _in_progress: boolean;
  created_at: string;
  created_by: string;
  logo: Logo;
  navigation_links: NavigationLink[];
  tags: string[];
  title: string;
  updated_at: string;
  updated_by: string;
   publish_details: HeaderEntryResponse;
}

export interface RootObject {
  entry: Entry;
}
