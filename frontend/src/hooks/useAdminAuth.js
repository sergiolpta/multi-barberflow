// src/hooks/useAdminAuth.js
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../config/api";

export function useAdminAuth() {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Perfil vindo do BACKEND (/me)
  const [adminRole, setAdminRole] = useState("");
  const [adminBarbeariaId, setAdminBarbeariaId] = useState("");

  // evita race condition no /me
  const reqSeq = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const limparPerfil = useCallback(() => {
    if (!mountedRef.current) return;
    setAdminRole("");
    setAdminBarbeariaId("");
  }, []);

  const limparSessaoLocal = useCallback(() => {
    if (!mountedRef.current) return;
    setUser(null);
    setAccessToken("");
    limparPerfil();
  }, [limparPerfil]);

  const carregarPerfilAdmin = useCallback(
    async (token) => {
      const tokenUsado = token || accessToken;
      if (!tokenUsado) return;

      const mySeq = ++reqSeq.current;

      try {
        if (mountedRef.current) setErro("");

        // /me não depende de barbearia
        const me = await apiFetch(`/me`, {
          method: "GET",
          accessToken: tokenUsado,
          skipBarbeariaId: true,
        });

        // se veio outra chamada mais nova, ignora
        if (mySeq !== reqSeq.current) return;

        if (!mountedRef.current) return;
        setAdminRole(me?.role || "");
        setAdminBarbeariaId(me?.barbeariaId || "");
      } catch (err) {
        if (mySeq !== reqSeq.current) return;

        console.error("Erro ao carregar /me:", err);

        const status = err?.status;
        const msg = String(err?.message || "").toLowerCase();

        // token inválido / sessão sem permissão -> limpa
        if (status === 401 || status === 403 || msg.includes("unauthorized")) {
          limparSessaoLocal();
        } else {
          limparPerfil();
        }

        if (!mountedRef.current) return;
        setErro(err?.message || "Não foi possível carregar perfil admin (/me).");
      }
    },
    [accessToken, limparSessaoLocal, limparPerfil]
  );

  // Carrega sessão inicial
  useEffect(() => {
    async function loadSession() {
      if (!mountedRef.current) return;

      setLoading(true);
      setErro("");

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Erro ao obter sessão Supabase:", error);
        if (mountedRef.current) setErro("Erro ao verificar sessão.");
      }

      if (session) {
        if (!mountedRef.current) return;
        setUser(session.user);
        setAccessToken(session.access_token);

        await carregarPerfilAdmin(session.access_token);
      } else {
        limparSessaoLocal();
      }

      if (mountedRef.current) setLoading(false);
    }

    loadSession();

    // Listener para mudanças de sessão (login/logout/refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        if (!mountedRef.current) return;

        setUser(session.user);
        setAccessToken(session.access_token);

        await carregarPerfilAdmin(session.access_token);
      } else {
        limparSessaoLocal();
      }
    });

    return () => subscription.unsubscribe();
  }, [carregarPerfilAdmin, limparSessaoLocal]);

  async function login(email, password) {
    try {
      setLoading(true);
      setErro("");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Erro de login Supabase:", error);
        throw new Error(error.message || "Falha no login.");
      }

      const session = data.session;
      if (!session) {
        throw new Error("Sessão não retornada pelo Supabase.");
      }

      setUser(session.user);
      setAccessToken(session.access_token);

      await carregarPerfilAdmin(session.access_token);

      return session;
    } catch (err) {
      console.error("Erro em login admin:", err);
      setErro(err?.message || "Não foi possível entrar.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao sair:", err);
    } finally {
      limparSessaoLocal();
      setLoading(false);
    }
  }

  return {
    user,
    accessToken,
    adminRole,
    adminBarbeariaId,
    loading,
    erro,
    login,
    logout,
    recarregarPerfilAdmin: carregarPerfilAdmin,
  };
}

