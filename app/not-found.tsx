import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <p className="kicker">404</p>
      <h1 className="title">Te strani ni.</h1>
      <p className="lede">Preveri povezavo ali vloži novo zadevo.</p>
      <Link href="/" className="btn btn-secondary">
        Na začetek
      </Link>
    </div>
  );
}
