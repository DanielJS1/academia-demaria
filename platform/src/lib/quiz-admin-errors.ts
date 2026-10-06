import { randomUUID } from "node:crypto";
import { ApiError } from "./api-error";

type DatabaseError = { code?: string; message?: string; details?: string; hint?: string };
type Diagnosis = { code: string; message: string; details: string | null };

class QuizAdminError extends ApiError {
  constructor(message: string, status: number, public code: string, public diagnosis: Diagnosis, public operation: string) {
    super(message, status);
  }
}

export function quizAdminDatabaseError(error: DatabaseError, operation: string): ApiError {
  // Raw database messages/details can contain submitted values. Log only recognized classifications.
  const databaseCode = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error.code ?? "") ? error.code! : "UNKNOWN";
  const business = error.code === "P0001" ? error.details : undefined;
  const legacy = error.code === "P0001" ? error.message : undefined;
  let status = 500, code = "QUIZ_INTERNAL_ERROR", message = "Ocorreu um erro interno ao acessar os desafios.";
  if (business === "QUIZ_FORBIDDEN" || legacy === "Apenas administradores internos podem editar desafios"
    || legacy === "Apenas administradores internos podem excluir desafios" || error.code === "42501") {
    status = 403; code = "QUIZ_FORBIDDEN"; message = "Você não tem permissão para acessar esta operação dos desafios.";
  } else if (business === "QUIZ_NOT_FOUND" || legacy === "Desafio não encontrado") {
    status = 404; code = "QUIZ_NOT_FOUND"; message = "Desafio não encontrado. Atualize a lista e tente novamente.";
  } else if (business === "QUIZ_ALREADY_ANSWERED" || legacy === "Desafio já respondido: crie uma nova edição para alterar perguntas") {
    status = 409; code = "QUIZ_ALREADY_ANSWERED";
    message = "Este desafio já tem respostas e não pode ser editado. Crie uma nova edição.";
  } else if (business === "QUIZ_AUDIENCE_LOCKED") {
    status = 409; code = "QUIZ_AUDIENCE_LOCKED";
    message = "O público de uma edição já publicada não pode ser alterado. Crie uma nova edição.";
  } else if (business === "QUIZ_CONTENT_LOCKED") {
    status = 409; code = "QUIZ_CONTENT_LOCKED";
    message = "Este desafio já tem respostas. Para alterar perguntas, gabarito ou público, crie uma nova edição.";
  } else if (business === "QUIZ_REVISION_CONFLICT") {
    status = 409; code = "QUIZ_REVISION_CONFLICT";
    message = "As regras deste desafio foram alteradas. Recarregue os dados e confira a nota mínima e o prêmio antes de continuar.";
  } else if (business === "QUIZ_INVALID_ANSWERS") {
    status = 400; code = "QUIZ_INVALID_ANSWERS"; message = "Responda todas as perguntas com alternativas válidas.";
  } else if (legacy === "Desafio excluído não pode ser alterado") {
    status = 409; code = "QUIZ_DELETED"; message = "Este desafio foi excluído e não pode ser alterado.";
  } else if (error.code === "23505") {
    status = 409; code = "QUIZ_CONFLICT"; message = "Já existe um desafio com esse identificador ou destaque. Atualize os dados e tente novamente.";
  } else if (business === "QUIZ_INVALID_DATA" || business === "QUIZ_INVALID_QUESTIONS"
    || legacy === "Dados do desafio inválidos" || legacy === "Alternativas ou gabarito inválidos") {
    status = 400; code = "QUIZ_INVALID_DATA"; message = "Revise os dados, as alternativas e o gabarito do desafio.";
  } else if (["PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    status = 503; code = "QUIZ_SCHEMA_UNAVAILABLE"; message = "O cadastro de desafios está indisponível. A configuração do banco precisa ser verificada pela administração.";
  } else if (/^(?:08|53)/.test(error.code ?? "") || ["PGRST000", "PGRST001", "PGRST002", "PGRST003"].includes(error.code ?? "")) {
    status = 503; code = "QUIZ_UNAVAILABLE"; message = "O serviço de desafios está temporariamente indisponível. Tente novamente em alguns instantes.";
  }
  return new QuizAdminError(message, status, code, {
    code: databaseCode,
    message: error.code === "42P01" ? "Referência SQL inválida ou relação ausente." : message,
    details: code === "QUIZ_INTERNAL_ERROR" ? null : code,
  }, operation);
}

export function quizAdminFailure(error: unknown) {
  const requestId = randomUUID();
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof QuizAdminError ? error.code
    : ({ 400: "INVALID_DATA", 401: "SESSION_REQUIRED", 403: "FORBIDDEN", 413: "PAYLOAD_TOO_LARGE", 503: "SERVICE_UNAVAILABLE" } as Record<number, string>)[status] ?? "INTERNAL_ERROR";
  if (error instanceof QuizAdminError || status >= 500) {
    console.error("[quizzes/manage]", {
      requestId, operation: error instanceof QuizAdminError ? error.operation : "request", status,
      ...(error instanceof QuizAdminError ? error.diagnosis : { code, message: "Falha na solicitação de administração de desafios.", details: null }),
    });
  }
  const message = error instanceof ApiError ? error.message : "Ocorreu um erro interno ao acessar os desafios.";
  return Response.json({ error: status >= 500 ? `${message} Referência: ${requestId}.` : message, code, requestId },
    { status, headers: { "Cache-Control": "no-store, private", "X-Request-Id": requestId } });
}
