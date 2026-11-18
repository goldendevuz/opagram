import { Fragment, useState, type ReactNode } from 'react'
import type { Ent } from '../types'

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])/g

function linkify(text: string, key: string): ReactNode {
  const parts = text.split(URL_RE)
  if (parts.length === 1) return text
  return parts.map((p, i) =>
    i % 2 ? (
      <a key={`${key}${i}`} href={p} target="_blank" rel="noreferrer noopener">
        {p}
      </a>
    ) : (
      <Fragment key={`${key}${i}`}>{p}</Fragment>
    ),
  )
}

function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={`spoiler ${open ? 'open' : ''}`} onClick={() => setOpen(true)}>
      {children}
    </span>
  )
}

export function RichText({ text, entities }: { text: string; entities?: Ent[] }) {
  if (!entities?.length) return <>{linkify(text, 'p')}</>

  const cuts = new Set<number>([0, text.length])
  for (const e of entities) {
    cuts.add(Math.max(0, e.offset))
    cuts.add(Math.min(text.length, e.offset + e.length))
  }
  const points = [...cuts].sort((a, b) => a - b)

  const out: ReactNode[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [from, to] = [points[i], points[i + 1]]
    if (from === to) continue
    const slice = text.slice(from, to)
    const active = entities.filter((e) => e.offset <= from && e.offset + e.length >= to)
    const link = active.find((e) => e.type === 'link')
    let node: ReactNode = link ? slice : linkify(slice, `s${from}`)
    for (const e of active) {
      if (e.type === 'bold') node = <strong>{node}</strong>
      else if (e.type === 'italic') node = <em>{node}</em>
      else if (e.type === 'underline') node = <u>{node}</u>
      else if (e.type === 'strike') node = <s>{node}</s>
      else if (e.type === 'code') node = <code>{node}</code>
      else if (e.type === 'pre') node = <pre>{node}</pre>
      else if (e.type === 'mention') node = <span className="mention">{node}</span>
      else if (e.type === 'spoiler') node = <Spoiler>{node}</Spoiler>
    }
    if (link?.url)
      node = (
        <a href={link.url} target="_blank" rel="noreferrer noopener">
          {node}
        </a>
      )
    out.push(<Fragment key={from}>{node}</Fragment>)
  }
  return <>{out}</>
}
