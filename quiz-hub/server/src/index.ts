// Quiz Hub multiplayer server: one Durable Object per room, WebSockets with hibernation.
// All game rules live in ../../src/core/room.ts (shared with the website and unit-tested).
import { DurableObject } from 'cloudflare:workers'
import { content } from '../../src/content/index.ts'
import { CODE_ALPHABET, CODE_LENGTH, isRoomCode, type ClientMessage, type ServerMessage } from '../../src/core/protocol.ts'
import { Room, createRoom, type RoomData } from '../../src/core/room.ts'

interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>
  ALLOWED_ORIGINS: string
}

/** Rooms without any connection are deleted after this delay. */
const IDLE_MS = 2 * 60 * 60 * 1000
const MAX_MESSAGE = 4096
/** Per socket: at most 40 messages per 5 seconds. */
const RATE_WINDOW = 5000
const RATE_MAX = 40

const randomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function corsHeaders(origin: string): Record<string, string> {
  return origin
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {}
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin') ?? ''
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    // Browsers always send Origin on cross-site requests and WebSocket upgrades: other sites cannot use the server.
    if (origin && !allowed.includes(origin)) return new Response('Origin not allowed', { status: 403 })
    const headers = corsHeaders(origin)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

    if (url.pathname === '/' && req.method === 'GET') return Response.json({ ok: true, service: 'quiz-hub-multi' }, { headers })

    if (url.pathname === '/rooms' && req.method === 'POST') {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomCode()
        const res = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(`https://room/init?code=${code}`, { method: 'POST' })
        if (res.ok) return Response.json({ code }, { headers })
      }
      return Response.json({ error: 'Impossible de créer un salon, réessayez.' }, { status: 503, headers })
    }

    const m = url.pathname.match(/^\/rooms\/([A-Z0-9]+)\/ws$/)
    if (m && isRoomCode(m[1])) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426, headers })
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req)
    }
    return new Response('Not found', { status: 404, headers })
  },
}

interface Attachment {
  pid?: string
}

export class RoomObject extends DurableObject<Env> {
  /** undefined = not loaded yet (the object may have been evicted while hibernating) */
  private data: RoomData | null | undefined
  private rate = new Map<WebSocket, { start: number; n: number }>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Keep-alive pings are answered by Cloudflare without waking the object (no compute billed).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  private async load(): Promise<RoomData | null> {
    if (this.data === undefined) this.data = (await this.ctx.storage.get<RoomData>('room')) ?? null
    return this.data
  }

  private async persist(room: Room) {
    this.data = room.data
    await this.ctx.storage.put('room', room.data)
    await this.ctx.storage.setAlarm(room.nextAlarm() ?? Date.now() + IDLE_MS)
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* socket already closed */
    }
  }

  private broadcast(room: Room) {
    const state = JSON.stringify({ t: 'state', room: room.publicState(Date.now()) } satisfies ServerMessage)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(state)
      } catch {
        /* closed */
      }
    }
  }

  private socketsOf(pid: string) {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attachment | null)?.pid === pid)
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const data = await this.load()
    if (url.pathname === '/init') {
      const code = url.searchParams.get('code') ?? ''
      if (data || !isRoomCode(code)) return new Response('exists', { status: 409 })
      const room = new Room(createRoom(code, Date.now()), content)
      await this.persist(room)
      return new Response('ok')
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    if (!data) {
      this.send(server, { t: 'error', msg: 'Salon introuvable ou expiré.', fatal: true })
      server.close(4404, 'room not found')
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE) return
    const now = Date.now()
    const r = this.rate.get(ws)
    if (!r || now - r.start > RATE_WINDOW) this.rate.set(ws, { start: now, n: 1 })
    else if (++r.n > RATE_MAX) return this.send(ws, { t: 'error', msg: 'Trop de messages, ralentissez.' })

    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (typeof msg !== 'object' || msg === null || typeof msg.t !== 'string') return
    const data = await this.load()
    if (!data) return ws.close(4404, 'room not found')
    const room = new Room(data, content)
    room.tick(now)

    if (msg.t === 'hello') {
      if (typeof msg.token !== 'string' || msg.token.length < 16 || msg.token.length > 128) return ws.close(4400, 'bad token')
      const joined = room.join(await sha256(msg.token), String(msg.name ?? ''), now)
      if ('error' in joined) {
        this.send(ws, { t: 'error', msg: joined.error, fatal: true })
        return ws.close(4403, 'room full')
      }
      ws.serializeAttachment({ pid: joined.id } satisfies Attachment)
      this.send(ws, { t: 'welcome', you: joined.id })
    } else {
      const pid = (ws.deserializeAttachment() as Attachment | null)?.pid
      if (!pid) return this.send(ws, { t: 'error', msg: 'Connexion non identifiée.' })
      for (const out of room.handle(pid, msg, now, randomSeed())) {
        for (const target of this.socketsOf(out.to)) this.send(target, out.msg)
      }
      if (msg.t === 'leave') ws.close(1000, 'left')
    }
    await this.persist(room)
    this.broadcast(room)
  }

  async webSocketClose(ws: WebSocket) {
    await this.onSocketGone(ws)
  }

  async webSocketError(ws: WebSocket) {
    await this.onSocketGone(ws)
  }

  private async onSocketGone(ws: WebSocket) {
    this.rate.delete(ws)
    const pid = (ws.deserializeAttachment() as Attachment | null)?.pid
    const data = await this.load()
    if (!pid || !data) return
    // Another tab of the same player may still be connected.
    if (this.socketsOf(pid).some((s) => s !== ws && s.readyState === WebSocket.OPEN)) return
    const room = new Room(data, content)
    room.disconnect(pid, Date.now())
    await this.persist(room)
    this.broadcast(room)
  }

  async alarm() {
    const data = await this.load()
    if (!data) return
    const room = new Room(data, content)
    const now = Date.now()
    if (room.tick(now)) {
      await this.persist(room)
      this.broadcast(room)
      return
    }
    if (this.ctx.getWebSockets().length === 0 && now - data.lastActivity >= IDLE_MS) {
      // Abandoned room: free the storage.
      await this.ctx.storage.deleteAll()
      this.data = null
      return
    }
    await this.ctx.storage.setAlarm(room.nextAlarm() ?? now + IDLE_MS)
  }
}
