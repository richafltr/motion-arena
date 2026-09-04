type ScoreDisplayProps = {
  label: string;
  value: number;
  accent?: boolean;
};

export function ScoreDisplay({ label, value, accent = false }: ScoreDisplayProps) {
  return (
    <div className={`score-display${accent ? ' score-display--accent' : ''}`}>
      <span>{label}</span>
      <strong>{value.toFixed(1)}</strong>
    </div>
  );
}
