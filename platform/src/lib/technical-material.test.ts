import { describe, expect, it, vi, beforeEach } from "vitest";
import { technicalMaterialInput } from "./technical-material";
import { vimeoEmbed } from "./model";
import { ApiError, authenticate } from "./pilot-server";
import { GET, POST, DELETE } from "../app/api/technical-materials/route";
import { POST as UPLOAD } from "../app/api/technical-materials/upload/route";

vi.mock("@/lib/pilot-server", async importOriginal => {
  const actual = await importOriginal<typeof import("./pilot-server")>();
  return { ...actual, authenticate: vi.fn() };
});

const adminUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Administrador",
  email: "admin@demaria.com.br",
  department: "TI",
  manager_id: null,
  role: "admin" as const,
  status: "active" as const,
  audience: "internal" as const,
};

const managerUser = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Gestor",
  email: "gestor@demaria.com.br",
  department: "TI",
  manager_id: null,
  role: "manager" as const,
  status: "active" as const,
  audience: "internal" as const,
};

const studentUser = {
  id: "00000000-0000-4000-8000-000000000003",
  name: "Colaborador",
  email: "colaborador@demaria.com.br",
  department: "Suporte",
  manager_id: null,
  role: "student" as const,
  status: "active" as const,
  audience: "internal" as const,
};

const clientUser = {
  id: "00000000-0000-4000-8000-000000000004",
  name: "Cliente Cartório",
  email: "cliente@cartorio.com.br",
  department: "Cartório",
  manager_id: null,
  role: "student" as const,
  status: "active" as const,
  audience: "client" as const,
};

function createMockDb() {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Manual Teste",
          description: "Descrição de teste para validação.",
          topic: "Selo Digital",
          kind: "manual",
          pdf_path: "technical/pdf/11111111-1111-4111-8111-111111111111.pdf",
          video_url: null,
          created_by: adminUser.id,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        kind: "manual",
        pdf_path: "technical/pdf/11111111-1111-4111-8111-111111111111.pdf",
        video_url: null,
      },
      error: null,
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "22222222-2222-4222-8222-222222222222" },
          error: null,
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });

  const mockStorage = {
    from: vi.fn().mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example.test/signed-pdf-url" },
        error: null,
      }),
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: { token: "signed-upload-token", path: "technical/pdf/test.pdf" },
        error: null,
      }),
      info: vi.fn().mockResolvedValue({
        data: { size: 1024 * 1024, contentType: "application/pdf" },
        error: null,
      }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }),
  };

  return { from: mockFrom, storage: mockStorage };
}

