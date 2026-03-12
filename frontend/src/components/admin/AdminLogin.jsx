import { useState } from "react";

export function AdminLogin({ onLogin, loading, erro }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    await onLogin(email, senha);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-app)] text-[var(--text-app)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-6">
        <h1 className="mb-1 text-xl font-bold text-[var(--text-app)]">
          Login do Profissional
        </h1>

        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Acesse o painel admin do BarberFlow com seu e-mail e senha.
        </p>

        {erro && (
          <div className="mb-3 rounded-lg border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-app)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-app)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}