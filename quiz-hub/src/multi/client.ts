import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, PublicRoom, ServerMessage } from '../core/protocol'

/** Multiplayer server address (Cloudflare Worker), set at build time. Null = multiplayer not configured. */
export const MP_URL: string | null = (import.meta.env.VITE_MP_URL as string | undefined)?.replace(/\/$/, '') || null

const TOKEN_KEY = 'quizhub:mp-token'
let memoryToken: string | null = null

/** Secret identifying this browser in rooms (lets you reconnect with your score). Never shown to other players. */
export function playerToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY)
    if (existing) return existing
  } catch {
    /* storage blocked: token kept in memory for this tab */
  }
  memoryToken ??= [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  try {
    localStorage.setItem(TOKEN_KEY, memoryToken)
  } catch {
    /* ignore */
  }
  return memoryToken
}

export async function createRoom(): Promise<string> {
  if (!MP_URL) throw new Error('Serveur multijoueur non configuré.')
  const res = await fetch(`${MP_URL}/rooms`, { method: 'POST' })
  const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
  if (!res.ok || !body.code) throw new Error(body.error ?? `Le serveur a répondu ${res.status}.`)
  return body.code
}

export type Status = 'connecting' | 'open' | 'reconnecting' | 'closed'

export function useRoom(code: string, name: string) {
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [you, setYou] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [fatal, setFatal] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ack, setAck] = useState<Extract<ServerMessage, { t: 'ack' }> & { at: number } | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const offset = useRef(0)
  const nameRef = useRef(name)
  useEffect(() => {
    nameRef.current = name
  }, [name])

  useEffect(() => {
    if (!MP_URL) return
    let stopped = false
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      const socket = new WebSocket(`${MP_URL.replace(/^http/, 'ws')}/rooms/${code}/ws`)
      ws.current = socket
      socket.onopen = () => {
        retry = 0
        setStatus('open')
        socket.send(JSON.stringify({ t: 'hello', token: playerToken(), name: nameRef.current } satisfies ClientMessage))
      }
      socket.onmessage = (e) => {
        if (e.data === 'pong') return
        let m: ServerMessage
        try {
          m = JSON.parse(e.data)
        } catch {
          return
        }
        if (m.t === 'welcome') setYou(m.you)
        else if (m.t === 'state') {
          offset.current = m.room.serverNow - Date.now()
          setRoom(m.room)
        } else if (m.t === 'ack') setAck({ ...m, at: Date.now() })
        else if (m.t === 'error') (m.fatal ? setFatal : setNotice)(m.msg)
      }
      socket.onclose = (e) => {
        if (stopped || e.code === 1000 || e.code >= 4000) {
          setStatus('closed')
          return
        }
        // Network hiccup: reconnect with the same token, the score is kept.
        setStatus('reconnecting')
        timer = setTimeout(connect, Math.min(10_000, 500 * 2 ** retry++))
      }
    }
    connect()
    const ping = setInterval(() => ws.current?.readyState === WebSocket.OPEN && ws.current.send('ping'), 25_000)
    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(ping)
      ws.current?.close(1000)
    }
  }, [code])

  const send = useCallback((m: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m))
  }, [])

  const serverNow = useCallback(() => Date.now() + offset.current, [])

  return { room, you, status, fatal, notice, setNotice, ack, send, serverNow }
}
