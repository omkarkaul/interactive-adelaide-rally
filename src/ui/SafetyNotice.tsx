export const OFFICIAL_ROUTE_URL = 'https://www.adelaiderally.com.au/route'
export const OFFICIAL_CLOSURES_URL = 'https://www.adelaiderally.com.au/road-closures'

export function SafetyNotice() {
  return (
    <aside className="safety-notice" role="note">
      <strong>Rally cars travel at speed on closed public roads.</strong> Watch only from
      organiser-signposted spectator areas, follow the directions of officials and marshals, and
      never cross a closed stage road. Closure times can change without notice.
    </aside>
  )
}

export function SourceNotice({ fetchedAt }: { fetchedAt: string | null }) {
  const captured =
    fetchedAt && fetchedAt !== 'unknown'
      ? new Date(fetchedAt).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null

  return (
    <p className="source-notice">
      This is not the official source. Route and closure data belong to the organisers and were
      captured{captured ? ` on ${captured}` : ''} from{' '}
      <a href={OFFICIAL_ROUTE_URL} target="_blank" rel="noreferrer">
        adelaiderally.com.au/route
      </a>{' '}
      and{' '}
      <a href={OFFICIAL_CLOSURES_URL} target="_blank" rel="noreferrer">
        /road-closures
      </a>
      . Always check the official pages before travelling.
    </p>
  )
}
