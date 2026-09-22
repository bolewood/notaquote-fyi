"use client"

/**
 * Reading a share link in the browser. Share data lives after the "#", which
 * never reaches a server; older "?share=" links are read the same way. Once
 * read, the link is removed from the address bar, so a reload shows the
 * visitor's own saved choices instead of re-applying someone else's.
 */
import { useEffect, useSyncExternalStore } from "react"
import { decodeShareSearch, shareFromLocation, type ShareDecode } from "./share-link"

const noop = () => () => {}

/** False on the server and during hydration, true once the page runs in the browser. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}

/** The share link in the current address, if any. Call only in the browser. */
export function readShareArrival(): ShareDecode {
  const found = shareFromLocation(window.location.hash, window.location.search)
  return found ? decodeShareSearch(found.text) : { status: "absent" }
}

/** Remove a share link from the address bar once the page has read it. */
export function useClearShareFromAddress(present: boolean): void {
  useEffect(() => {
    if (!present) return
    window.history.replaceState(window.history.state, "", window.location.pathname)
  }, [present])
}
