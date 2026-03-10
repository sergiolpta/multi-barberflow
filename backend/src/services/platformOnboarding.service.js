import { supabaseAdmin } from "../lib/supabaseAdmin.js";

function assertRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`Campo obrigatório inválido: ${fieldName}`);
    error.statusCode = 400;
    throw error;
  }

  return value.trim();
}

function normalizeEmail(value, fieldName) {
  return assertRequiredString(value, fieldName).toLowerCase();
}

function normalizeSlug(value) {
  return assertRequiredString(value, "barbearia.slug")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

function buildConflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function extractAuthUsers(listUsersResponse) {
  if (Array.isArray(listUsersResponse?.data?.users)) {
    return listUsersResponse.data.users;
  }

  if (Array.isArray(listUsersResponse?.users)) {
    return listUsersResponse.users;
  }

  return [];
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    const error = new Error("Payload inválido.");
    error.statusCode = 400;
    throw error;
  }

  const barbearia = payload.barbearia || {};
  const owner = payload.owner || {};
  const staff = payload.staff_inicial || {};

  const validated = {
    barbearia: {
      nome: assertRequiredString(barbearia.nome, "barbearia.nome"),
      slug: normalizeSlug(barbearia.slug),
      whatsapp: assertRequiredString(barbearia.whatsapp, "barbearia.whatsapp"),
      email: normalizeEmail(barbearia.email, "barbearia.email"),
      logo_url: assertRequiredString(barbearia.logo_url, "barbearia.logo_url"),
    },
    owner: {
      email: normalizeEmail(owner.email, "owner.email"),
      password: assertRequiredString(owner.password, "owner.password"),
      display_name: assertRequiredString(owner.display_name, "owner.display_name"),
      whatsapp: assertRequiredString(owner.whatsapp, "owner.whatsapp"),
    },
    staff_inicial: {
      enabled: Boolean(staff.enabled),
      email: staff.enabled ? normalizeEmail(staff.email, "staff_inicial.email") : null,
      password: staff.enabled
        ? assertRequiredString(staff.password, "staff_inicial.password")
        : null,
      display_name: staff.enabled
        ? assertRequiredString(staff.display_name, "staff_inicial.display_name")
        : null,
      whatsapp: staff.enabled
        ? assertRequiredString(staff.whatsapp, "staff_inicial.whatsapp")
        : null,
    },
  };

  if (
    validated.staff_inicial.enabled &&
    validated.owner.email === validated.staff_inicial.email
  ) {
    const error = new Error("owner.email e staff_inicial.email não podem ser iguais.");
    error.statusCode = 400;
    throw error;
  }

  return validated;
}

async function ensureSlugAvailable(slug) {
  const { data, error } = await supabaseAdmin
    .from("barbearias")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (data) throw buildConflictError("Slug já existe.");
}

async function ensureEmailsAvailableInProfiles(ownerEmail, staffEmail, staffEnabled) {
  const emails = [ownerEmail];
  if (staffEnabled && staffEmail) emails.push(staffEmail);

  const { data, error } = await supabaseAdmin
    .from("admin_profiles")
    .select("email")
    .in("email", emails);

  if (error) throw error;

  const foundEmails = new Set((data || []).map((row) => String(row.email).toLowerCase()));

  if (foundEmails.has(ownerEmail.toLowerCase())) {
    throw buildConflictError("owner.email já existe em admin_profiles.");
  }

  if (staffEnabled && staffEmail && foundEmails.has(staffEmail.toLowerCase())) {
    throw buildConflictError("staff_inicial.email já existe em admin_profiles.");
  }
}

async function ensureEmailsAvailableInAuth(ownerEmail, staffEmail, staffEnabled) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) throw error;

  const users = extractAuthUsers({ data });
  const authEmails = new Set(
    users.map((user) => String(user.email || "").toLowerCase()).filter(Boolean)
  );

  if (authEmails.has(ownerEmail.toLowerCase())) {
    throw buildConflictError("owner.email já existe no Supabase Auth.");
  }

  if (staffEnabled && staffEmail && authEmails.has(staffEmail.toLowerCase())) {
    throw buildConflictError("staff_inicial.email já existe no Supabase Auth.");
  }
}

async function createBarbershop(barbearia) {
  const { data, error } = await supabaseAdmin
    .from("barbearias")
    .insert({
      nome: barbearia.nome,
      slug: barbearia.slug,
      whatsapp: barbearia.whatsapp,
      email: barbearia.email,
      logo_url: barbearia.logo_url,
      ativo: true,
    })
    .select("id, nome, slug, ativo")
    .single();

  if (error) throw error;
  return data;
}

async function deleteBarbershop(barbeariaId) {
  if (!barbeariaId) return;

  await supabaseAdmin
    .from("barbearias")
    .delete()
    .eq("id", barbeariaId);
}

async function createOwnerAuthUser(owner) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: owner.email,
    password: owner.password,
    email_confirm: true,
    user_metadata: {
      display_name: owner.display_name,
      whatsapp: owner.whatsapp,
    },
  });

  if (error) {
    const err = new Error(error.message || "Erro ao criar owner no Auth.");
    err.statusCode = error.status || 400;
    throw err;
  }

  return data.user;
}

export async function createBarbershopOnboarding(payload) {
  const validatedPayload = validatePayload(payload);

  await ensureSlugAvailable(validatedPayload.barbearia.slug);

  await ensureEmailsAvailableInProfiles(
    validatedPayload.owner.email,
    validatedPayload.staff_inicial.email,
    validatedPayload.staff_inicial.enabled
  );

  await ensureEmailsAvailableInAuth(
    validatedPayload.owner.email,
    validatedPayload.staff_inicial.email,
    validatedPayload.staff_inicial.enabled
  );

  let createdBarbershop = null;

  try {
    createdBarbershop = await createBarbershop(validatedPayload.barbearia);
    const ownerUser = await createOwnerAuthUser(validatedPayload.owner);

    return {
      ok: true,
      message: "Barbearia e usuário owner criados com sucesso. Etapa 2 concluída.",
      barbearia: createdBarbershop,
      owner: {
        userId: ownerUser.id,
        email: ownerUser.email,
      },
    };
  } catch (error) {
    if (createdBarbershop?.id) {
      await deleteBarbershop(createdBarbershop.id);
    }
    throw error;
  }
}