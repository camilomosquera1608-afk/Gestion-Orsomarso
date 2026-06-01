// Wyscout API Client
// Note: This is a template implementation. You'll need to configure your Wyscout API credentials.

interface WyscoutAuthResponse {
  token: string;
  expiresIn: number;
}

interface WyscoutPlayer {
  playerId: string;
  shortName: string;
  firstName: string;
  lastName: string;
  foot: string;
  height: number;
  weight: number;
  age: number;
  birthDate: string;
  nationality: string;
  currentTeamId: number;
  currentTeam: string;
  role: string;
  roleCode: number;
  secondaryRoles: string[];
  marketValue: number;
  contractInfo: {
    until: string;
  };
  passportArea: {
    name: string;
  };
}

interface WyscoutStats {
  playerId: string;
  totalMatches: number;
  totalMinutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  passes: number;
  passAccuracy: number;
  crosses: number;
  dribbles: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  totalDistance: number;
  highSpeedDistance: number;
  sprintDistance: number;
  maxVelocity: number;
  acceleration: number;
  topSpeed: number;
}

interface WyscoutLeague {
  leagueId: string;
  name: string;
  country: string;
  tier: string;
}

interface WyscoutSearchResponse {
  players: WyscoutPlayer[];
  total: number;
  page: number;
  pageSize: number;
}

class WyscoutClient {
  private baseUrl: string;
  private apiKey: string;
  private token: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(apiKey: string, baseUrl: string = 'https://api.wyscout.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async authenticate(): Promise<void> {
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.apiKey,
          client_secret: this.apiKey,
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) {
        throw new Error('Wyscout authentication failed');
      }

