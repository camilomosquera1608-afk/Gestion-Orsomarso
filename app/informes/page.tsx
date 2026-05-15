import Link from "next/link";
import { AppHero } from "@/components/app-hero";

const reports = [
  {
    href: "/reporte-jugador",
    title: "Informe individual",
    text: "Reporte por jugador con wellness, carga, competencia, valoraciones y GPS cuando la categoría lo registra.",
  },
  {
    href: "/informes/grupo",
    title: "Informes grupales",
    text: "Informe de todo el grupo, valoraciones y microciclo con lógica adaptada para categorías con o sin GPS.",
  },
  {
    href: "/informes/semanal",
    title: "Informe semanal",
    text: "Resumen semanal operativo y de carga para seguimiento del cuerpo técnico.",
  },
];

export default function InformesPage() {
  return (
    <div className="grid">
      <AppHero
        title="Centro de informes"
        subtitle="Reportes individuales, semanales y grupales listos para revisar o exportar en PDF."
      />
      <div className="grid grid-3">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="action-card ui-tone-blue"
          >
            <div>
              <strong>{report.title}</strong>
              <p>{report.text}</p>
              <span>Abrir</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
