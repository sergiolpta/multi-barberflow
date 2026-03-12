import { useEffect, useMemo, useState } from "react";
import { AdminAgenda } from "./components/admin/AdminAgenda";
import { AdminLogin } from "./components/admin/AdminLogin";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { AdminServicos } from "./components/admin/AdminServicos";
import { AdminProfissionais } from "./components/admin/AdminProfissionais";
import { AdminPacotes } from "./components/admin/AdminPacotes";
import { AdminFinanceiro } from "./components/admin/AdminFinanceiro";
import { AdminProdutos } from "./components/admin/AdminProdutos";
import { AdminVendas } from "./components/admin/AdminVendas";
import { apiFetch } from "./config/api";

const THEME_STORAGE_KEY = "barberflow_admin_theme";

function resolveThemeClass(temaAdmin) {
  if (temaAdmin === "light") return "theme-light";

  if (temaAdmin === "system") {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "theme-light";
    }
    return "theme-dark";
  }

  return "theme-dark";
}

function getStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "";
  } catch {
    return "";
  }
}

function getThemePreferenceLabel(theme) {
  return theme === "light" ? "Light" : "Dark";
}

function HomeCard({ title, description, accent = "default", onClick }) {
  const accentMap = {
    default: "from-slate-500/20 to-transparent text-[var(--text-app)]",
    sky: "from-sky-500/20 to-transparent text-sky-600",
    emerald: "from-emerald-500/20 to-transparent text-emerald-700",
    violet: "from-violet-500/20 to-transparent text-violet-700",
    amber: "from-amber-500/20 to-transparent text-amber-700",
  };

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 text-left shadow-[var(--shadow-panel)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--bg-panel-strong)]"
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentMap[accent] || accentMap.default}`}
      />
      <div className="relative">
        <h2 className="mb-2 text-base font-bold text-[var(--text-app)]">{title}</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
        <div className="mt-4 text-[11px] font-medium text-[var(--text-soft)] transition group-hover:text-[var(--text-app)]">

        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [modoAdmin, setModoAdmin] = useState("adminHome");
  const [profissionais, setProfissionais] = useState([]);
  const [temaPreferido, setTemaPreferido] = useState(() => getStoredTheme());

  const {
    user,
    accessToken,
    adminRole,
    adminBarbeariaId,
    adminBarbeariaNome,
    adminBarbeariaLogoUrl,
    adminBarbeariaTemaAdmin,
    loading: loadingAuth,
    erro: authError,
    login,
    logout,
  } = useAdminAuth();

  const temaEfetivo = useMemo(() => {
    return temaPreferido || adminBarbeariaTemaAdmin || "dark";
  }, [temaPreferido, adminBarbeariaTemaAdmin]);

  useEffect(() => {
    const html = document.documentElement;
    const themeClass = resolveThemeClass(temaEfetivo);

    html.classList.remove("theme-dark", "theme-light");
    html.classList.add(themeClass);

    return () => {
      html.classList.remove("theme-dark", "theme-light");
    };
  }, [temaEfetivo]);

  useEffect(() => {
    async function carregarProfissionais() {
      if (!accessToken || !user) {
        setProfissionais([]);
        return;
      }

      try {
        const data = await apiFetch("/profissionais/admin", {
          accessToken,
          method: "GET",
        });

        setProfissionais(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.profissionais)
            ? data.profissionais
            : []
        );
      } catch (err) {
        console.error("Erro ao carregar profissionais:", err);
        setProfissionais([]);
      }
    }

    carregarProfissionais();
  }, [accessToken, user]);

  function alternarTema() {
    const proximoTema = resolveThemeClass(temaEfetivo) === "theme-light" ? "dark" : "light";

    try {
      localStorage.setItem(THEME_STORAGE_KEY, proximoTema);
    } catch {
      // ignore
    }

    setTemaPreferido(proximoTema);
  }

  function limparTemaPreferido() {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // ignore
    }

    setTemaPreferido("");
  }

  const isOwner = adminRole === "admin_owner";
  const podeProdutosEVendas = ["admin_owner", "admin_staff"].includes(adminRole);

  const resumoPermissao = useMemo(() => {
    if (adminRole === "admin_owner") {
      return "Acesso completo ao painel, financeiro, equipe, agenda, estoque e vendas.";
    }

    if (adminRole === "admin_staff") {
      return "Acesso operacional para agenda, serviços, produtos e vendas.";
    }

    return "Acesso administrativo limitado conforme o perfil configurado.";
  }, [adminRole]);

  const temaAtualLabel = getThemePreferenceLabel(
    resolveThemeClass(temaEfetivo) === "theme-light" ? "light" : "dark"
  );

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] text-[var(--text-app)]">
        <p className="text-sm text-[var(--text-muted)]">Verificando sessão...</p>
      </div>
    );
  }

  if (!user) {
    async function handleLogin(email, senha) {
      await login(email, senha);
    }

    return <AdminLogin onLogin={handleLogin} loading={loadingAuth} erro={authError} />;
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-app)] text-[var(--text-app)]">
        <div className="w-full max-w-xl space-y-4">
          <div className="rounded-2xl border border-red-700/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-600">
              Falha na autenticação/permissões:{" "}
              <span className="font-semibold">{authError}</span>
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Verifique o backend (/me), o token e a role do usuário em user_roles.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                await logout();
              }}
              className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-600 transition hover:bg-red-500/10"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modoAdmin === "adminHome") {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] px-4 py-4 text-[var(--text-app)] md:py-6 lg:py-8">
        <div className="mx-auto w-full max-w-7xl">
          <header className="mb-4 overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl md:mb-6">
            <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500" />
            <div className="flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                {adminBarbeariaLogoUrl ? (
                  <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-3 shadow-xl shadow-black/10">
                    <img
                      src={adminBarbeariaLogoUrl}
                      alt={adminBarbeariaNome || "Logo da barbearia"}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-sky-500/10 text-3xl">
                    💈
                  </div>
                )}

                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                    Painel administrativo
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                    {adminBarbeariaNome || "Área administrativa"}
                  </h1>

                  <p className="mt-2 text-sm text-[var(--text-muted)] md:text-[15px]">
                    Bem-vindo ao centro de operação da barbearia. Escolha o módulo que deseja gerenciar.
                  </p>

                  <div className="mt-3 space-y-1 text-[12px] text-[var(--text-muted)]">
                    <p>
                      Usuário:{" "}
                      <span className="font-medium text-[var(--text-app)]">{user?.email}</span>
                    </p>
                    <p>
                      Perfil:{" "}
                      <span className="font-medium text-[var(--text-app)]">{adminRole || "—"}</span>
                    </p>
                    <p>{resumoPermissao}</p>
                    <p>
                      
                      <span className="font-medium text-[var(--text-app)]">{temaAtualLabel}</span>
                      
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={alternarTema}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-panel)]"
                  >
                    Alternar para {temaAtualLabel === "Light" ? "Dark" : "Light"}
                  </button>

                  {temaPreferido ? (
                    <button
                      onClick={limparTemaPreferido}
                      className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
                    >
                      Usar padrão da barbearia
                    </button>
                  ) : null}
                </div>

                <button
                  onClick={async () => {
                    await logout();
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-500/15"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <HomeCard
              title="Agenda do dia"
              description="Visualize compromissos, bloqueios, pacotes e faça ajustes operacionais em tempo real."
              accent="emerald"
              onClick={() => setModoAdmin("agenda")}
            />

            {isOwner && (
              <HomeCard
                title="Financeiro"
                description="Acompanhe resultados, fechamento, despesas, adiantamentos e indicadores do período."
                accent="emerald"
                onClick={() => setModoAdmin("financeiro")}
              />
            )}

            <HomeCard
              title="Serviços"
              description="Cadastre, edite e organize o catálogo de serviços da barbearia."
              accent="sky"
              onClick={() => setModoAdmin("servicos")}
            />

            <HomeCard
              title="Profissionais"
              description="Gerencie equipe, status, comissões base e regras específicas por serviço."
              accent="violet"
              onClick={() => setModoAdmin("profissionais")}
            />

            <HomeCard
              title="Pacotes fixos"
              description="Controle clientes recorrentes, horários reservados e cobrança mensal dos pacotes."
              accent="sky"
              onClick={() => setModoAdmin("pacotes")}
            />

            {podeProdutosEVendas && (
              <HomeCard
                title="Produtos"
                description="Controle estoque, preços e ativação dos produtos vendidos no balcão."
                accent="amber"
                onClick={() => setModoAdmin("produtos")}
              />
            )}

            {podeProdutosEVendas && (
              <HomeCard
                title="Vendas (PDV)"
                description="Registre vendas rápidas, dê baixa no estoque e aplique comissão por profissional."
                accent="emerald"
                onClick={() => setModoAdmin("vendas")}
              />
            )}
          </section>
        </div>
      </div>
    );
  }

  if (modoAdmin === "agenda") {
    return (
      <AdminAgenda
        profissionais={profissionais}
        accessToken={accessToken}
        barbeariaNome={adminBarbeariaNome || undefined}
        barbeariaLogoUrl={adminBarbeariaLogoUrl || undefined}
        adminRole={adminRole}
        onVoltar={() => setModoAdmin("adminHome")}
        onIrPacotes={() => setModoAdmin("pacotes")}
        onIrFinanceiro={() => setModoAdmin("financeiro")}
      />
    );
  }

  if (modoAdmin === "financeiro") {
    return (
      <AdminFinanceiro
        accessToken={accessToken}
        barbeariaId={adminBarbeariaId || undefined}
        barbeariaNome={adminBarbeariaNome || undefined}
        barbeariaLogoUrl={adminBarbeariaLogoUrl || undefined}
        adminRole={adminRole}
        onVoltar={() => setModoAdmin("adminHome")}
        onSair={async () => {
          await logout();
        }}
      />
    );
  }

  if (modoAdmin === "produtos") {
    if (!podeProdutosEVendas) {
      setModoAdmin("adminHome");
      return null;
    }

    return (
      <AdminProdutos
        accessToken={accessToken}
        barbeariaNome={adminBarbeariaNome || undefined}
        barbeariaLogoUrl={adminBarbeariaLogoUrl || undefined}
        adminRole={adminRole}
        onVoltar={() => setModoAdmin("adminHome")}
      />
    );
  }

  if (modoAdmin === "vendas") {
    if (!podeProdutosEVendas) {
      setModoAdmin("adminHome");
      return null;
    }

    return (
      <AdminVendas
        accessToken={accessToken}
        barbeariaNome={adminBarbeariaNome || undefined}
        barbeariaLogoUrl={adminBarbeariaLogoUrl || undefined}
        adminRole={adminRole}
        onVoltar={() => setModoAdmin("adminHome")}
      />
    );
  }

  if (modoAdmin === "servicos") {
    return (
      <AdminServicos
        accessToken={accessToken}
        barbeariaNome={adminBarbeariaNome || undefined}
        barbeariaLogoUrl={adminBarbeariaLogoUrl || undefined}
        adminRole={adminRole}
        onVoltar={() => setModoAdmin("adminHome")}
      />
    );
  }

  if (modoAdmin === "profissionais") {
    return (
      <AdminProfissionais
        accessToken={accessToken}
        barbeariaNome={adminBarbeariaNome || undefined}
        barbeariaLogoUrl={adminBarbeariaLogoUrl || undefined}
        adminRole={adminRole}
        onVoltar={() => setModoAdmin("adminHome")}
      />
    );
  }

  if (modoAdmin === "pacotes") {
    return (
      <AdminPacotes
        profissionais={profissionais}
        accessToken={accessToken}
        barbeariaNome={adminBarbeariaNome || undefined}
        barbeariaLogoUrl={adminBarbeariaLogoUrl || undefined}
        adminRole={adminRole}
        onVoltarAgenda={() => setModoAdmin("agenda")}
        onSair={() => setModoAdmin("adminHome")}
      />
    );
  }

  return null;
}