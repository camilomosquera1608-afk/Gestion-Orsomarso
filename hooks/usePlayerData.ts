import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Player } from '@/lib/types';

export function usePlayerData(playerId?: string) {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const client = supabase;
      if (!client) throw new Error('Supabase client not initialized');
      const { data, error } = await client
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();
      if (error) throw error;
      return data as Player;
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePlayers(category?: string) {
  return useQuery({
    queryKey: ['players', category],
    queryFn: async () => {
      const client = supabase;
      if (!client) throw new Error('Supabase client not initialized');
      let query = client.from('players').select('*');
      if (category) {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Player[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
