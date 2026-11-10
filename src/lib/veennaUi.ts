/**
 * veenna UI class tokens: single source for shared component styling.
 * Prefer using components in `@/components/veenna` over applying these directly.
 *
 * Overlay chrome is 16px, 20px at sm (`px-4` / `sm:px-5`). Settings rows are
 * 16×14. Compact nested cards are 12. Metric cards are 20/24. Controls are
 * h-7 px-3. Do not invent a fourth overlay gutter.
 */
import { isElectronMainWindow } from '@/lib/platform/isElectron'

const PAGE_COLUMN = 'mx-auto w-full max-w-5xl px-3 sm:px-4' as const
const PAGE_COLUMN_FULL = 'mx-auto w-full max-w-[1600px] px-2 sm:px-3' as const
const ICON_BTN =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)] disabled:pointer-events-none disabled:opacity-50' as const
/** How a menu row shows it is hovered, focused, open or chosen: brighter text, never a fill. */
const MENU_ROW_TONE =
  'text-veenna-muted transition-colors hover:text-veenna-fg focus:text-veenna-fg focus-visible:text-veenna-fg data-[highlighted]:text-veenna-fg data-[state=open]:text-veenna-fg data-[state=checked]:text-veenna-fg aria-selected:text-veenna-fg' as const
const OVERLAY_FOOTER_PAD =
  'px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-5' as const

