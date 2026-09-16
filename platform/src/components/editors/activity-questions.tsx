"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import type { Course } from "@/lib/model";
export function ActivityQuestions({questions,onChange}:{questions:Course["questions"];onChange:(value:Course["questions"])=>void}){
return <section aria-label="Perguntas desta avaliação"><h3>Perguntas desta avaliação</h3>
<Button variant="secondary" onClick={()=>onChange([...questions,{id:crypto.randomUUID(),prompt:"Nova pergunta",type:"choice",options:["",""],correct:""}])}><Plus size={14}/> Adicionar pergunta</Button>
            {questions.map((question, index) => (
              <div className="editor-lesson" key={question.id}>
                <div className="editor-lesson-head">
                  <strong>Pergunta {index + 1}</strong>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover pergunta ${index + 1}`}
                      onClick={() => onChange(questions.filter(item => item.id !== question.id))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </span>
                </div>
                <label className="field">
                  <span>Enunciado</span>
                  <textarea
                    value={question.prompt}
                    rows={2}
                    onChange={event =>
                      onChange(questions.map(item => (item.id === question.id ? { ...item, prompt: event.target.value } : item))
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Tipo de resposta</span>
                  <select
                    value={question.type}
                    onChange={event =>
                      onChange(questions.map(item =>
                          item.id === question.id ? { ...item, type: event.target.value as "choice" | "text" } : item
                        )
                      )
                    }
                  >
                    <option value="choice">Múltipla escolha</option>
                    <option value="text">Discursiva</option>
                  </select>
                </label>
                {question.type === "choice" && (
                  <>
                    <label className="field">
                      <span>Alternativas (uma por linha)</span>
                      <textarea
                        rows={3}
                        value={question.options.join("\n")}
                        onChange={event =>
                          onChange(questions.map(item =>
                              item.id === question.id
                                ? { ...item, options: event.target.value.split("\n"), correct: "" }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Resposta correta</span>
                      <select
                        value={question.correct}
                        onChange={event =>
                          onChange(questions.map(item =>
                              item.id === question.id ? { ...item, correct: event.target.value } : item
                            )
                          )
                        }
                      >
                        <option value="">Selecione o gabarito</option>
                        {question.options
                          .filter(option => option.trim())
                          .map((option, optionIndex) => (
                            <option key={optionIndex}>{option}</option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
            ))}
</section>;
}
