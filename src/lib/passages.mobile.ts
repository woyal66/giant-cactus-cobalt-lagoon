export type PassageKind = "passage" | "anchorage";

export type Waypoint = {
  lat: number;
  lng: number;
  label?: string;
};

export type Passage = {
  id: number;
  userId: string;
  authorName: string;
  title: string;
  region: string;
  notes: string;
  kind: PassageKind;
  published: boolean;
  waypoints: Waypoint[];
  createdAt: string;
};

/** Phone build keeps tracks on the device. Cloud publish needs the website. */
export async function listPublicPassages(): Promise<Passage[]> {
  return [];
}

export async function listMyPassages(): Promise<Passage[]> {
  return [];
}

export async function getPublicPassage(_args: {
  data: { id: number };
}): Promise<Passage | null> {
  return null;
}

export async function savePassage(_args?: unknown): Promise<{ id: number }> {
  throw new Error("Saving a track to the cloud is on the website. It stays on this phone.");
}

export async function setPublished(_args?: unknown): Promise<{ ok: true }> {
  return { ok: true };
}

export async function deletePassage(_args?: unknown): Promise<{ ok: true }> {
  return { ok: true };
}
