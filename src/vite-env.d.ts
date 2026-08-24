/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JSON_STORAGE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
