import { z } from "zod";
import { type AcademyState, type Course, type Person } from "./model";
import { isCourseComplete } from "./rewards";
import { isManagedPerson } from "./reports/scope";

const days = z.number().int().min(0).max(365);
export const alertPolicySchema = z.object({
  popup: z.boolean().default(true), email: z.boolean().default(false), discord: z.boolean().default(false),
  discordWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]),
  learnerDays: days.default(7), managerDays: days.default(2),
  repeatDays: z.number().int().min(1).max(90).default(7),
  inactivityDays: z.number().int().min(1).max(365).default(30),
  lowAccessEnabled: z.boolean().default(false),
  lowAccessWindow: z.number().int().min(7).max(90).default(30),
  lowAccessMinDays: z.number().int().min(1).max(90).default(3),
  inactivityEnabled: z.boolean().default(true), resumeEnabled: z.boolean().default(true),
}).strict().refine(p => p.lowAccessMinDays <= p.lowAccessWindow, "A frequência mínima deve caber no período.");
export type AlertPolicy = z.infer<typeof alertPolicySchema>;
export const DEFAULT_ALERT_POLICY = alertPolicySchema.parse({});
const courseIds = z.array(z.string().min(1).max(100)).min(1).max(100).refine(ids => new Set(ids).size === ids.length);
export const trailSchema = z.object({
  id: z.uuid(), title: z.string().trim().min(3).max(120), description: z.string().trim().max(2000),
  purpose: z.enum(["onboarding", "development"]), department: z.string().max(100),
  courseIds, active: z.boolean(),
}).strict();
export type Trail = z.infer<typeof trailSchema> & { ownerId: string; revision: number };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const stamp = new Date(value + "T12:00:00Z");
  return Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 10) === value;
}, "Data inválida.");
export const trailCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("save"), trail: trailSchema, expectedRevision: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("assign"), requestId: z.uuid(), trailId: z.uuid(), userIds: z.array(z.uuid()).min(1).max(200).refine(ids => new Set(ids).size === ids.length), dueDate: date, learnerDays: days, managerDays: days }).strict(),
  z.object({ type: z.literal("assignment"), id: z.uuid(), expectedRevision: z.number().int().positive(), dueDate: date, learnerDays: days, managerDays: days, active: z.boolean() }).strict(),
  z.object({ type: z.literal("policy"), policy: alertPolicySchema, expectedRevision: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("ack"), id: z.uuid() }).strict(),
  z.object({ type: z.literal("announce"), requestId: z.uuid(), userIds: z.array(z.uuid()).min(1).max(200), title: z.string().trim().min(3).max(120), message: z.string().trim().min(3).max(2000), popup: z.boolean() }).strict(),
]);
export type TrailCommand = z.infer<typeof trailCommandSchema>;
export type Assignment = {
  id: string; trailId: string; userId: string; assignedBy: string; title: string; courseIds: string[];
  dueDate: string; learnerDays: number; managerDays: number; active: boolean; revision: number; createdAt: string;
  completedCourses: number; totalCourses: number; progress: number; complete: boolean;
};
export type TrailNotice = {
  id: string; userId: string; subjectId: string; assignmentId: string | null; kind: string;
  title: string; message: string; link: string; popup: boolean; createdAt: string; seenAt: string | null;
  resolvedAt: string | null; emailStatus: "disabled" | "pending" | "sending" | "sent" | "failed" | "cancelled" | "uncertain";
  emailError: string | null; emailSentAt: string | null;
  discordStatus?: string; discordError?: string | null; discordSentAt?: string | null; discordConfirmedAt?: string | null;
};
export type TrailsData = { trails: Trail[]; assignments: Assignment[]; notices: TrailNotice[]; policy: AlertPolicy; policyRevision: number; emailConfigured: boolean };
export function canManagePerson(actor: Pick<Person, "id" | "role" | "department"> & Partial<Pick<Person, "status" | "audience">>, target: Pick<Person, "id" | "managerId" | "department" | "status" | "audience">) {
  return isManagedPerson({ ...actor, status: actor.status ?? "active" }, target);
}
export function trailCompletion(ids: string[], courses: Course[], state: AcademyState, userId: string) {
  const completedCourses = ids.filter(id => {
    const course = courses.find(c => c.id === id);
    return !!course && isCourseComplete(course, state, userId);
  }).length;
  return { completedCourses, totalCourses: ids.length, progress: ids.length ? Math.round(completedCourses / ids.length * 100) : 0, complete: ids.length > 0 && completedCourses === ids.length };
}
export function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function daysUntil(date: string, today = localDay()) {
  return Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
}
export function deadlineKind(assignment: Pick<Assignment, "active" | "complete" | "dueDate" | "learnerDays" | "managerDays">, manager: boolean, today = localDay()) {
  if (!assignment.active || assignment.complete) return null;
  const remaining = daysUntil(assignment.dueDate, today);
  return remaining < 0 ? "overdue" : remaining <= (manager ? assignment.managerDays : assignment.learnerDays) ? "deadline" : null;
}
export const formatTrailDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value + "T12:00:00Z"));