export const veennaUi = {
  /** Sidebar menu rows: bare 16px icons, 13px text, 28px rows on desktop. */
  navRow: isElectronMainWindow ? 'gap-2 text-body-sm h-7' : 'gap-2 text-body-sm lg:h-7',
  modalShell:
    'pointer-events-auto fixed inset-0 z-[var(--veenna-z-modal)] flex items-center justify-center p-3 no-drag sm:p-4',
  modalBackdrop: 'veenna-modal-backdrop',
  modalPanel:
    'relative z-10 flex w-full flex-col overflow-hidden rounded-2xl border border-veenna-border bg-veenna-surface shadow-veenna-sm',
  /** Overlay inset: 16px, 20px at sm. Use ModalHeader/Body/Footer instead of copying. */
  overlayHeader: 'px-4 py-4 sm:px-5',
  overlayHeaderSm: 'px-4 py-2.5',
  overlayBody: 'px-4 py-4 sm:px-5',
  overlayBodyCompact: 'px-4 py-4',
  overlayFooter: OVERLAY_FOOTER_PAD,
  /** Standard modal width: 32rem (512px). sm/md share width; only max-height differs. */
  modalPanelSm: 'max-h-[min(88vh,32rem)] max-w-[var(--veenna-modal-width)]',
  modalPanelMd: 'max-h-[min(88vh,36rem)] max-w-[var(--veenna-modal-width)]',
  /** Wide modal for media grids (background picker, crop). */
  modalPanelLg:
    'max-h-[min(92vh,720px)] max-w-[var(--veenna-modal-width-wide)] sm:max-h-[min(90vh,720px)]',
  /** Near-fullscreen sheet (worker design chat, run results parity). */
  modalPanelXl:
    'h-[min(100dvh,100%)] max-h-[100dvh] w-full max-w-none rounded-none border-0 sm:h-[80vh] sm:max-h-[80vh] sm:w-[80vw] sm:max-w-[80vw] sm:rounded-2xl sm:border',

  pane: 'veenna-pane flex h-full min-h-0 flex-col no-drag',
  paneHeader: 'flex shrink-0 items-center gap-3 border-b border-veenna-divider veenna-divide px-4 py-3',
  /**
   * Chat + document/note/kb preview headers in the agent split view.
   * Fixed height so adjacent panes always line up.
   */
  agentPaneHeader:
    'draggable-region relative z-[6] flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b border-veenna-divider px-3',
  paneFooter: 'veenna-pane pane-footer flex w-full items-center gap-2 border-t veenna-divide',

  sectionHeading: 'mb-1.5 text-label font-medium text-veenna-muted',

  /** Standard page column (Insights width): max-w-5xl with tighter side padding */
  pageColumn: PAGE_COLUMN,
  pageColumnWide: PAGE_COLUMN,
  pageColumnNarrow: PAGE_COLUMN,
  /** Full-width page column for content-heavy pages like Files */
  pageColumnFull: PAGE_COLUMN_FULL,
  /** Home / Chat / Worker hero tabs share one inner width. */
  pageColumnHome: 'mx-auto w-full max-w-4xl px-3 sm:px-4',
  /** Tasks list stays centered and shrinks beside the sibling detail pane. */
  tasksListColumn:
    'mx-auto flex h-full min-h-0 w-full max-w-5xl min-w-0 flex-1 flex-col px-1.5 sm:px-2',
  pageShell:
    'veenna-page-scroll veenna-pane veenna-scroll-hidden min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto pt-[var(--veenna-main-top-padding)]',
  pageHeader: 'flex shrink-0 items-start gap-2 pb-2 pt-1 sm:pb-3 sm:pt-1.5',
  /** Extra room under title/description before page content */
  pageHeaderAfterBreadcrumb: '!pt-0 pb-3 sm:pb-4',
  pageTitle: 'heading-display text-title text-veenna-fg sm:text-page-title',
  pageSubtitle: 'mt-1 text-caption text-veenna-secondary sm:mt-1.5 sm:text-body',
  pageBody: 'veenna-page-body flex flex-col pb-8 sm:pb-12',
  pageHeroGap: 'mt-1 sm:mt-2',

  /** Scrollable region with no visible scrollbar (sidebar, drawers). */
  scrollHidden: 'veenna-scroll-hidden min-h-0 overflow-x-hidden overflow-y-auto',
  /** Horizontal tab strip: scroll without compressing labels or showing a scrollbar. */
  tabScrollTrack:
    'veenna-scroll-hidden veenna-tab-scroll-track min-w-0 overflow-x-auto overscroll-x-contain',
  /**
   * Home workers roster: two-across when the pane can hold them, otherwise keep
   * the two-across card width and scroll instead of squeezing.
   */
  homeWorkerCard: 'home-worker-card',
  /** Pill segment control (Home hero mode, settings tabs, productivity hubs). */
  segmentPillTrack:
    'inline-flex h-7 items-stretch rounded-full border border-veenna-divider bg-veenna-row p-0.5 shadow-veenna-sm',
  segmentPillTab:
    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0 text-caption font-medium leading-none whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--veenna-focus-line)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--veenna-bg)] sm:px-3',
  segmentPillTabActive: 'bg-[var(--veenna-tab-active-bg)] text-[var(--veenna-tab-active-fg)]',
  segmentPillTabInactive: 'text-veenna-muted hover:text-veenna-fg',
  /** Capsule segment control (dictation mode - matches HUD mode switcher). */
  segmentHudTrack:
    'inline-flex rounded-full border border-veenna-divider bg-veenna-row p-0.5 shadow-veenna-sm',
  segmentHudTab:
    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-label font-semibold leading-none whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--veenna-focus-line)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--veenna-bg)] sm:gap-1.5 sm:px-3 sm:text-caption',
  segmentHudTabActive: 'bg-[var(--veenna-tab-active-bg)] text-[var(--veenna-tab-active-fg)]',
  segmentHudTabInactive: 'text-veenna-muted hover:text-veenna-fg',

  /** Compact standard control height (h-7 / 28px). Prefer VeennaButton over one-off size classes. */
  btnPrimary:
    'inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-veenna-accent px-3 text-caption font-medium leading-none text-veenna-accent-fg transition-opacity hover:opacity-90 focus-visible:!shadow-none disabled:pointer-events-none disabled:opacity-50',
  btnSecondary:
    'inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-caption leading-none text-veenna-muted transition-colors hover:bg-veenna-row-hover disabled:pointer-events-none disabled:opacity-50',
  btnMuted:
    'inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-muted px-3 text-caption font-medium leading-none text-veenna-fg transition-colors hover:bg-muted/80 disabled:pointer-events-none disabled:opacity-50 dark:bg-muted/55 dark:hover:bg-muted/80',
  btnOutline:
    'inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-veenna-border px-3 text-caption leading-none text-veenna-accent transition-colors hover:bg-veenna-row disabled:pointer-events-none disabled:opacity-40',
  btnGhost:
    'inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-veenna-row-hover px-3 text-caption font-medium leading-none text-veenna-fg transition-colors hover:bg-veenna-row',
  btnDestructive:
    'inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-red-500/15 px-3 text-caption font-medium leading-none text-red-500 transition-colors hover:bg-red-500/25 disabled:pointer-events-none disabled:opacity-50',
  btnNavAction:
    'inline-flex h-7 items-center gap-1.5 text-caption font-medium leading-none text-veenna-accent transition-opacity hover:opacity-80',

  /** Spinner + label rows (loading states) */
  spinnerRow: 'inline-flex items-center gap-1',
  spinnerIcon: 'size-4 shrink-0 animate-spin',
  spinnerIconSm: 'size-3.5 shrink-0 animate-spin',

  iconBtnSm: ICON_BTN,
  iconBtnMd: ICON_BTN,
  /** Sidebar footer: bare circular settings / theme controls (icon only, no chrome). */
  sidebarFooterIconBtn:
    'flex h-7 w-7 items-center justify-center rounded-full text-veenna-icon transition-colors hover:text-veenna-fg dark:text-veenna-icon-muted dark:hover:text-veenna-icon',
  /** Destructive icon button hover (delete). Overrides iconBtn hover bg. */
  iconBtnDestructiveHover: 'hover:bg-red-500/15 hover:text-red-500',

  alertError: 'rounded-md bg-red-500/10 px-3 py-2 text-body text-red-400',
  alertSuccess:
    'rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-body text-green-700 dark:text-green-400',

  emptyState: 'px-6 py-8 text-center text-body text-veenna-muted',

  /** Business-page surfaces - keep bg-muted at /25-/45 max (never full opacity). */
  surfaceSubtle: 'rounded-xl bg-muted/30',
  surfacePanel: 'rounded-xl bg-muted/40',
  /** Inset for page / library summary panels (not settings rows, not metric tiles). */
  surfacePanelInset: 'px-4 py-4 sm:px-5 sm:py-5',
  surfaceRaised: 'rounded-xl bg-muted/50',
  surfaceList: 'overflow-hidden rounded-md border border-veenna-divider bg-card',
  surfaceEmpty: 'rounded-xl bg-muted/30 py-10',

  card: 'rounded-xl border border-veenna-border bg-veenna-surface shadow-veenna-sm',

  /** Native text fields: block layout (not flex like triggers) */
  field:
    'block w-full rounded-md border-0 bg-veenna-row px-3 py-2 text-body text-veenna-fg placeholder:text-veenna-muted transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-veenna-row-hover disabled:cursor-not-allowed disabled:opacity-50',
  /** Form controls: inputs, selects, date/time triggers */
  control:
    'flex w-full rounded-md border-0 bg-veenna-row px-3 py-2 text-body text-veenna-fg placeholder:text-veenna-muted transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-veenna-row-hover disabled:cursor-not-allowed disabled:opacity-50',
  controlTrigger:
    'flex w-full items-center rounded-md border-0 bg-veenna-row px-3 py-2 text-body text-veenna-fg transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-veenna-row-hover disabled:cursor-not-allowed disabled:opacity-50',
  popoverSurface:
    'rounded-md border border-veenna-border bg-veenna-surface text-veenna-fg shadow-veenna-sm',

  /**
   * The one compact menu standard: dropdowns, right-click menus and row popups all build from these.
   * Rows are 13px muted text with 14px icons (any svg inside is sized here, so call sites never size
   * them); the hovered, focused, open or selected row turns bright, never gets a background.
   * Rows sit 6px apart (3px each side, so it holds inside groups too);
   * the panel pads the sides and fits its rows: 11rem to 16rem wide, long rows truncate.
   * Call sites add width, alignment or colour only.
   */
  menuRow: `relative flex min-w-0 cursor-pointer select-none items-center gap-2 has-[.animate-spin]:gap-1 py-[3px] text-body-sm outline-none ${MENU_ROW_TONE} data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0`,
  /**
   * Just the colour half of menuRow, for rows too rich for a menu row (search palettes,
   * pickers in a dialog): muted until hovered, focused or active, then bright. Never a fill.
   * Pair it with `menuRowActive` on the row the keyboard is on or that is chosen.
   */
  menuRowTone: MENU_ROW_TONE,
  menuRowActive: 'text-veenna-fg',
  menuDestructive:
    'text-red-500 hover:text-red-400 focus:text-red-400 focus-visible:text-red-400 data-[highlighted]:text-red-400',
  menuLabel: 'text-caption font-normal text-veenna-muted',
  menuSeparator: '-mx-3 my-1 h-px bg-veenna-divider',
  /** Spacing for any menu panel; pair with popoverSurface. */
  menuPanel: 'w-max min-w-[11rem] max-w-[min(16rem,calc(100vw-1rem))] px-3 py-2',
  /** menuPanel's padding alone, for a list that takes its width from its field (Select). */
  menuPanelPad: 'px-3 py-2',

  /** Settings modal cards - dividers span full card width (no outer padding on card). */
  settingsCard: 'overflow-hidden rounded-md border border-veenna-divider bg-veenna-surface/60',
  settingsGroupTitle:
    'border-b border-veenna-divider px-4 py-3 text-label font-medium uppercase tracking-overline text-veenna-muted',
  /** A group title sharing its row (a badge, a Close link): the row carries the divider so it spans the card. */
  settingsGroupHeader:
    'flex items-center justify-between gap-2 border-b border-veenna-divider px-4 py-3',
  settingsGroupLabel: 'text-label font-medium uppercase tracking-overline text-veenna-muted',
  settingsRows: 'divide-y divide-veenna-divider',
  settingsRow: 'px-4 py-3.5',
  settingsInset: 'px-4 py-3.5',
} as const

export type VeennaModalSize = 'sm' | 'md' | 'lg' | 'xl'

export function modalPanelClass(size: VeennaModalSize = 'md') {
  switch (size) {
    case 'sm':
      return `${veennaUi.modalPanel} ${veennaUi.modalPanelSm}`
    case 'lg':
      return `${veennaUi.modalPanel} ${veennaUi.modalPanelLg}`
    case 'xl':
      return `${veennaUi.modalPanel} ${veennaUi.modalPanelXl}`
    default:
      return `${veennaUi.modalPanel} ${veennaUi.modalPanelMd}`
  }
}
