const HELPLINES = [
  { number: "112", tel: "112", label: "Nujna pomoč, kadar je ogroženo življenje ali zdravje" },
  { number: "113", tel: "113", label: "Policija" },
  { number: "116 123", tel: "116123", label: "Samarijan in Sopotnik, pogovor v stiski, 24 ur na dan" },
  { number: "080 11 55", tel: "0801155", label: "SOS telefon za ženske in otroke, žrtve nasilja" },
  { number: "116 111", tel: "116111", label: "TOM, telefon za otroke in mladostnike" },
];

export function SeriousNotice({ variant }: { variant: "new" | "case" }) {
  return (
    <section className="serious" aria-labelledby="serious-title">
      <p className="kicker">Zadeva ni sprejeta</p>
      <h1 id="serious-title" className="title">
        Tega ne bomo razsojali.
      </h1>
      <p className="lede">
        {variant === "new"
          ? "Opis se dotika teme, ki je preresna za šaljivo razsodbo. Zadeve nismo shranili in povezava ni bila ustvarjena."
          : "Ena od izjav se dotika teme, ki je preresna za šaljivo razsodbo. Obe izjavi in imeni smo izbrisali. Nihče ju ne bo videl."}
      </p>
      <p>Če si ti ali kdo drug v stiski ali nevarnosti, se lahko kadarkoli obrneš na:</p>
      <ul className="helplines">
        {HELPLINES.map((h) => (
          <li key={h.tel}>
            <a href={`tel:${h.tel}`}>
              <strong>{h.number}</strong>
              <span>{h.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
