interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_DEMO_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
