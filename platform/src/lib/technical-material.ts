import { z } from "zod";
import { vimeoEmbed } from "./model";

export const technicalMaterialInput = z.strictObject({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(600),
  topic: z.string().trim().min(2).max(80),
  kind: z.enum(["manual", "video"]),
  pdfPath: z.string().regex(/^technical\/pdf\/[a-f0-9-]+\.pdf$/).nullable(),
  videoUrl: z.string().trim().max(500).nullable(),
}).superRefine((item, context) => {
  if (item.kind === "manual" && (!item.pdfPath || item.videoUrl)) context.addIssue({ code: "custom", path: ["pdfPath"], message: "Anexe um PDF para o manual." });
  if (item.kind === "video" && (!item.videoUrl || !vimeoEmbed(item.videoUrl) || item.pdfPath)) context.addIssue({ code: "custom", path: ["videoUrl"], message: "Informe um link HTTPS válido do Vimeo." });
});

export type TechnicalMaterial = z.infer<typeof technicalMaterialInput> & {
  id: string;
  createdAt: string;
  createdBy: string | null;
};
