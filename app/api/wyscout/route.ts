import { NextResponse } from 'next/server';
import { getWyscoutClient, MockWyscoutClient } from '@/lib/wyscout-client';

const getServerWyscoutClient = () => {
  const apiKey =
    process.env.WYSCOUT_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_WYSCOUT_API_KEY?.trim() ||
    '';
  if (!apiKey) return new MockWyscoutClient();
  return getWyscoutClient();
};

type WyscoutAction =
  | 'searchPlayers'
  | 'loadLeagues'
  | 'importLeaguePlayers';

const getClient = () => getServerWyscoutClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action as WyscoutAction;
    const params = body?.params ?? {};
    const client = getClient();

    switch (action) {
      case 'searchPlayers': {
        const response = await client.searchPlayers(params);
        const players = response.players.map((player: unknown) =>
          client.convertToExternalPlayer(player as never),
        );
        return NextResponse.json({ ok: true, players, total: response.total });
      }
      case 'loadLeagues': {
        const leagues = await client.getLeagues?.();
        return NextResponse.json({ ok: true, leagues: leagues ?? [] });
      }
      case 'importLeaguePlayers': {
        const { leagueIds = [], season = '', includeStats = false } = params;
        const imported: unknown[] = [];
        for (const leagueId of leagueIds as string[]) {
          const batch = await client.importLeaguePlayers(leagueId, season, {
            includeStats,
          });
          imported.push(...batch);
        }
        const players = imported.map((player) =>
          client.convertToExternalPlayer(player as never),
        );
        return NextResponse.json({ ok: true, players });
      }
      default:
        return NextResponse.json(
          { ok: false, error: `Acción Wyscout no soportada: ${String(action)}` },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error Wyscout';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