      const data: WyscoutAuthResponse = await response.json();
      this.token = data.token;
      this.tokenExpiry = Date.now() + (data.expiresIn * 1000);
    } catch (error) {
      console.error('Wyscout authentication error:', error);
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.authenticate();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Wyscout API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Search players globally
  async searchPlayers(params: {
    name?: string;
    position?: string;
    ageMin?: number;
    ageMax?: number;
    nationality?: string;
    league?: string;
    marketValueMin?: number;
    marketValueMax?: number;
    page?: number;
    pageSize?: number;
  }): Promise<WyscoutSearchResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.name) queryParams.append('name', params.name);
    if (params.position) queryParams.append('role', params.position);
    if (params.ageMin) queryParams.append('ageMin', params.ageMin.toString());
    if (params.ageMax) queryParams.append('ageMax', params.ageMax.toString());
    if (params.nationality) queryParams.append('nationality', params.nationality);
    if (params.league) queryParams.append('league', params.league);
    if (params.marketValueMin) queryParams.append('marketValueMin', params.marketValueMin.toString());
    if (params.marketValueMax) queryParams.append('marketValueMax', params.marketValueMax.toString());
    queryParams.append('page', (params.page || 1).toString());
    queryParams.append('pageSize', (params.pageSize || 20).toString());

    return this.request<WyscoutSearchResponse>(
      `/players/search?${queryParams.toString()}`
    );
  }

  // Get player details
  async getPlayerDetails(playerId: string): Promise<WyscoutPlayer> {
    return this.request<WyscoutPlayer>(`/players/${playerId}`);
  }

  // Get player statistics
  async getPlayerStats(
    playerId: string,
    season: string
  ): Promise<WyscoutStats> {
    return this.request<WyscoutStats>(`/players/${playerId}/stats?season=${season}`);
  }

  // Get available leagues
  async getLeagues(): Promise<WyscoutLeague[]> {
    return this.request<WyscoutLeague[]>('/competitions');
  }

  // Bulk import players from a league
  async importLeaguePlayers(
    leagueId: string,
    season: string,
    options: {
      includeStats?: boolean;
      playerLimit?: number;
    } = {}
  ): Promise<WyscoutPlayer[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('season', season);
    if (options.playerLimit) queryParams.append('limit', options.playerLimit.toString());

    const players = await this.request<WyscoutPlayer[]>(
      `/competitions/${leagueId}/players?${queryParams.toString()}`
    );

    if (options.includeStats) {
      const playersWithStats = await Promise.all(
        players.map(async (player) => {
          try {
            const stats = await this.getPlayerStats(player.playerId, season);
            return { ...player, stats };
          } catch (error) {
            console.error(`Failed to fetch stats for player ${player.playerId}:`, error);
            return { ...player, stats: null };
          }
        })
      );
      return playersWithStats as any;
    }

    return players;
  }

  // Convert Wyscout player to ExternalPlayer format
  convertToExternalPlayer(
    wyscoutPlayer: WyscoutPlayer,
    stats?: WyscoutStats
  ): any {
    const { ExternalPlayerSchema, PositionSchema, DominantFootSchema } = require('./schemas');
    
    // Map Wyscout role codes to positions
    const positionMap: Record<number, string> = {
      1: 'Portero',
      2: 'Defensa central',
      3: 'Lateral',
      4: 'Mediocampista',
      5: 'Extremo',
      6: 'Delantero',
    };

    const position = positionMap[wyscoutPlayer.roleCode] || 'Mediocampista';
    
    // Map foot to dominant foot
    const footMap: Record<string, 'Derecha' | 'Izquierda' | 'Ambidiestro'> = {
      'right': 'Derecha',
      'left': 'Izquierda',
      'both': 'Ambidiestro',
    };

    const dominantFoot = footMap[wyscoutPlayer.foot.toLowerCase()] || 'Derecha';

    return {
      id: `wyscout-${wyscoutPlayer.playerId}`,
      wyscoutId: wyscoutPlayer.playerId,
      name: wyscoutPlayer.shortName || `${wyscoutPlayer.firstName} ${wyscoutPlayer.lastName}`,
      age: wyscoutPlayer.age,
      birthDate: wyscoutPlayer.birthDate,
      nationality: wyscoutPlayer.nationality || wyscoutPlayer.passportArea?.name,
      currentClub: wyscoutPlayer.currentTeam,
      league: '', // Will be filled from league data
      leagueCountry: '', // Will be filled from league data
      position: position as any,
      secondaryPositions: wyscoutPlayer.secondaryRoles?.map((role: string) => positionMap[parseInt(role)] || role).filter(Boolean),
      dominantFoot: dominantFoot as any,
      height: wyscoutPlayer.height,
      weight: wyscoutPlayer.weight,
      marketValue: wyscoutPlayer.marketValue,
      contractExpiry: wyscoutPlayer.contractInfo?.until,
      photoUrl: `https://api.wyscout.com/images/player/${wyscoutPlayer.playerId}.png`,
      
      // Performance metrics
      matchesPlayed: stats?.totalMatches,
      minutesPlayed: stats?.totalMinutes,
      goals: stats?.goals,
      assists: stats?.assists,
      yellowCards: stats?.yellowCards,
      redCards: stats?.redCards,
      
      // Advanced metrics
      totalDistance: stats?.totalDistance,
      highSpeedDistance: stats?.highSpeedDistance,
      sprintDistance: stats?.sprintDistance,
      maxVelocity: stats?.maxVelocity,
      
      // Technical metrics
      passAccuracy: stats?.passAccuracy,
      keyPasses: stats?.keyPasses,
      crosses: stats?.crosses,
      dribbles: stats?.dribbles,
      shots: stats?.shots,
      shotsOnTarget: stats?.shotsOnTarget,
      
      // Defensive metrics
      tackles: stats?.tackles,
      interceptions: stats?.interceptions,
      clearances: stats?.clearances,
      
      // Physical metrics
      acceleration: stats?.acceleration,
      topSpeed: stats?.topSpeed,
      
      // Scouting metadata
      scoutStatus: 'none',
      lastUpdated: new Date().toISOString(),
      dataSource: 'wyscout',
    };
  }
}

// Singleton instance
let wyscoutClientInstance: WyscoutClient | null = null;

export function getWyscoutClient(): WyscoutClient {
  if (!wyscoutClientInstance) {
    const apiKey = process.env.NEXT_PUBLIC_WYSCOUT_API_KEY || '';
    if (!apiKey) {
      console.warn('Wyscout API key not configured. Using mock client.');
    }
    wyscoutClientInstance = new WyscoutClient(apiKey);
  }
  return wyscoutClientInstance;
}

