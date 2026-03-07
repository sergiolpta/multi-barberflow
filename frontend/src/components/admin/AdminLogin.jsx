// src/components/admin/AdminLogin.jsx
import { useState } from "react";

export function AdminLogin({ onLogin, loading, erro }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    await onLogin(email, senha);
  }

  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700 rounded-2xl p-6">
        <h1 className="text-xl font-bold text-slate-50 mb-1">
          Login do Profissional
        </h1>
        <p className="text-xs text-slate-400 mb-4">
          Acesse o painel admin do BarberFlow com seu e-mail e senha.
        </p>

        {erro && (
          <div className="bg-red-900/40 border border-red-500/60 text-red-100 px-3 py-2 rounded-lg text-xs mb-3">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-medium text-white transition"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

