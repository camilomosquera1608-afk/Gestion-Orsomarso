import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Player, DailyWellnessRecord, DailyInternalLoadRecord, DailyExternalLoadRecord, CompetitionRecord } from '@/lib/schemas';

// Generic fetch function with error handling
async function fetchFromSupabase<T>(table: string, options?: {
  select?: string;
  eq?: { column: string; value: any };
  order?: { column: string; ascending?: boolean };
  limit?: number;
}): Promise<T[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  let query = supabase.from(table).select(options?.select || '*');

  if (options?.eq) {
    query = query.eq(options.eq.column, options.eq.value);
  }

  if (options?.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching from ${table}: ${error.message}`);
  }

  return data as T[];
}

// Players hooks
export function usePlayers(options?: UseQueryOptions<Player[]>) {
  return useQuery({
    queryKey: ['players'],
    queryFn: () => fetchFromSupabase<Player>('players'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function usePlayer(id: string, options?: UseQueryOptions<Player>) {
  return useQuery({
    queryKey: ['player', id],
    queryFn: () => fetchFromSupabase<Player>('players', { eq: { column: 'id', value: id } }).then(data => data[0]),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function usePlayersByCategory(category: string, options?: UseQueryOptions<Player[]>) {
  return useQuery({
    queryKey: ['players', 'category', category],
    queryFn: () => fetchFromSupabase<Player>('players', { eq: { column: 'category', value: category } }),
    enabled: !!category && category !== 'all',
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function usePlayersByPosition(position: string, options?: UseQueryOptions<Player[]>) {
  return useQuery({
    queryKey: ['players', 'position', position],
    queryFn: () => fetchFromSupabase<Player>('players', { eq: { column: 'position', value: position } }),
    enabled: !!position,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// Wellness hooks
export function useWellnessRecords(options?: UseQueryOptions<DailyWellnessRecord[]>) {
  return useQuery({
    queryKey: ['wellness'],
    queryFn: () => fetchFromSupabase<DailyWellnessRecord>('daily_wellness_records'),
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

export function useWellnessByPlayer(playerId: string, options?: UseQueryOptions<DailyWellnessRecord[]>) {
  return useQuery({
    queryKey: ['wellness', 'player', playerId],
    queryFn: () => fetchFromSupabase<DailyWellnessRecord>('daily_wellness_records', { 
      eq: { column: 'playerId', value: playerId },
      order: { column: 'date', ascending: false }
    }),
    enabled: !!playerId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

export function useWellnessByDate(date: string, options?: UseQueryOptions<DailyWellnessRecord[]>) {
  return useQuery({
    queryKey: ['wellness', 'date', date],
    queryFn: () => fetchFromSupabase<DailyWellnessRecord>('daily_wellness_records', { 
      eq: { column: 'date', value: date }
    }),
    enabled: !!date,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

// Internal Load hooks
export function useInternalLoadRecords(options?: UseQueryOptions<DailyInternalLoadRecord[]>) {
  return useQuery({
    queryKey: ['internal-loads'],
    queryFn: () => fetchFromSupabase<DailyInternalLoadRecord>('daily_internal_load_records'),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

export function useInternalLoadsByPlayer(playerId: string, options?: UseQueryOptions<DailyInternalLoadRecord[]>) {
  return useQuery({
    queryKey: ['internal-loads', 'player', playerId],
    queryFn: () => fetchFromSupabase<DailyInternalLoadRecord>('daily_internal_load_records', { 
      eq: { column: 'playerId', value: playerId },
      order: { column: 'date', ascending: false }
    }),
    enabled: !!playerId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

// External Load hooks
export function useExternalLoadRecords(options?: UseQueryOptions<DailyExternalLoadRecord[]>) {
  return useQuery({
    queryKey: ['external-loads'],
    queryFn: () => fetchFromSupabase<DailyExternalLoadRecord>('daily_external_load_records'),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

export function useExternalLoadsByPlayer(playerId: string, options?: UseQueryOptions<DailyExternalLoadRecord[]>) {
  return useQuery({
    queryKey: ['external-loads', 'player', playerId],
    queryFn: () => fetchFromSupabase<DailyExternalLoadRecord>('daily_external_load_records', { 
      eq: { column: 'playerId', value: playerId },
      order: { column: 'date', ascending: false }
    }),
    enabled: !!playerId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

// Competition hooks
export function useCompetitionRecords(options?: UseQueryOptions<CompetitionRecord[]>) {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: () => fetchFromSupabase<CompetitionRecord>('competition_records'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useCompetitionsByPlayer(playerId: string, options?: UseQueryOptions<CompetitionRecord[]>) {
  return useQuery({
    queryKey: ['competitions', 'player', playerId],
    queryFn: () => fetchFromSupabase<CompetitionRecord>('competition_records', { 
      eq: { column: 'playerId', value: playerId },
      order: { column: 'date', ascending: false }
    }),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// Mutation hooks
export function useAddPlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (player: Partial<Player>) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.from('players').insert(player).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Player> & { id: string }) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.from('players').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['player', data.id] });
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });
}

export function useAddWellness() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: Partial<DailyWellnessRecord>) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.from('daily_wellness_records').insert(record).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wellness'] });
      queryClient.invalidateQueries({ queryKey: ['wellness', 'player', data.playerId] });
      queryClient.invalidateQueries({ queryKey: ['wellness', 'date', data.date] });
    },
  });
}

export function useUpdateWellness() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DailyWellnessRecord> & { id: string }) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.from('daily_wellness_records').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wellness'] });
      queryClient.invalidateQueries({ queryKey: ['wellness', 'player', data.playerId] });
      queryClient.invalidateQueries({ queryKey: ['wellness', 'date', data.date] });
    },
  });
}

export function useAddInternalLoad() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: Partial<DailyInternalLoadRecord>) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.from('daily_internal_load_records').insert(record).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['internal-loads'] });
      queryClient.invalidateQueries({ queryKey: ['internal-loads', 'player', data.playerId] });
    },
  });
}

export function useAddExternalLoad() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: Partial<DailyExternalLoadRecord>) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.from('daily_external_load_records').insert(record).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['external-loads'] });
      queryClient.invalidateQueries({ queryKey: ['external-loads', 'player', data.playerId] });
    },
  });
}

export function useAddCompetition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: Partial<CompetitionRecord>) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.from('competition_records').insert(record).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['competitions', 'player', data.playerId] });
    },
  });
}
