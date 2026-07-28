import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CompetitionMatchSummary } from '@/lib/types';

export function useSessionData(sessionId?: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const client = supabase;
      if (!client) throw new Error('Supabase client not initialized');
      const { data, error } = await client
        .from('training_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSessions(date?: string, category?: string) {
  return useQuery({
    queryKey: ['sessions', date, category],
    queryFn: async () => {
      const client = supabase;
      if (!client) throw new Error('Supabase client not initialized');
      let query = client.from('training_sessions').select('*');
      if (date) query = query.eq('date', date);
      if (category) query = query.eq('category', category);
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMatchData(matchId?: string) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      if (!matchId) return null;
      const client = supabase;
      if (!client) throw new Error('Supabase client not initialized');
      const { data, error } = await client
        .from('competition_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      if (error) throw error;
      return data as CompetitionMatchSummary;
    },
    enabled: !!matchId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMatches(category?: string) {
  return useQuery({
    queryKey: ['matches', category],
    queryFn: async () => {
      const client = supabase;
      if (!client) throw new Error('Supabase client not initialized');
      let query = client.from('competition_matches').select('*');
      if (category) query = query.eq('category', category);
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      return data as CompetitionMatchSummary[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
