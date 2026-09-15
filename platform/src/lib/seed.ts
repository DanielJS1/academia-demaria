import type { AcademyState, Course, Lesson } from "./model";
const intro = "Esta é uma atividade de demonstração para validar a experiência da DOC-Academy. O conteúdo técnico será cadastrado e revisado pela DeMaria antes da publicação oficial.\n\nNa versão de apresentação, você pode experimentar a sequência de aulas, marcar uma leitura como concluída e enviar uma avaliação de exemplo. Seu progresso fica apenas neste navegador.";
const lessons = (prefix: string): Lesson[] => [
  { id: `${prefix}-1`, title: "Boas-vindas à jornada", module: "01 · Comece por aqui", minutes: 4, type: "reading", content: intro, videoUrl: "" },
  { id: `${prefix}-2`, title: "Conhecendo o ambiente", module: "01 · Comece por aqui", minutes: 8, type: "video", content: "Espaço reservado para um vídeo da DeMaria. Vincule um link do Vimeo pelo editor do curso.", videoUrl: "" },
  { id: `${prefix}-3`, title: "Conceitos e possibilidades", module: "02 · Conhecimento na prática", minutes: 10, type: "reading", content: intro, videoUrl: "" },
  { id: `${prefix}-4`, title: "Da teoria à prática", module: "02 · Conhecimento na prática", minutes: 12, type: "video", content: "Esta aula receberá o conteúdo oficial do produto. A conclusão manual está disponível somente para experimentar esta demonstração.", videoUrl: "" },
  { id: `${prefix}-5`, title: "Consolide seu aprendizado", module: "03 · Próximo nível", minutes: 5, type: "quiz", content: "Avaliação de exemplo sobre a experiência da plataforma, sem conteúdo técnico de produto.", videoUrl: "" },
];
const base: Omit<Course, "id" | "title" | "description" | "product" | "accent" | "lessons"> = {
  category: "Produtos", level: "Essencial", status: "published", xp: 420, required: false, banner: "", author: "Equipe DOC-Academy", passingScore: 70, retryPolicy: "free", version: 1,
  questions: [
    { id: "q1", prompt: "Onde você encontra a sequência de aulas nesta demonstração?", type: "choice", options: ["No programa do curso, ao lado da atividade", "Somente no painel administrativo", "A sequência não está disponível"], correct: "No programa do curso, ao lado da atividade" },
    { id: "q2", prompt: "O que tornaria esta experiência de aprendizado mais útil no seu dia a dia?", type: "text", options: [], correct: "" },
  ],
};
export const initialState: AcademyState = {
  schema: 1,
  courseDrafts: [], articleDrafts: [],
  courses: [
    { ...base, id: "doc-windows", title: "Primeiros passos com o DOC-Windows", description: "Uma jornada para conhecer o produto e construir uma base sólida para o dia a dia.", product: "DOC-Windows", accent: "violet", required: true, lessons: lessons("win") },
    { ...base, id: "multiscan", title: "Digitalização com propósito", description: "Organize seu aprendizado sobre o DOC-MultiScan, do primeiro contato à prática.", product: "DOC-MultiScan", accent: "mint", xp: 360, lessons: lessons("scan") },
    { ...base, id: "atendimento", title: "Atendimento que gera confiança", description: "Comunicação, escuta e conhecimento para uma experiência de atendimento melhor.", product: "Conhecimentos gerais", category: "Desenvolvimento", accent: "peach", xp: 280, lessons: lessons("service") },
    { ...base, id: "rotinas", title: "O universo dos cartórios", description: "Uma introdução aos temas e rotinas que fazem parte do nosso trabalho.", product: "Conhecimentos gerais", category: "Cartórios", accent: "blue", xp: 320, lessons: lessons("cart") },
    { ...base, id: "seguranca", title: "Cuidado com a informação", description: "Um espaço para aprender boas práticas e aprofundar o cuidado com os dados.", product: "Conhecimentos gerais", category: "Desenvolvimento", accent: "pink", xp: 240, lessons: lessons("sec") },
    { ...base, id: "atualizacoes", title: "Sempre em evolução", description: "Uma trilha de atualização contínua para acompanhar novas possibilidades.", product: "DOC-Windows", level: "Intermediário", accent: "slate", xp: 380, lessons: lessons("up") },
  ],
  articles: [
    { id: "como-consultar", title: "Como consultar a base de conhecimento", product: "DOC-Academy", category: "Guia da plataforma", status: "published", revision: 1, updatedAt: "2026-09-14", author: "Equipe DOC-Academy", content: "Nesta demonstração, todos os colaboradores podem consultar os artigos publicados. Use a pesquisa por título, produto ou palavras do conteúdo.\n\nAo abrir um artigo, você encontra o responsável, a data de atualização e a versão publicada. A consulta assistida por IA será conectada na etapa de integração; a busca disponível aqui é textual.\n\nEste artigo descreve a demonstração da plataforma. Não é um manual de produto ou uma orientação técnica de cartório." },
    { id: "sua-jornada", title: "Entenda sua jornada de aprendizado", product: "DOC-Academy", category: "Aprendizado", status: "published", revision: 1, updatedAt: "2026-09-14", author: "Equipe DOC-Academy", content: "A área Aprender reúne os cursos publicados. Cada curso tem uma página com objetivo e programa de atividades.\n\nVocê pode salvar um curso para depois e continuar suas atividades na sala de aula. Aulas concluídas e aprovação na avaliação são estados separados.\n\nNesta apresentação, o progresso é demonstrativo e fica salvo neste navegador. Nenhum certificado oficial é emitido." },
    { id: "novas-conquistas", title: "Uma nova temporada, novas conquistas", product: "DOC-Academy", category: "Conquistas", status: "published", revision: 1, updatedAt: "2026-09-14", author: "Equipe DOC-Academy", content: "O desenho de gamificação diferencia trajetória acumulada e participação em cada temporada anual. As conquistas anteriores permanecem no histórico.\n\nOs valores de XP e as faixas desta demonstração são ilustrativos. A calibragem oficial será feita conforme o conteúdo disponível.\n\nAs estatísticas e pessoas exibidas no ranking são exemplos para validar a interface." },
  ],
  departments: ["Comercial", "Financeiro"], products: ["DOC-Windows", "DOC-MultiScan", "Conhecimentos gerais", "DOC-Academy"],
  people: [
    { id: "daniel", name: "Daniel", email: "daniel@example.com", department: "Comercial", managerId: "daniel", role: "admin", status: "active", xp: 1320, progress: 50 },
    { id: "ana", name: "Ana Martins", email: "ana@example.com", department: "Comercial", managerId: "daniel", role: "student", status: "active", xp: 2860, progress: 88 },
    { id: "lucas", name: "Lucas Oliveira", email: "lucas@example.com", department: "Comercial", managerId: "daniel", role: "student", status: "active", xp: 2540, progress: 75 },
    { id: "mariana", name: "Mariana Costa", email: "mariana@example.com", department: "Financeiro", managerId: "mariana", role: "manager", status: "active", xp: 2280, progress: 68 },
    { id: "pedro", name: "Pedro Santos", email: "pedro@example.com", department: "Financeiro", managerId: "mariana", role: "student", status: "active", xp: 1950, progress: 61 },
    { id: "julia", name: "Júlia Lima", email: "julia@example.com", department: "Comercial", managerId: "daniel", role: "student", status: "active", xp: 1680, progress: 54 },
  ],
  completed: { "doc-windows": ["win-1", "win-2"], "multiscan": ["scan-1"] }, bookmarks: ["atendimento"], attempts: [],
  xpEvents: [{ id: "demo-start", amount: 1320, season: "2026", label: "Trajetória ilustrativa" }], readNotices: [], notifications: [],
};
