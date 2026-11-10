/** A style of an icon pack, served lazily by scripts/icon-packs-plugin.mjs. */
declare module 'virtual:icon-pack/*' {
  const chunk: { size: number; icons: Record<string, string> }
  export default chunk
}
