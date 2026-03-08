import { useState } from "react";
import { AdminAgenda } from "./components/admin/AdminAgenda";
import { AdminLogin } from "./components/admin/AdminLogin";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { AdminServicos } from "./components/admin/AdminServicos";
import { AdminProfissionais } from "./components/admin/AdminProfissionais";
import { AdminPacotes } from "./components/admin/AdminPacotes";
import { AdminFinanceiro } from "./components/admin/AdminFinanceiro";
import { AdminProdutos } from "./components/admin/AdminProdutos";
import { AdminVendas } from "./components/admin/AdminVendas";

export default function App() {
  const [modoAdmin, setModoAdmin] = useState("adminHome");

  const {
    user,
    accessToken,
    adminRole,
    adminBarbeariaId,
    adminBarbeariaNome,
    adminBarbeariaLogoUrl,
    loading: loadingAuth,
    erro: authError,
    login,
    logout,
  } = useAdminAuth();

  const isOwner = adminRole === "admin_owner";
  const podeProdutosEVendas = ["admin_owner", "admin_staff"].includes(adminRole);

  if (loadingAuth) {
    return (
      <div className="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-400">Verificando sessão...</p>
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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-4">
          <div className="rounded-2xl border border-red-700/60 bg-red-900/30 p-4">
            <p className="text-sm text-red-200">
              Falha na autenticação/permissões:{" "}
              <span className="font-semibold">{authError}</span>
            </p>
            <p className="text-xs text-slate-300 mt-2">
              Verifique o backend (/me), o token e a role do usuário em user_roles.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                await logout();
              }}
              className="text-xs px-3 py-2 rounded-lg border border-red-700 text-red-200 hover:bg-red-900/50 transition"
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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-3xl space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {adminBarbeariaLogoUrl ? (
                <div className="h-16 w-16 rounded-2xl bg-white/95 p-2 shadow-lg shadow-black/20 flex items-center justify-center overflow-hidden">
                  <img
                    src={adminBarbeariaLogoUrl}
                    alt={adminBarbeariaNome || "Logo da barbearia"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : null}

              <div>
                <h1 className="text-2xl font-bold text-slate-50">
                  {adminBarbeariaNome || "Área administrativa"}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Você está autenticado como{" "}
                  <span className="font-medium text-slate-200">{user?.email}</span> (
                  <span className="font-medium text-slate-200">{adminRole || "—"}</span>).
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <button
                onClick={async () => {
                  await logout();
                }}
                className="text-[11px] px-3 py-1 rounded-lg border border-red-700 text-red-300 hover:bg-red-900/60 transition"
              >
                Sair
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setModoAdmin("agenda")}
              className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition"
            >
              <h2 className="font-semibold text-slate-50 mb-1">Agenda do dia</h2>
              <p className="text-xs text-slate-400">
                Ver compromissos, pacotes e bloqueios em tempo real.
              </p>
            </button>

            {isOwner ? (
              <button
                onClick={() => setModoAdmin("financeiro")}
                className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition"
              >
                <h2 className="font-semibold text-emerald-300 mb-1">Financeiro</h2>
                <p className="text-xs text-slate-400">
                  Faturamento, ticket médio, atendimentos e relatórios.
                </p>
              </button>
            ) : (
              <button
                onClick={() => setModoAdmin("servicos")}
                className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition sm:col-start-2"
              >
                <h2 className="font-semibold text-slate-50 mb-1">Serviços</h2>
                <p className="text-xs text-slate-400">
                  Gerenciar lista de serviços, duração e valores.
                </p>
              </button>
            )}

            {!isOwner ? null : (
              <button
                onClick={() => setModoAdmin("servicos")}
                className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition"
              >
                <h2 className="font-semibold text-slate-50 mb-1">Serviços</h2>
                <p className="text-xs text-slate-400">
                  Gerenciar lista de serviços, duração e valores.
                </p>
              </button>
            )}

            {podeProdutosEVendas && (
              <button
                onClick={() => setModoAdmin("produtos")}
                className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition"
              >
                <h2 className="font-semibold text-sky-300 mb-1">Produtos</h2>
                <p className="text-xs text-slate-400">
                  Cadastro de produtos, custos, preços e estoque.
                </p>
              </button>
            )}

            {podeProdutosEVendas && (
              <button
                onClick={() => setModoAdmin("vendas")}
                className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition"
              >
                <h2 className="font-semibold text-emerald-300 mb-1">Vendas (PDV)</h2>
                <p className="text-xs text-slate-400">
                  Venda de balcão com baixa automática no estoque.
                </p>
              </button>
            )}

            <button
              onClick={() => setModoAdmin("profissionais")}
              className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition"
            >
              <h2 className="font-semibold text-slate-50 mb-1">Profissionais</h2>
              <p className="text-xs text-slate-400">
                Cadastrar e editar barbeiros e seus dados.
              </p>
            </button>

            <button
              onClick={() => setModoAdmin("pacotes")}
              className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-4 text-left hover:bg-slate-800 transition"
            >
              <h2 className="font-semibold text-sky-300 mb-1">Pacotes fixos</h2>
              <p className="text-xs text-slate-400">
                Gerenciar horários recorrentes e clientes de pacote.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modoAdmin === "agenda") {
    return (
      <AdminAgenda
        profissionais={[]}
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
        profissionais={[]}
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