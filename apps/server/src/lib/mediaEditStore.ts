import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  LibraryItem,
  LibraryItemOriginalSource,
  LibraryItemSavedMediaEdit,
  SaveLibraryItemMediaEditInput,
} from "@discasa/shared";

type PersistedMediaEditRecord = {
  originalSource: LibraryItemOriginalSource | null;
  savedMediaEdit: LibraryItemSavedMediaEdit | null;
};

type PersistedMediaEditDatabase = {
  records: Record<string, PersistedMediaEditRecord>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../.discasa-data");
const dataFile = path.join(dataDir, "media-edits.json");

function ensureDataDir(): void {
  fs.mkdirSync(dataDir, { recursive: true });
}

function createDefaultDatabase(): PersistedMediaEditDatabase {
  return {
    records: {},
  };
}

function normalizeOriginalSource(raw: unknown): LibraryItemOriginalSource | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  if (typeof entry.attachmentUrl !== "string" || entry.attachmentUrl.length === 0) {
    return null;
  }

  return {
    attachmentUrl: entry.attachmentUrl,
    storageChannelId:
      typeof entry.storageChannelId === "string" && entry.storageChannelId.length > 0 ? entry.storageChannelId : undefined,
    storageMessageId:
      typeof entry.storageMessageId === "string" && entry.storageMessageId.length > 0 ? entry.storageMessageId : undefined,
  };
}

function normalizeSavedMediaEdit(raw: unknown): LibraryItemSavedMediaEdit | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  if (
    typeof entry.rotationDegrees !== "number" ||
    !Number.isFinite(entry.rotationDegrees) ||
    typeof entry.hasCrop !== "boolean" ||
    typeof entry.savedAt !== "string"
  ) {
    return null;
  }

  return {
    rotationDegrees: normalizeRotationDegrees(entry.rotationDegrees),
    hasCrop: entry.hasCrop,
    savedAt: entry.savedAt,
  };
}

function normalizeDatabase(raw: unknown): PersistedMediaEditDatabase {
  const fallback = createDefaultDatabase();

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const entry = raw as Record<string, unknown>;
  const rawRecords = entry.records;

  if (!rawRecords || typeof rawRecords !== "object") {
    return fallback;
  }

  const records: Record<string, PersistedMediaEditRecord> = {};

  for (const [itemId, value] of Object.entries(rawRecords as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const record = value as Record<string, unknown>;
    records[itemId] = {
      originalSource: normalizeOriginalSource(record.originalSource),
      savedMediaEdit: normalizeSavedMediaEdit(record.savedMediaEdit),
    };
  }

  return { records };
}

function loadDatabase(): PersistedMediaEditDatabase {
  ensureDataDir();

  if (!fs.existsSync(dataFile)) {
    const next = createDefaultDatabase();
    fs.writeFileSync(dataFile, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeDatabase(parsed);
    fs.writeFileSync(dataFile, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    const next = createDefaultDatabase();
    fs.writeFileSync(dataFile, JSON.stringify(next, null, 2), "utf8");
    return next;
  }
}

const database = loadDatabase();

function saveDatabase(): void {
  ensureDataDir();
  fs.writeFileSync(dataFile, JSON.stringify(database, null, 2), "utf8");
}

function normalizeRotationDegrees(value: number): number {
  const rounded = Math.round(value / 90) * 90;
  const normalized = ((rounded % 360) + 360) % 360;
  return normalized;
}

function hasMeaningfulSavedEdit(input: SaveLibraryItemMediaEditInput): boolean {
  return normalizeRotationDegrees(input.rotationDegrees) !== 0 || input.hasCrop;
}

function createOriginalSourceFromItem(item: LibraryItem): LibraryItemOriginalSource {
  return {
    attachmentUrl: item.originalSource?.attachmentUrl ?? item.attachmentUrl,
    storageChannelId: item.originalSource?.storageChannelId ?? item.storageChannelId,
    storageMessageId: item.originalSource?.storageMessageId ?? item.storageMessageId,
  };
}

export function getStoredMediaEditRecord(itemId: string): PersistedMediaEditRecord | null {
  return database.records[itemId] ?? null;
}

export function attachMediaEditToLibraryItem(item: LibraryItem): LibraryItem {
  const record = getStoredMediaEditRecord(item.id);
  if (!record) {
    return item;
  }

  return {
    ...item,
    originalSource: record.originalSource,
    savedMediaEdit: record.savedMediaEdit,
  };
}

export function attachMediaEditsToLibraryItems(items: LibraryItem[]): LibraryItem[] {
  return items.map((item) => attachMediaEditToLibraryItem(item));
}

export function saveLibraryItemMediaEdit(item: LibraryItem, input: SaveLibraryItemMediaEditInput): LibraryItem {
  if (!hasMeaningfulSavedEdit(input)) {
    delete database.records[item.id];
    saveDatabase();
    return {
      ...item,
      originalSource: null,
      savedMediaEdit: null,
    };
  }

  const nextRecord: PersistedMediaEditRecord = {
    originalSource: getStoredMediaEditRecord(item.id)?.originalSource ?? createOriginalSourceFromItem(item),
    savedMediaEdit: {
      rotationDegrees: normalizeRotationDegrees(input.rotationDegrees),
      hasCrop: Boolean(input.hasCrop),
      savedAt: new Date().toISOString(),
    },
  };

  database.records[item.id] = nextRecord;
  saveDatabase();

  return {
    ...item,
    originalSource: nextRecord.originalSource,
    savedMediaEdit: nextRecord.savedMediaEdit,
  };
}

export function deleteLibraryItemMediaEdit(itemId: string): void {
  if (!(itemId in database.records)) {
    return;
  }

  delete database.records[itemId];
  saveDatabase();
}
