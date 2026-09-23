// Run after the media migration: node --env-file=.env.local scripts/migrate-inline-media.mjs
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
const db = createClient(url, key, { auth: { persistSession: false } });
const decode = value => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value || "");
  return match ? { extension: match[1] === "jpeg" ? "jpg" : match[1], contentType: `image/${match[1]}`, bytes: Buffer.from(match[2], "base64") } : null;
};
async function upload(value, bucket, owner) {
  const data = decode(value);
  if (!data) return value;
  const path = `${owner}/${Date.now()}-${randomUUID()}.${data.extension}`;
  const result = await db.storage.from(bucket).upload(path, data.bytes, { contentType: data.contentType, upsert: false });
  if (result.error) throw result.error;
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
let migrated = 0;
for (let offset = 0;; offset += 500) {
  const { data: profiles, error } = await db.from("academy_profiles").select("id,avatar").order("id").range(offset, offset + 499);
  if (error) throw error;
  for (const profile of profiles || []) {
    if (!decode(profile.avatar)) continue;
    const avatar = await upload(profile.avatar, "academy-avatars", profile.id);
    const updated = await db.from("academy_profiles").update({ avatar }).eq("id", profile.id);
    if (updated.error) throw updated.error;
    migrated++;
  }
  if ((profiles || []).length < 500) break;
}
for (let offset = 0;; offset += 500) {
  const { data: resources, error } = await db.from("academy_resources").select("id,published,draft").eq("kind", "article").order("id").range(offset, offset + 499);
  if (error) throw error;
  for (const resource of resources || []) {
    const changes = {};
    for (const version of ["published", "draft"]) {
      const body = resource[version];
      if (!body?.blocks?.length) continue;
      let changed = false;
      const blocks = [];
      for (const block of body.blocks) {
        const src = decode(block.src) ? await upload(block.src, "academy-articles", resource.id) : block.src;
        blocks.push({ ...block, src });
        if (src !== block.src) changed = true;
      }
      if (changed) changes[version] = { ...body, blocks };
    }
    if (Object.keys(changes).length) {
      const updated = await db.from("academy_resources").update(changes).eq("id", resource.id);
      if (updated.error) throw updated.error;
      migrated++;
    }
  }
  if ((resources || []).length < 500) break;
}
console.log(`Registros migrados: ${migrated}`);
