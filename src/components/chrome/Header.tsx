import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { SeasonSelect, type SeasonOption } from "./SeasonSelect";

/** Global header: desktop bar (logo, nav, season), or phone bar + tab row. */
export function Header({
  base,
  seasons,
  season,
  isAdmin,
}: {
  base: string;
  seasons: SeasonOption[];
  season: string;
  isAdmin: boolean;
}) {
  return (
    <>
      <header className="hidden h-[72px] shrink-0 items-center justify-between border-b border-line bg-header px-12 lg:flex">
        <Logo href="/" />
        <NavLinks base={base} variant="bar" />
        <SeasonSelect seasons={seasons} current={season} />
      </header>
      <div className="relative lg:hidden">
        <header className="flex h-[60px] items-center justify-between border-b border-line bg-header px-4">
          <Logo href="/" compact />
          <MobileMenu seasons={seasons} current={season} isAdmin={isAdmin} />
        </header>
        <NavLinks base={base} variant="tabs" />
      </div>
    </>
  );
}
