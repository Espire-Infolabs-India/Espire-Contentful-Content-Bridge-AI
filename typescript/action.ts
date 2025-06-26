type AdditionalParam = {
  url: string;
  title: {};
}

export type Action = {
    title: string;
    href: string;
    $: AdditionalParam;
  }

export type Image = {
    fields: any;
    filename: string;
    url: string;
    $: AdditionalParam;
  }