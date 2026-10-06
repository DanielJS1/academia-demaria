const ref = process.env.E2E_ISOLATED_SUPABASE_REF;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!ref || ref === "ktmymzokgxmmkleacclq" || !url || new URL(url).hostname !== `${ref}.supabase.co`)
  throw new Error("E2E requires matching isolated Supabase URL/reference; production is forbidden");
console.log("Isolated Supabase reference confirmed; E2E writes are allowed only in this test environment.");
