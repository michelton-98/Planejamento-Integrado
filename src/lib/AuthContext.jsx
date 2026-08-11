import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Erro ao carregar perfil:', error.message)
      setProfile(null)
      return
    }

    setProfile(data)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      await loadProfile(session?.user?.id)
      if (active) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return
      setSession(session)
      await loadProfile(session?.user?.id)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile: () => loadProfile(session?.user?.id),
    signInWithPassword: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, { nome, funcao }) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { nome, funcao } },
      }),
    // BASE_URL entra no meio pra funcionar tanto na Vercel ("/", link vira
    // .../redefinir-senha) quanto no GitHub Pages ("/Planejamento-Integrado/",
    // link vira .../Planejamento-Integrado/redefinir-senha) — sem isso o link do e-mail
    // cairia sempre na raiz, quebrado no Pages.
    resetPasswordForEmail: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}redefinir-senha`,
      }),
    updateUser: (atributos) => supabase.auth.updateUser(atributos),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>')
  }
  return context
}
