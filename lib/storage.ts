import type { BodySpec, StoredResult } from "./types";

const STORE_NAME = "virtual-fitting";
const USER_IMAGE_KEY = "userImageBase64";
const BODY_SPEC_KEY = "bodySpec";
const LAST_RESULT_KEY = "lastResult";

async function getStore() {
  if (typeof window === "undefined") return null;
  const { default: localforage } = await import("localforage");
  return localforage.createInstance({ name: STORE_NAME });
}

export async function saveUserImage(dataUrl: string | null) {
  const store = await getStore();
  if (!store) return;
  if (dataUrl) {
    await store.setItem(USER_IMAGE_KEY, dataUrl);
  } else {
    await store.removeItem(USER_IMAGE_KEY);
  }
}

export async function loadUserImage() {
  const store = await getStore();
  if (!store) return null;
  return store.getItem<string | null>(USER_IMAGE_KEY);
}

export async function saveBodySpec(spec: BodySpec | null) {
  const store = await getStore();
  if (!store) return;
  if (spec) {
    await store.setItem(BODY_SPEC_KEY, spec);
  } else {
    await store.removeItem(BODY_SPEC_KEY);
  }
}

export async function loadBodySpec() {
  const store = await getStore();
  if (!store) return null;
  return store.getItem<BodySpec | null>(BODY_SPEC_KEY);
}

export async function saveLastResult(result: StoredResult | null) {
  const store = await getStore();
  if (!store) return;
  if (result) {
    await store.setItem(LAST_RESULT_KEY, result);
  } else {
    await store.removeItem(LAST_RESULT_KEY);
  }
}

export async function loadLastResult() {
  const store = await getStore();
  if (!store) return null;
  return store.getItem<StoredResult | null>(LAST_RESULT_KEY);
}
