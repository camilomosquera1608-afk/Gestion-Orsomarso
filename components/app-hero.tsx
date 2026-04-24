export const AppHero = ({
  title,
}: {
  title: string;
  subtitle?: string;
  badgeTitle?: string;
  badgeText?: string;
}) => {
  return (
    <section className="hero hero-compact">
      <div>
        <h2>{title}</h2>
      </div>
    </section>
  );
};
