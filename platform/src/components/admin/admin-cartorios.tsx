"use client";

import { useState } from "react";
import { Building2, Check, CheckSquare, ChevronDown, ChevronUp, Edit3, Key, Layers, Plus, Search, Shield, Square, Trash2, Users, X } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import type { Cartorio } from "@/lib/model";
import { BRAZILIAN_UFS, MODULE_FAMILIES, ALL_MODULES_MAP, formatModuleName } from "@/lib/cartorio-modules";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, newPasswordSchema } from "@/lib/auth-policy";

export function AdminCartorios() {
  const { state, mutate, notify, busy } = useAcademy();
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState("Todos");
  const [editing, setEditing] = useState<Cartorio | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [initialPassword, setInitialPassword] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({
    WIN: true,
    AOL: true,
    WEB: true,
  });

  const cartorios = state.cartorios || [];

  const filtered = cartorios.filter(cart => {
    const matchesSearch =
      search.trim() === "" ||
      `${cart.name} ${cart.city} ${cart.cns || ""} ${cart.keyUserName || ""} ${cart.keyUserEmail || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesUf = ufFilter === "Todos" || cart.uf === ufFilter;
    return matchesSearch && matchesUf;
  });

  const startCreate = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      city: "",
      uf: "SP",
      cns: "",
      modules: [],
      keyUserId: "",
      keyUserName: "",
      keyUserEmail: "",
      status: "active",
      createdAt: new Date().toISOString(),
    });
    setInitialPassword("");
    setIsCreating(true);
  };

  const startEdit = (cart: Cartorio) => {
    setEditing(structuredClone(cart));
    setInitialPassword("");
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditing(null);
    setInitialPassword("");
    setIsCreating(false);
  };

  const toggleModule = (moduleKey: string) => {
    if (!editing) return;
    const current = editing.modules || [];
    const next = current.includes(moduleKey)
      ? current.filter(key => key !== moduleKey)
      : [...current, moduleKey];
    setEditing({ ...editing, modules: next });
  };

  const selectAllInFamily = (familyCode: string) => {
    if (!editing) return;
    const fam = MODULE_FAMILIES.find(f => f.code === familyCode);
    if (!fam) return;
    const famKeys = fam.modules.map(m => `${fam.code}:${m.code}`);
    const otherKeys = (editing.modules || []).filter(k => !k.startsWith(`${familyCode}:`));
    setEditing({ ...editing, modules: [...otherKeys, ...famKeys] });
  };

  const clearAllInFamily = (familyCode: string) => {
    if (!editing) return;
    const otherKeys = (editing.modules || []).filter(k => !k.startsWith(`${familyCode}:`));
    setEditing({ ...editing, modules: otherKeys });
  };

  const toggleFamilyExpand = (familyCode: string) => {
    setExpandedFamilies(prev => ({ ...prev, [familyCode]: !prev[familyCode] }));
  };

  const saveCartorio = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      notify("Informe o nome do cartório.");
      return;
    }
    if (editing.keyUserEmail && !editing.keyUserEmail.includes("@")) {
      notify("Informe um e-mail válido para o usuário-chave.");
      return;
    }
    if (initialPassword && !newPasswordSchema.safeParse(initialPassword).success) {
      notify(`A senha temporária deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    const success = await mutate({
      type: "save-cartorio",
      data: editing,
      initialPassword: initialPassword || undefined,
    });

    if (success) {
      notify("Cartório salvo com sucesso!");
      cancelEdit();
    }
  };

  const removeCartorio = async (cart: Cartorio) => {
    if (!confirm(`Deseja realmente excluir o cadastro do cartório "${cart.name}"?`)) return;
    const success = await mutate({
      type: "delete-cartorio",
      id: cart.id,
    });
    if (success) notify("Cartório excluído com sucesso.");
  };

  return (
    <div className="admin-cartorios">
      {/* Editor Modal / Drawer */}
      {editing && (
        <div className="cartorio-editor-overlay" role="dialog" aria-modal="true">
          <div className="cartorio-editor-modal">
            <header className="cartorio-editor-header">
              <div>
                <h2>{isCreating ? "Cadastrar Novo Cartório" : `Editar: ${editing.name}`}</h2>
                <p>Configure os dados cadastrais, usuário-chave e selecione os módulos contratados.</p>
              </div>
              <button type="button" className="icon-close-btn" onClick={cancelEdit} aria-label="Fechar">
                <X size={20} />
              </button>
            </header>

            <form onSubmit={saveCartorio} className="cartorio-editor-form">
              {/* Dados Principais */}
              <section className="cartorio-form-section">
                <h3>1. Dados da Serventia</h3>
                <div className="form-grid-3">
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>Nome da Serventia / Cartório *</span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Oficial de Registro Civil e Tabelionato de Notas"
                      value={editing.name}
                      onChange={e => setEditing({ ...editing, name: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    <span>UF (Estado) *</span>
                    <select
                      value={editing.uf}
                      onChange={e => setEditing({ ...editing, uf: e.target.value })}
                      required
                    >
                      {BRAZILIAN_UFS.map(uf => (
                        <option key={uf.uf} value={uf.uf}>
                          {uf.uf} — {uf.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-grid-3" style={{ marginTop: 12 }}>
                  <label className="field">
                    <span>Município / Cidade</span>
                    <input
                      type="text"
                      placeholder="Ex: Santos"
                      value={editing.city}
                      onChange={e => setEditing({ ...editing, city: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    <span>Código CNS (opcional)</span>
                    <input
                      type="text"
                      placeholder="Ex: 11.123-4"
                      value={editing.cns || ""}
                      onChange={e => setEditing({ ...editing, cns: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    <span>Situação</span>
                    <select
                      value={editing.status}
                      onChange={e => setEditing({ ...editing, status: e.target.value as "active" | "inactive" })}
                    >
                      <option value="active">Ativo (Acesso Liberado)</option>
                      <option value="inactive">Inativo (Bloqueado)</option>
                    </select>
                  </label>
                </div>
              </section>

              {/* Usuário Chave */}
              <section className="cartorio-form-section" style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3>2. Usuário-Chave da Serventia</h3>
                  <span className="badge-cert-hint">Receberá a Certificação Oficial</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 12px 0" }}>
                  O usuário-chave representa o cartório na plataforma e terá o certificado emitido em seu nome ao concluir os cursos.
                </p>

                <div className="form-grid-3">
                  <label className="field">
                    <span>Nome do Usuário-Chave</span>
                    <input
                      type="text"
                      placeholder="Ex: Maria Helena Souza"
                      value={editing.keyUserName || ""}
                      onChange={e => setEditing({ ...editing, keyUserName: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    <span>E-mail de Acesso (Cartório)</span>
                    <input
                      type="email"
                      placeholder="maria@cartoriosp.com.br"
                      value={editing.keyUserEmail || ""}
                      onChange={e => setEditing({ ...editing, keyUserEmail: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    <span>Senha Inicial / Provisória</span>
                    <input
                      type="password"
                      placeholder={isCreating ? `Defina uma senha (mín. ${MIN_PASSWORD_LENGTH})` : "Deixe em branco p/ manter"}
                      minLength={MIN_PASSWORD_LENGTH}
                      maxLength={MAX_PASSWORD_LENGTH}
                      value={initialPassword}
                      onChange={e => setInitialPassword(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              {/* Matriz de Módulos Contratados */}
              <section className="cartorio-form-section" style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <h3>3. Módulos Contratados</h3>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                      Marque os módulos que o cartório contratou. Os cursos serão liberados automaticamente de acordo com esta seleção.
                    </p>
                  </div>
                  <div className="badge-modules-count">
                    <strong>{editing.modules.length}</strong> módulos selecionados
                  </div>
                </div>

                <div className="families-accordion">
                  {MODULE_FAMILIES.map(family => {
                    const isOpen = expandedFamilies[family.code] ?? false;
                    const famKeys = family.modules.map(m => `${family.code}:${m.code}`);
                    const selectedInFam = famKeys.filter(k => editing.modules.includes(k)).length;
                    const allInFamSelected = selectedInFam === famKeys.length;

                    return (
                      <div key={family.code} className="family-block">
                        <div className="family-header" onClick={() => toggleFamilyExpand(family.code)}>
                          <div className="family-title-wrap">
                            <span className="family-tag">{family.code}</span>
                            <div>
                              <strong>{family.name}</strong>
                              <small>{family.description}</small>
                            </div>
                          </div>

                          <div className="family-actions" onClick={e => e.stopPropagation()}>
                            <span className="family-counter">
                              {selectedInFam} de {famKeys.length}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                allInFamSelected ? clearAllInFamily(family.code) : selectAllInFamily(family.code)
                              }
                            >
                              {allInFamSelected ? "Desmarcar todos" : "Marcar todos"}
                            </Button>
                            <button
                              type="button"
                              className="accordion-toggle-btn"
                              onClick={() => toggleFamilyExpand(family.code)}
                            >
                              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="modules-checkbox-grid">
                            {family.modules.map(mod => {
                              const key = `${family.code}:${mod.code}`;
                              const isChecked = editing.modules.includes(key);

                              return (
                                <button
                                  type="button"
                                  key={key}
                                  className={`module-tile ${isChecked ? "is-selected" : ""}`}
                                  onClick={() => toggleModule(key)}
                                  aria-pressed={isChecked}
                                >
                                  <div className="module-tile-check">
                                    {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                  </div>
                                  <div className="module-tile-code">[{mod.code}]</div>
                                  <div className="module-tile-name">{mod.name}</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Botões do Rodapé */}
              <footer className="cartorio-editor-footer">
                <Button type="button" variant="ghost" onClick={cancelEdit} disabled={busy}>
                  Cancelar
                </Button>
                <Button type="submit" variant="default" disabled={busy}>
                  {busy ? "Salvando…" : isCreating ? "Cadastrar Cartório" : "Salvar Alterações"}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <div className="cartorios-top-bar">
        <div className="cartorios-search-wrap">
          <div className="field-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Buscar por nome, município, CNS ou usuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="select-standalone"
            value={ufFilter}
            onChange={e => setUfFilter(e.target.value)}
            aria-label="Filtrar por UF"
          >
            <option value="Todos">Todas as UFs</option>
            {BRAZILIAN_UFS.map(uf => (
              <option key={uf.uf} value={uf.uf}>
                {uf.uf} — {uf.name}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={startCreate} variant="default">
          <Plus size={16} /> Cadastrar Cartório
        </Button>
      </div>

      {/* Cartorios List */}
      <div className="cartorios-list-wrap">
        {filtered.length > 0 ? (
          <div className="cartorios-grid">
            {filtered.map(cart => (
              <div key={cart.id} className="panel cartorio-card">
                <div className="cartorio-card-header">
                  <span className="uf-badge">{cart.uf}</span>
                  <div className="cartorio-card-title">
                    <h3>{cart.name}</h3>
                    <small>
                      {cart.city ? `${cart.city} · ` : ""}
                      {cart.cns ? `CNS: ${cart.cns} · ` : ""}
                      <span className={`status-pill ${cart.status}`}>{cart.status === "active" ? "Ativo" : "Inativo"}</span>
                    </small>
                  </div>
                </div>

                <div className="cartorio-card-body">
                  <div className="cartorio-info-row">
                    <span className="info-icon">
                      <Key size={14} />
                    </span>
                    <div>
                      <strong>{cart.keyUserName || "Usuário-chave não definido"}</strong>
                      <small>{cart.keyUserEmail || "E-mail pendente"}</small>
                    </div>
                  </div>

                  <div className="cartorio-info-row" style={{ marginTop: 10 }}>
                    <span className="info-icon">
                      <Layers size={14} />
                    </span>
                    <div>
                      <strong>{cart.modules.length} módulos contratados</strong>
                      <div className="cartorio-modules-chips">
                        {cart.modules.slice(0, 6).map(modKey => (
                          <span key={modKey} className="module-chip">
                            {modKey}
                          </span>
                        ))}
                        {cart.modules.length > 6 && (
                          <span className="module-chip-more">+{cart.modules.length - 6}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cartorio-card-footer">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(cart)}>
                    <Edit3 size={14} /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeCartorio(cart)} title="Excluir cartório">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum cartório encontrado"
            description="Cadastre um novo cartório parceiro para configurar os módulos contratados e liberar os cursos de certificação."
          >
            <Button onClick={startCreate} variant="secondary">
              <Plus size={16} /> Cadastrar Primeiro Cartório
            </Button>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
