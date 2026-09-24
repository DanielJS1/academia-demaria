const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");

for (const file of ["../.env.local", "../tests/e2e/.env"]) {
  const filename = path.resolve(__dirname, file);
  if (fs.existsSync(filename)) process.loadEnvFile(filename);
}

async function main() {
  const email = process.env.E2E_CARTORIO_EMAIL?.trim().toLowerCase();
  const password = process.env.E2E_CARTORIO_PASSWORD;
  if (!email || !password) throw new Error("Defina E2E_CARTORIO_EMAIL e E2E_CARTORIO_PASSWORD.");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: cartorios, error: lookupError } = await db.from("academy_cartorios")
    .select("id,name,status,key_user_id,key_user_name")
    .ilike("key_user_email", email);
  if (lookupError) throw lookupError;
  if (cartorios.length !== 1 || cartorios[0].status !== "active") {
    throw new Error("É necessário um único cartório ativo com este e-mail de usuário-chave.");
  }
  const cartorio = cartorios[0];
  let user;
  for (let page = 1; page <= 20 && !user; page++) {
    const result = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    user = result.data.users.find(item => item.email?.toLowerCase() === email);
    if (result.data.users.length < 1000) break;
  }
  if (cartorio.key_user_id && cartorio.key_user_id !== user?.id) {
    throw new Error("O cartório já está vinculado a outro usuário. Revise antes de alterar.");
  }
  let created = false;
  if (!user) {
    const result = await db.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: cartorio.key_user_name || "Usuário-chave do cartório" },
    });
    if (result.error || !result.data.user) throw result.error || new Error("Falha ao criar usuário Auth.");
    user = result.data.user;
    created = true;
  }
  try {
    const profile = await db.from("academy_profiles").upsert({
      id: user.id, name: cartorio.key_user_name || "Usuário-chave do cartório",
      email, department: cartorio.name, manager_id: null, role: "student",
      status: "active", audience: "client", cartorio_id: cartorio.id,
    });
    if (profile.error) throw profile.error;
    const link = await db.from("academy_cartorios").update({ key_user_id: user.id }).eq("id", cartorio.id);
    if (link.error) throw link.error;
  } catch (error) {
    if (created) await db.auth.admin.deleteUser(user.id);
    throw error;
  }
  console.log("Acesso do usuário-chave normalizado no Auth, perfil e cartório.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