// Mock client for development/testing
export class MockWyscoutClient {
  private mockPlayers: any[] = [
    {
      playerId: '1',
      shortName: 'L. Messi',
      firstName: 'Lionel',
      lastName: 'Messi',
      foot: 'left',
      height: 170,
      weight: 72,
      age: 36,
      birthDate: '1987-06-24',
      nationality: 'Argentina',
      currentTeamId: 1,
      currentTeam: 'Inter Miami',
      role: 'Extremo',
      roleCode: 5,
      secondaryRoles: ['4'],
      marketValue: 35000000,
      contractInfo: { until: '2025-12-31' },
      passportArea: { name: 'Argentina' },
    },
    {
      playerId: '2',
      shortName: 'E. Haaland',
      firstName: 'Erling',
      lastName: 'Haaland',
      foot: 'right',
      height: 194,
      weight: 88,
      age: 23,
      birthDate: '2000-07-21',
      nationality: 'Norway',
      currentTeamId: 2,
      currentTeam: 'Manchester City',
      role: 'Delantero',
      roleCode: 6,
      secondaryRoles: [],
      marketValue: 180000000,
      contractInfo: { until: '2027-06-30' },
      passportArea: { name: 'Norway' },
    },
  ];

  async searchPlayers(params: any): Promise<WyscoutSearchResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    let filtered = this.mockPlayers;

    if (params.name) {
      filtered = filtered.filter(p => 
        p.shortName.toLowerCase().includes(params.name.toLowerCase())
      );
    }

    if (params.position) {
      filtered = filtered.filter(p => p.role === params.position);
    }

    if (params.ageMin) {
      filtered = filtered.filter(p => p.age >= params.ageMin);
    }

    if (params.ageMax) {
      filtered = filtered.filter(p => p.age <= params.ageMax);
    }

    return {
      players: filtered,
      total: filtered.length,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    };
  }

  async getPlayerDetails(playerId: string): Promise<WyscoutPlayer> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const player = this.mockPlayers.find(p => p.playerId === playerId);
    if (!player) throw new Error('Player not found');
    return player;
  }

  async getPlayerStats(playerId: string, season: string): Promise<WyscoutStats> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      playerId,
      totalMatches: 30,
      totalMinutes: 2500,
      goals: 25,
      assists: 10,
      yellowCards: 3,
      redCards: 0,
      shots: 80,
      shotsOnTarget: 40,
      keyPasses: 50,
      passes: 1500,
      passAccuracy: 85,
      crosses: 30,
      dribbles: 60,
      tackles: 20,
      interceptions: 15,
      clearances: 10,
      totalDistance: 300000,
      highSpeedDistance: 15000,
      sprintDistance: 5000,
      maxVelocity: 35,
      acceleration: 8,
      topSpeed: 35,
    };
  }

  async getLeagues(): Promise<WyscoutLeague[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [
      { leagueId: '1', name: 'Premier League', country: 'England', tier: 'top' },
      { leagueId: '2', name: 'La Liga', country: 'Spain', tier: 'top' },
      { leagueId: '3', name: 'Bundesliga', country: 'Germany', tier: 'top' },
      { leagueId: '4', name: 'Serie A', country: 'Italy', tier: 'top' },
      { leagueId: '5', name: 'Ligue 1', country: 'France', tier: 'top' },
    ];
  }

  async importLeaguePlayers(leagueId: string, season: string, options: any = {}): Promise<WyscoutPlayer[]> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.mockPlayers;
  }

  convertToExternalPlayer(wyscoutPlayer: WyscoutPlayer, stats?: WyscoutStats): any {
    const client = new WyscoutClient('mock');
    return client.convertToExternalPlayer(wyscoutPlayer, stats);
  }
}

export function getWyscoutClientOrMock(): WyscoutClient | MockWyscoutClient {
  const apiKey = process.env.NEXT_PUBLIC_WYSCOUT_API_KEY;
  if (!apiKey) {
    console.warn('Using mock Wyscout client');
    return new MockWyscoutClient();
  }
  return getWyscoutClient();
}
