/** Shared stack so nested VeennaModals (profile → crop) share body lock and Escape. */

let modalOpenCount = 0
let modalSeq = 0
const openModals = new Map<number, number>()
const openListeners = new Set<(open: boolean) => void>()

function notifyVeennaModalOpen() {
  const open = modalOpenCount > 0
  for (const listener of openListeners) listener(open)
}

export function isAnyVeennaModalOpen(): boolean {
  return modalOpenCount > 0
}

/** Fires immediately with the current state, then on every open/close. */
export function subscribeVeennaModalOpen(listener: (open: boolean) => void): () => void {
  openListeners.add(listener)
  listener(modalOpenCount > 0)
  return () => {
    openListeners.delete(listener)
  }
}

export function nextVeennaModalId(): number {
  modalSeq += 1
  return modalSeq
}

export function isTopVeennaModal(id: number): boolean {
  let topId = -1
  let topZ = Number.NEGATIVE_INFINITY
  for (const [mid, z] of openModals) {
    if (z > topZ || (z === topZ && mid > topId)) {
      topZ = z
      topId = mid
    }
  }
  return topId === id
}

export function acquireVeennaModalOpen(id: number, zIndex: number): () => void {
  modalOpenCount += 1
  openModals.set(id, zIndex)
  document.body.classList.add('veenna-modal-open')
  notifyVeennaModalOpen()
  let released = false
  return () => {
    if (released) return
    released = true
    modalOpenCount = Math.max(0, modalOpenCount - 1)
    openModals.delete(id)
    if (modalOpenCount === 0) document.body.classList.remove('veenna-modal-open')
    notifyVeennaModalOpen()
  }
}

export function setVeennaModalZIndex(id: number, zIndex: number) {
  if (openModals.has(id)) openModals.set(id, zIndex)
}
