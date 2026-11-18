export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`wordmark ${size}`}>
      <span className="opa">Opa</span>
      <span className="gram">Gram</span>
    </span>
  )
}
