"use client";

import { useState } from "react";
import { ListChecks, SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { QuestionStudioModal, type StudioQuestion } from "../editors/question-studio-modal";
import { fromStudioQuestions, toStudioQuestions, type PeriodicQuizQuestion } from "@/lib/periodic-quiz-studio";

export function PeriodicQuizQuestions({ title, questions, onChange }: {
  title: string; questions: PeriodicQuizQuestion[]; onChange: (questions: PeriodicQuizQuestion[]) => void;
}) {
  const [studio, setStudio] = useState<StudioQuestion[] | null>(null);
  const [initialIndex, setInitialIndex] = useState(0);
  const open = (index = 0) => { setInitialIndex(index); setStudio(toStudioQuestions(questions)); };
  return <section className="admin-quiz-studio" aria-label="Perguntas e gabarito">
    <div className="admin-quiz-questions-head"><div><h4><ListChecks size={18} aria-hidden="true"/> Question Studio</h4>
      <p>{questions.length} perguntas · escolha única · correção automática</p></div>
      <Button type="button" variant="secondary" onClick={() => open()}><SlidersHorizontal size={16} aria-hidden="true"/> Abrir Question Studio</Button>
    </div>
    <p>Edite uma pergunta por vez, marque o gabarito nas alternativas e inclua a explicação para o aluno.</p>
    <div className="admin-quiz-studio-preview">{questions.map((question, index) => <button type="button" key={index} onClick={() => open(index)}>
      <strong>Q{index + 1}</strong><span>{question.prompt || "Adicionar enunciado"}</span>
    </button>)}</div>
    <p>Depois de aplicar as perguntas no Studio, clique em <strong>Salvar desafio</strong>.</p>
    {studio && <QuestionStudioModal title={title || "Novo desafio"} variant="challenge" questions={studio} initialIndex={initialIndex}
      onChange={items => onChange(fromStudioQuestions(items))} onClose={() => setStudio(null)}/>}
  </section>;
}
