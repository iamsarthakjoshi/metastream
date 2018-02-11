const { ipcRenderer, remote } = chrome

import { Platform, ILobbyOptions, ILobbySession, ILobbyData } from 'renderer/platform/types'
import { Deferred } from 'utils/async'
import { NetUniqueId } from 'renderer/network'
import { IRTCPeerCoordinator } from 'renderer/network/rtc'
import { SwarmRTCPeerCoordinator } from 'renderer/platform/swarm/peer-coordinator';

type SwarmId = string

export class SwarmPlatform extends Platform {
  private id: NetUniqueId<SwarmId>
  private connected: boolean = false
  private isHosting: boolean = false

  constructor() {
    super()

    const swarmId = ipcRenderer.sendSync('platform-swarm-init')
    this.id = new NetUniqueId<SwarmId>(swarmId)
  }

  async createLobby(opts: ILobbyOptions): Promise<boolean> {
    // Send IPC to main with lobby options

    // idea: middleware for lobby: max members, password, auth, etc
    // do auth first so encrypted socket can be used for the rest

    ipcRenderer.send('platform-create-lobby', opts)

    const success = await new Promise<boolean>((resolve, reject) => {
      ipcRenderer.once('platform-create-lobby-result', (event: Electron.Event, result: boolean) => {
        resolve(result)
      })
    })

    this.isHosting = true
    this.connected = success
    return success
  }

  async joinLobby(id: string): Promise<boolean> {
    // should emit connection events for frontend
    // allow hash id or ipv4

    ipcRenderer.send('platform-join-lobby', id)

    const success = await new Promise<boolean>((resolve, reject) => {
      ipcRenderer.once('platform-join-lobby-result', (event: Electron.Event, result: boolean) => {
        resolve(result)
      })
    })

    this.isHosting = false
    this.connected = success
    return success
  }

  leaveLobby(id: string): boolean {
    if (!this.connected) {
      throw new Error('[Swarm Platform] Attempt to leave lobby while not connected')
    }

    // TODO: close all webrtc peers
    ipcRenderer.send('platform-leave-lobby')
    this.connected = false
    this.isHosting = false

    return true
  }

  async findLobbies(): Promise<ILobbySession[]> {
    return []
  }

  getLobbyData(): ILobbyData | null {
    return null
  }

  createPeerCoordinator(): IRTCPeerCoordinator {
    if (!this.connected) {
      throw new Error('[Swarm Platform] createPeerCoordinator: No active session.');
    }

    return new SwarmRTCPeerCoordinator(this.isHosting);
  }

  getUserName(userId: NetUniqueId): string {
    return `Swarm-${userId}`
  }

  getLocalId(): NetUniqueId {
    return this.id
  }

  async requestUserInfo(id: NetUniqueId | string): Promise<any> {}
  async requestAvatarUrl(id: NetUniqueId | string): Promise<string | void> {}
}