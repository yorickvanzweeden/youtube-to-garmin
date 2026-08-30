import { PairDeviceForm } from "./pair-device-form";

export const dynamic = "force-dynamic";

export default function PairPage() {
  return (
    <main className="app-shell pair-shell">
      <section className="pair-card" aria-labelledby="pair-title">
        <p className="eyebrow">GARMIN DEVICE</p>
        <h1 id="pair-title">Pair your watch</h1>
        <p className="muted">
          Start pairing on your Garmin, then enter the six-digit code shown on
          the watch.
        </p>
        <PairDeviceForm />
      </section>
    </main>
  );
}
