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
  const [adminBarbeariaNome, setAdminBarbeariaNome] = useState("");
  const [adminBarbeariaLogoUrl, setAdminBarbeariaLogoUrl] = useState("");
  const [adminBarbeariaTemaAdmin, setAdminBarbeariaTemaAdmin] = useState("dark");

  // evita race condition no /me
  const reqSeq = useRef(0);
  const mountedRef = useRef(true);
  // bloqueia novas chamadas ao /me após 401 — só é resetado no login explícito
  const sessionInvalidRef = useRef(false);

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
    setAdminBarbeariaNome("");
    setAdminBarbeariaLogoUrl("");
    setAdminBarbeariaTemaAdmin("dark");
  }, []);

  const limparSessaoLocal = useCallback(() => {
    if (!mountedRef.current) return;
    setUser(null);
    setAccessToken("");
    limparPerfil();
  }, [limparPerfil]);

  const carregarPerfilAdmin = useCallback(
    async (token) => {
      const tokenUsado = token;
      if (!tokenUsado || sessionInvalidRef.current) return;

      const mySeq = ++reqSeq.current;

      try {
        if (mountedRef.current) setErro("");

        const me = await apiFetch("/me", {
          method: "GET",
          accessToken: tokenUsado,
        });

        if (mySeq !== reqSeq.current) return;
        if (!mountedRef.current) return;

        setAdminRole(me?.role || "");
        setAdminBarbeariaId(me?.barbeariaId || "");
        setAdminBarbeariaNome(me?.barbeariaNome || "");
        setAdminBarbeariaLogoUrl(me?.barbeariaLogoUrl || "");
        setAdminBarbeariaTemaAdmin(me?.barbeariaTemaAdmin || "dark");
      } catch (err) {
        if (mySeq !== reqSeq.current) return;

        console.error("Erro ao carregar /me:", err);

        const status = err?.status;
        const msg = String(err?.message || "").toLowerCase();

        if (status === 401 || status === 403 || msg.includes("unauthorized")) {
          // Bloqueia qualquer nova chamada ao /me — só é liberado no login explícito
          sessionInvalidRef.current = true;
          limparSessaoLocal();
          // Limpa a sessão no Supabase (best-effort) para não acumular no localStorage
          try {
            await supabase.auth.signOut();
          } catch (_) {
            // ignora
          }
          // Não exibe erro — o app vai para a tela de login silenciosamente
        } else {
          limparPerfil();
          if (!mountedRef.current) return;
          setErro(err?.message || "Não foi possível carregar perfil admin (/me).");
        }
      }
    },
    [limparSessaoLocal, limparPerfil]
  );

  useEffect(() => {
    let active = true;

    setLoading(true);
    setErro("");

    // onAuthStateChange emite INITIAL_SESSION imediatamente ao se inscrever,
    // dispensando a chamada manual a getSession().
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;

      if (session) {
        setUser(session.user);
        setAccessToken(session.access_token);
        await carregarPerfilAdmin(session.access_token);
        if (active) setLoading(false);
      } else {
        limparSessaoLocal();
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [carregarPerfilAdmin, limparSessaoLocal]);

  async function login(email, password) {
    try {
      setLoading(true);
      setErro("");
      sessionInvalidRef.current = false; // libera chamadas ao /me para o novo login

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
    adminBarbeariaNome,
    adminBarbeariaLogoUrl,
    adminBarbeariaTemaAdmin,
    loading,
    erro,
    login,
    logout,
    recarregarPerfilAdmin: carregarPerfilAdmin,
  };
}