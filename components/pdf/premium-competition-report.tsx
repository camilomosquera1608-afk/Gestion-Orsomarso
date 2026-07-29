// Premium Competition Report - Main Component
// Integrates all pages into a cohesive professional report
import { ExecutiveCover } from './pages/executive-cover';
import { ExecutiveSummary } from './pages/executive-summary';
import { CollectiveAnalysis } from './pages/collective-analysis';
import { AttackAnalysis } from './pages/attack-analysis';
import { DefenseAnalysis } from './pages/defense-analysis';
import { GameControl } from './pages/game-control';
import { PhysicalLoad } from './pages/physical-load';
import { IndividualPerformance } from './pages/individual-performance';
import { getAvailableMetrics, validateReportConsistency } from '@/lib/pdf-helpers';
import type { CompetitionReportData } from '@/lib/competition-report';

interface PremiumCompetitionReportProps {
  report: CompetitionReportData;
  clubLogo?: string;
  matchPhoto?: string;
  weather?: string;
  stadium?: string;
  showPageBreaks?: boolean;
  className?: string;
}

export function PremiumCompetitionReport({
  report,
  clubLogo,
  matchPhoto,
  weather,
  stadium,
  showPageBreaks = true,
  className = '',
}: PremiumCompetitionReportProps) {
  // Validate data consistency
  const consistencyCheck = validateReportConsistency(report);
  const availableMetrics = getAvailableMetrics(report);

  // Page break component
  const PageBreak = () => {
    if (!showPageBreaks) return null;
    return (
      <div className="page-break" style={{ pageBreakAfter: 'always' }} />
    );
  };

  return (
    <div className={`premium-pdf-report ${className}`}>
      {/* Page 1: Executive Cover */}
      <ExecutiveCover
        report={report}
        clubLogo={clubLogo}
        matchPhoto={matchPhoto}
        weather={weather}
        stadium={stadium}
      />
      <PageBreak />

      {/* Page 2: Executive Summary */}
      <ExecutiveSummary report={report} />
      <PageBreak />

      {/* Page 3: Collective Analysis */}
      <CollectiveAnalysis report={report} />
      <PageBreak />

      {/* Page 4: Attack Analysis */}
      <AttackAnalysis report={report} />
      <PageBreak />

      {/* Page 5: Defense Analysis */}
      <DefenseAnalysis report={report} />
      <PageBreak />

      {/* Page 6: Game Control */}
      <GameControl report={report} />
      <PageBreak />

      {/* Page 7: Physical Load */}
      {availableMetrics.hasGPS && (
        <>
          <PhysicalLoad report={report} />
          <PageBreak />
        </>
      )}

      {/* Page 8: Individual Performance */}
      <IndividualPerformance report={report} />
      <PageBreak />

      {/* Consistency Warning (if issues found) */}
      {!consistencyCheck.isConsistent && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <h4 className="font-semibold text-amber-800 mb-2">Advertencias de Consistencia</h4>
          <ul className="text-sm text-amber-700 space-y-1">
            {consistencyCheck.issues.map((issue, index) => (
              <li key={index}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer with metadata */}
      <div className="text-center text-xs text-gray-500 mt-8">
        <p>Informe generado automáticamente por Orsomarso Performance Analytics</p>
        <p>Fecha de generación: {new Date(report.generatedAt).toLocaleString('es-ES')}</p>
      </div>
    </div>
  );
}

// Export individual pages for standalone use
export {
  ExecutiveCover,
  ExecutiveSummary,
  CollectiveAnalysis,
  AttackAnalysis,
  DefenseAnalysis,
  GameControl,
  PhysicalLoad,
  IndividualPerformance,
};