describe("technicalMaterialInput schema", () => {
  it("valida manual com PDF válido", () => {
    const parsed = technicalMaterialInput.safeParse({
      title: "Manual do Selo MA",
      description: "Orientações completas sobre a integração.",
      topic: "Selo Digital MA",
      kind: "manual",
      pdfPath: "technical/pdf/11111111-1111-4111-8111-111111111111.pdf",
      videoUrl: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita manual sem PDF ou com formato inválido de caminho", () => {
    const noPath = technicalMaterialInput.safeParse({
      title: "Manual do Selo MA",
      description: "Orientações completas sobre a integração.",
      topic: "Selo Digital MA",
      kind: "manual",
      pdfPath: null,
      videoUrl: null,
    });
    expect(noPath.success).toBe(false);

    const badPath = technicalMaterialInput.safeParse({
      title: "Manual do Selo MA",
      description: "Orientações completas sobre a integração.",
      topic: "Selo Digital MA",
      kind: "manual",
      pdfPath: "invalid/path.pdf",
      videoUrl: null,
    });
    expect(badPath.success).toBe(false);
  });

  it("valida vídeo com link do Vimeo válido e rejeita vídeo sem URL", () => {
    const valid = technicalMaterialInput.safeParse({
      title: "Vídeo Demonstrativo",
      description: "Apresentação passo a passo do fluxo operacional.",
      topic: "DOC-Fila",
      kind: "video",
      pdfPath: null,
      videoUrl: "https://vimeo.com/123456789",
    });
    expect(valid.success).toBe(true);

    const invalid = technicalMaterialInput.safeParse({
      title: "Vídeo Demonstrativo",
      description: "Apresentação passo a passo do fluxo operacional.",
      topic: "DOC-Fila",
      kind: "video",
      pdfPath: null,
      videoUrl: "https://youtube.com/watch?v=123",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejeita títulos ou descrições fora do tamanho permitido", () => {
    const shortTitle = technicalMaterialInput.safeParse({
      title: "ab",
      description: "Descrição válida e suficiente.",
      topic: "Geral",
      kind: "video",
      pdfPath: null,
      videoUrl: "https://vimeo.com/123456789",
    });
    expect(shortTitle.success).toBe(false);

    const shortDesc = technicalMaterialInput.safeParse({
      title: "Título Válido",
      description: "Curto",
      topic: "Geral",
      kind: "video",
      pdfPath: null,
      videoUrl: "https://vimeo.com/123456789",
    });
    expect(shortDesc.success).toBe(false);
  });
});

describe("vimeoEmbed formatos suportados", () => {
  it("suporta URLs com hash de privacidade e manager", () => {
    expect(vimeoEmbed("https://vimeo.com/987654321/abc123def456")).toBe("https://player.vimeo.com/video/987654321?h=abc123def456");
    expect(vimeoEmbed("https://vimeo.com/987654321?h=abc123def456")).toBe("https://player.vimeo.com/video/987654321?h=abc123def456");
    expect(vimeoEmbed("https://vimeo.com/manage/videos/987654321")).toBe("https://player.vimeo.com/video/987654321");
  });
});

describe("Permissões e rotas de Materiais Técnicos", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.mocked(authenticate).mockReset();
  });

  describe("Audiência cliente (bloqueada)", () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ db: mockDb as any, me: clientUser as any });
    });

    it("bloqueia GET para cliente", async () => {
      const res = await GET(new Request("http://localhost/api/technical-materials"));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/exclusivos da equipe interna/i);
    });

    it("bloqueia POST para cliente", async () => {
      const res = await POST(new Request("http://localhost/api/technical-materials", {
        method: "POST",
        body: JSON.stringify({
          title: "Novo Material",
          description: "Descrição de teste para tentativa de post.",
          topic: "Geral",
          kind: "video",
          pdfPath: null,
          videoUrl: "https://vimeo.com/123456789",
        }),
      }));
      expect(res.status).toBe(403);
    });

    it("bloqueia upload para cliente", async () => {
      const res = await UPLOAD(new Request("http://localhost/api/technical-materials/upload", {
        method: "POST",
        body: JSON.stringify({ name: "manual.pdf", size: 1024 }),
      }));
      expect(res.status).toBe(403);
    });
  });

  describe("Colaborador interno (apenas consulta)", () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ db: mockDb as any, me: studentUser as any });
    });

    it("permite listar materiais", async () => {
      const res = await GET(new Request("http://localhost/api/technical-materials"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.materials).toHaveLength(1);
    });

    it("permite obter URL temporária para leitura", async () => {
      const res = await GET(new Request("http://localhost/api/technical-materials?open=11111111-1111-4111-8111-111111111111"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.url).toBe("https://storage.example.test/signed-pdf-url");
    });

    it("impede colaborador de publicar material", async () => {
      const res = await POST(new Request("http://localhost/api/technical-materials", {
        method: "POST",
        body: JSON.stringify({
          title: "Novo Material",
          description: "Descrição de teste para validação de bloqueio.",
          topic: "Geral",
          kind: "video",
          pdfPath: null,
          videoUrl: "https://vimeo.com/123456789",
        }),
      }));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Somente gestores e administradores/i);
    });

    it("impede colaborador de excluir material", async () => {
      const res = await DELETE(new Request("http://localhost/api/technical-materials?id=11111111-1111-4111-8111-111111111111", {
        method: "DELETE",
      }));
      expect(res.status).toBe(403);
    });

    it("impede colaborador de preparar upload", async () => {
      const res = await UPLOAD(new Request("http://localhost/api/technical-materials/upload", {
        method: "POST",
        body: JSON.stringify({ name: "manual.pdf", size: 1024 }),
      }));
      expect(res.status).toBe(403);
    });
  });

  describe("Gestores e Administradores (edição completa)", () => {
    it("permite a gestor preparar upload e publicar manual", async () => {
      vi.mocked(authenticate).mockResolvedValue({ db: mockDb as any, me: managerUser as any });
      const uploadRes = await UPLOAD(new Request("http://localhost/api/technical-materials/upload", {
        method: "POST",
        body: JSON.stringify({ name: "manual.pdf", size: 5000000 }),
      }));
      expect(uploadRes.status).toBe(200);
      const uploadJson = await uploadRes.json();
      expect(uploadJson.token).toBe("signed-upload-token");

      const createRes = await POST(new Request("http://localhost/api/technical-materials", {
        method: "POST",
        body: JSON.stringify({
          title: "Manual pelo Gestor",
          description: "Descrição completa do manual publicado pelo gestor.",
          topic: "DOC-Fila",
          kind: "manual",
          pdfPath: "technical/pdf/11111111-1111-4111-8111-111111111111.pdf",
          videoUrl: null,
        }),
      }));
      expect(createRes.status).toBe(201);
      const createJson = await createRes.json();
      expect(createJson.id).toBe("22222222-2222-4222-8222-222222222222");
    });

    it("permite a administrador excluir material", async () => {
      vi.mocked(authenticate).mockResolvedValue({ db: mockDb as any, me: adminUser as any });
      const deleteRes = await DELETE(new Request("http://localhost/api/technical-materials?id=11111111-1111-4111-8111-111111111111", {
        method: "DELETE",
      }));
      expect(deleteRes.status).toBe(200);
      const deleteJson = await deleteRes.json();
      expect(deleteJson.ok).toBe(true);
      expect(mockDb.storage.from("academy-technical-pdfs").remove).toHaveBeenCalledWith([
        "technical/pdf/11111111-1111-4111-8111-111111111111.pdf",
      ]);
    });
  });
});
