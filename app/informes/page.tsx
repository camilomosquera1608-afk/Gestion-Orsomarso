'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Activity, Dumbbell, Salad, ShieldCheck, Trophy } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const SectionBanner = ({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) => (
  <div className="section-banner card">
    <div className="section-banner-icon">{icon}</div>
    <div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  </div>
);

export default function InformesPage() {
  const { data, filters, setFilters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const youthSimple = activeCategory !== 'Sub20' && activeCategory !== 'all';
  const [photoFallback, setPhotoFallback] = useState(false);

  const categoryPlayers = data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory);
  const selectedPlayerId = filters.playerId === 'all' ? categoryPlayers[0]?.id ?? '' : filters.playerId;
  const player = data.players.find((item) => item.id === selectedPlayerId) ?? data.players[0];
  const microcycle = data.microcycles.find((item) => item.id === filters.microcycleId) ?? data.microcycles[0];

  const nutritionHistory = useMemo(
    () => data.nutritionRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.nutritionRecords, selectedPlayerId],
  );
  const neuromuscularHistory = useMemo(
    () => data.neuromuscularRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.neuromuscularRecords, selectedPlayerId],
  );
  const cmjHistory = useMemo(
    () => data.cmjRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.cmjRecords, selectedPlayerId],
  );
  const fmsHistory = useMemo(
    () =>
      data.fmsRecords
        .filter((record) => record.playerId === selectedPlayerId)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((record) => ({
          ...record,
          total:
            record.shoulderMobility +
            record.squat +
            record.legRaise +
            record.hurdleStep +
            record.lunge +
            record.trunkStability +
            record.rotaryStability,
        })),
    [data.fmsRecords, selectedPlayerId],
  );
  const competitionHistory = useMemo(
    () => data.competitionRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.competitionRecords, selectedPlayerId],
  );

  const movementHistory = useMemo(
    () =>
      [
        ...data.externalLoads
          .filter(
            (record) =>
              record.playerId === selectedPlayerId &&
              ((record.actingCategory ?? record.category) !== (record.baseCategory ?? player?.category) ||
                (record.movementType ?? 'base') !== 'base'),
          )
          .map((record) => ({
            fecha: record.date,
            modulo: 'Sesión',
            categoria_base: record.baseCategory ?? player?.category ?? '',
            categoria_participacion: record.actingCategory ?? record.category ?? '',
            movimiento: record.movementType ?? 'base',
            observacion: record.movementNote ?? '',
          })),
        ...data.competitionRecords
          .filter(
            (record) =>
              record.playerId === selectedPlayerId &&
              ((record.actingCategory ?? record.category) !== (record.baseCategory ?? player?.category) ||
                (record.movementType ?? 'base') !== 'base'),
          )
          .map((record) => ({
            fecha: record.date,
            modulo: 'Competencia',
            categoria_base: record.baseCategory ?? player?.category ?? '',
            categoria_participacion: record.actingCategory ?? record.category ?? '',
            movimiento: record.movementType ?? 'base',
            observacion: record.movementNote ?? '',
          })),
      ].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [data.externalLoads, data.competitionRecords, selectedPlayerId, player?.category],
  );

  if (!player) return <div className="empty">No hay jugadores disponibles para el informe.</div>;

  const photoSrc = !photoFallback && player.photo ? player.photo : '/orsomarso-crest.jpg';

  const competitionTotals = {
    partidos: competitionHistory.length,
    minutos: competitionHistory.reduce((acc, row) => acc + row.minutesPlayed, 0),
    goles: competitionHistory.reduce((acc, row) => acc + row.goals, 0),
    asistencias: competitionHistory.reduce((acc, row) => acc + row.assists, 0),
    amarillas: competitionHistory.reduce((acc, row) => acc + row.yellowCards, 0),
    rojas: competitionHistory.reduce((acc, row) => acc + row.redCards, 0),
  };

  const reportRows: Record<string, string | number>[] = [
    ...nutritionHistory.map((row) => ({
      seccion: 'Nutricion',
      fecha: row.date,
      peso: row.weight,
      estatura: row.height,
      grasa: row.bodyFat,
      pliegues: row.skinfoldSum,
      plan: row.plan,
    })),
    ...neuromuscularHistory.map((row) => ({
      seccion: 'Perfil neuromuscular',
      fecha: row.date,
      cmj: row.cmj,
      sj: row.sj,
      reactivos: row.reactiveJumps,
    })),
    ...cmjHistory.map((row) => ({ seccion: 'CMJ', fecha: row.date, cmj: row.value })),
    ...fmsHistory.map((row) => ({ seccion: 'FMS', fecha: row.date, total: row.total })),
    ...competitionHistory.map((row) => ({
      seccion: 'Competencia',
      fecha: row.date,
      competencia: row.competitionName ?? row.opponent,
      minutos: row.minutesPlayed,
      categoria_participacion: row.actingCategory ?? row.category ?? '',
      movimiento: row.movementType ?? 'base',
      goles: row.goals,
      asistencias: row.assists,
      goles_encajados: row.goalsConceded ?? '',
      goles_evitados: row.goalsPrevented ?? '',
      centros_defendidos: row.crossesDefended ?? '',
      remates_a_porteria: row.shotsOnTarget ?? '',
      amarillas: row.yellowCards,
      rojas: row.redCards,
    })),
    ...movementHistory.map((row) => ({
      seccion: 'Movimientos',
      fecha: row.fecha,
      modulo: row.modulo,
      categoria_base: row.categoria_base,
      categoria_participacion: row.categoria_participacion,
      movimiento: row.movimiento,
      observacion: row.observacion,
    })),
  ];

  return (
    <div className="grid report-page">
      <AppHero
        title="Informes"
        subtitle={master ? 'Acceso maestro de lectura global.' : `Informe operativo de ${activeCategory}.`}
      />
      <GlobalFiltersBar />

      <div className="card no-print">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>Jugador del informe</label>
            <select
              className="select"
              value={selectedPlayerId}
              onChange={(e) => {
                setPhotoFallback(false);
                setFilters({ playerId: e.target.value });
              }}
            >
              {categoryPlayers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn secondary"
              onClick={() => downloadCsv(`informe-${player.name.replaceAll(' ', '_')}_${microcycle.name}.csv`, reportRows)}
            >
              Exportar CSV
            </button>
            <button type="button" className="btn" onClick={() => window.print()}>
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <section className="report-print-area report-blue-background">
        <div className="report-cover card">
          <div className="report-brand">
            <Image src="/orsomarso-crest.jpg" alt="Escudo Orsomarso SC" width={68} height={68} />
            <div>
              <div className="report-eyebrow">Orsomarso SC Performance</div>
              <div className="report-meta-line">
                {String(activeCategory)} · {microcycle.name} · {microcycle.startDate} a {microcycle.endDate}
              </div>
            </div>
          </div>
        </div>

        <div className="card report-player-header report-hero-card">
          <div className="report-player-photo">
            <img src={photoSrc} alt={player.name} onError={() => setPhotoFallback(true)} />
          </div>
          <div className="report-player-core">
            <h2>{player.name}</h2>
            <div className="report-player-info">
              <div className="summary-chip">{player.age} años</div>
              <div className="summary-chip">{player.position}</div>
              <div className="summary-chip">{player.category ?? 'Sub20'}</div>
              <div className="summary-chip">{player.status}</div>
              <div className="summary-chip">{microcycle.name}</div>
            </div>
          </div>
        </div>

        <div className="report-section page-break-before">
          <SectionBanner
            title="Valoraciones"
            subtitle={youthSimple ? 'Informe simplificado para categorías formativas.' : 'FMS, perfil neuromuscular, nutrición y CMJ.'}
            icon={<Dumbbell size={34} />}
          />

          <div className="grid grid-2">
            <div className="card table-wrap report-card-large">
              <div className="subsection-title">
                <Salad size={18} />
                <span>Nutrición</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Peso</th>
                    <th>Estatura</th>
                    <th>% grasa</th>
                    <th>Σ pliegues</th>
                    <th>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {nutritionHistory.map((row, index) => (
                    <tr key={`${row.date}-${index}`}>
                      <td>{row.date}</td>
                      <td>{row.weight}</td>
                      <td>{row.height}</td>
                      <td>{row.bodyFat}</td>
                      <td>{row.skinfoldSum}</td>
                      <td>{row.plan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card report-card-large">
              <div className="subsection-title">
                <Salad size={18} />
                <span>Evolución nutricional</span>
              </div>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={nutritionHistory.map((r) => ({ fecha: r.date.slice(5), peso: r.weight, pliegues: r.skinfoldSum }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="peso" stroke="#1d4ed8" strokeWidth={3} />
                    <Line type="monotone" dataKey="pliegues" stroke="#f59e0b" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {!youthSimple ? (
            <>
              <div className="grid grid-2">
                <div className="card table-wrap report-card-large">
                  <div className="subsection-title">
                    <Activity size={18} />
                    <span>Perfil neuromuscular</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>CMJ</th>
                        <th>SJ</th>
                        <th>Saltos reactivos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {neuromuscularHistory.map((row, index) => (
                        <tr key={`${row.date}-${index}`}>
                          <td>{row.date}</td>
                          <td>{row.cmj}</td>
                          <td>{row.sj}</td>
                          <td>{row.reactiveJumps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card report-card-large">
                  <div className="subsection-title">
                    <Activity size={18} />
                    <span>Evolución perfil neuromuscular</span>
                  </div>
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                      <LineChart data={neuromuscularHistory.map((r) => ({ fecha: r.date.slice(5), cmj: r.cmj, sj: r.sj, reactivos: r.reactiveJumps }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
                        <Line type="monotone" dataKey="sj" stroke="#93c5fd" strokeWidth={3} />
                        <Line type="monotone" dataKey="reactivos" stroke="#f59e0b" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-2">
                <div className="card table-wrap report-card-large">
                  <div className="subsection-title">
                    <Activity size={18} />
                    <span>CMJ</span>
                  </div>
                  <table>
                    <thead>
                      <tr><th>Fecha</th><th>CMJ</th></tr>
                    </thead>
                    <tbody>
                      {cmjHistory.map((row, index) => (
                        <tr key={`${row.date}-${index}`}>
                          <td>{row.date}</td>
                          <td>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card report-card-large">
                  <div className="subsection-title">
                    <Activity size={18} />
                    <span>Evolución CMJ</span>
                  </div>
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                      <LineChart data={cmjHistory.map((r) => ({ fecha: r.date.slice(5), cmj: r.value }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-2">
                <div className="card table-wrap report-card-large">
                  <div className="subsection-title">
                    <ShieldCheck size={18} />
                    <span>FMS</span>
                  </div>
                  <table>
                    <thead>
                      <tr><th>Fecha</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {fmsHistory.map((row, index) => (
                        <tr key={`${row.date}-${index}`}>
                          <td>{row.date}</td>
                          <td>{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card report-card-large">
                  <div className="subsection-title">
                    <ShieldCheck size={18} />
                    <span>Evolución FMS</span>
                  </div>
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                      <LineChart data={fmsHistory.map((r) => ({ fecha: r.date.slice(5), total: r.total }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="total" stroke="#1d4ed8" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-2">
              <div className="card table-wrap report-card-large">
                <div className="subsection-title">
                  <Activity size={18} />
                  <span>CMJ</span>
                </div>
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>CMJ</th></tr>
                  </thead>
                  <tbody>
                    {cmjHistory.map((row, index) => (
                      <tr key={`${row.date}-${index}`}>
                        <td>{row.date}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card report-card-large">
                <div className="subsection-title">
                  <Activity size={18} />
                  <span>Evolución CMJ</span>
                </div>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={cmjHistory.map((r) => ({ fecha: r.date.slice(5), cmj: r.value }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="report-section page-break-before">
          <SectionBanner
            title="Competencia"
            subtitle={youthSimple ? 'Resumen simple de competencia por categoría.' : 'Todo el rendimiento del jugador en partido.'}
            icon={<Trophy size={34} />}
          />

          <div className="grid competition-summary-grid">
            <div className="mini-stat-card"><strong>Partidos</strong><div className="muted-line">{competitionTotals.partidos}</div></div>
            <div className="mini-stat-card"><strong>Minutos</strong><div className="muted-line">{competitionTotals.minutos}</div></div>
            <div className="mini-stat-card"><strong>Goles</strong><div className="muted-line">{competitionTotals.goles}</div></div>
            <div className="mini-stat-card"><strong>Asistencias</strong><div className="muted-line">{competitionTotals.asistencias}</div></div>
            <div className="mini-stat-card"><strong>TA</strong><div className="muted-line">{competitionTotals.amarillas}</div></div>
            <div className="mini-stat-card"><strong>TR</strong><div className="muted-line">{competitionTotals.rojas}</div></div>
          </div>

          <div className="grid grid-2">
            <div className="card table-wrap report-card-large">
              <div className="subsection-title">
                <Trophy size={18} />
                <span>Datos competencia</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Competencia</th>
                    <th>Minutos</th>
                    <th>Detalle</th>
                    <th>TA</th>
                    <th>TR</th>
                  </tr>
                </thead>
                <tbody>
                  {competitionHistory.map((row, index) => (
                    <tr key={`${row.date}-${index}`}>
                      <td>{row.date}</td>
                      <td>{row.competitionName ?? row.opponent}</td>
                      <td>{row.minutesPlayed}</td>
                      <td>
                        {player.position === 'Portero'
                          ? `GE ${row.goalsConceded ?? 0} · GEv ${row.goalsPrevented ?? 0}`
                          : youthSimple
                            ? `G ${row.goals} · A ${row.assists}`
                            : `G ${row.goals} · A ${row.assists} · ACC ${row.acc ?? 0} · RHIE ${row.rhie ?? 0}`}
                      </td>
                      <td>{row.yellowCards}</td>
                      <td>{row.redCards}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card report-card-large">
              <div className="subsection-title">
                <Trophy size={18} />
                <span>Evolución en competencia</span>
              </div>
              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer>
                  <BarChart data={competitionHistory.map((r) => ({ fecha: r.date.slice(5), minutos: r.minutesPlayed, goles: r.goals, asistencias: r.assists }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="minutos" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="goles" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="asistencias" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card table-wrap report-card-large">
            <div className="subsection-title">
              <Trophy size={18} />
              <span>Participaciones temporales</span>
            </div>
            {movementHistory.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Módulo</th>
                    <th>Categoría base</th>
                    <th>Categoría participación</th>
                    <th>Movimiento</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {movementHistory.map((row, index) => (
                    <tr key={`${row.fecha}-${index}`}>
                      <td>{row.fecha}</td>
                      <td>{row.modulo}</td>
                      <td>{row.categoria_base}</td>
                      <td>{row.categoria_participacion}</td>
                      <td>{row.movimiento}</td>
                      <td>{row.observacion || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Sin movimientos temporales registrados.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
