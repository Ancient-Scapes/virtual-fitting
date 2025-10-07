import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Session,
  SupabaseClient,
  createClient,
} from "@supabase/supabase-js";

const SupabaseContext = createContext<{
  supabase: SupabaseClient;
  session: Session | null;
  loading: boolean;
} | null>(null);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Supabaseの環境変数が設定されていません");
}

export function SupabaseProvider({ children }: PropsWithChildren) {
  const supabase = useMemo(() => {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        storageKey: "virtual-fitting-auth",
      },
    });
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setSession(authSession ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ supabase, session, loading }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("SupabaseProviderの外でuseSupabaseが呼ばれました");
  }
  return context;
}
