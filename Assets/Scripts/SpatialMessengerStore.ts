import {AppSnapshot, AuthorizationState} from "./SpatialMessengerModels"

export type StoreListener = (snapshot: AppSnapshot) => void

/** Single source of truth for app phase, auth state, connection, errors, and chats. */
export class SpatialMessengerStore {
  private listeners: StoreListener[] = []
  private snapshot: AppSnapshot = {
    phase: "BOOT",
    authorization: {kind: "welcome"},
    connectionLabel: "Starting…",
    errorMessage: "",
    chats: [],
  }

  subscribe(listener: StoreListener): void {
    this.listeners.push(listener)
    listener(this.snapshot)
  }

  setAuthorization(state: AuthorizationState): void {
    this.snapshot.authorization = state
    this.snapshot.phase = state.kind === "ready" ? "READY" :
      state.kind === "connecting" || state.kind === "closed" ? "CONNECTING" :
      state.kind === "closing" ? "LOGGING_OUT" : "AUTH"
    this.snapshot.connectionLabel = state.kind === "ready" ? "Ready" : "Authentication"
    this.publish()
  }

  setChats(chats: AppSnapshot["chats"]): void {
    this.snapshot.chats = chats
    this.publish()
  }

  setError(message: string): void {
    this.snapshot.errorMessage = message
    this.publish()
  }

  private publish(): void {
    for (const listener of this.listeners) listener(this.snapshot)
  }
}
