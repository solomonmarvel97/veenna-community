import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'
export { default as ButtonGroup } from './ButtonGroup.vue'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 truncate rounded-full text-caption font-medium leading-none transition-[color,background-color,box-shadow,transform] duration-motion-fast ease-motion-standard active:scale-[0.98] focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none focus-visible:shadow-none focus-visible:transition-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 cursor-pointer focus-visible:[&_svg]:text-foreground',
  {
    variants: {
      variant: {
        default:
          'rounded-full border border-black/10 bg-primary text-primary-foreground shadow-btn-primary hover:bg-primary-hover hover:text-primary-foreground hover:shadow-btn-primary-hover active:translate-y-[0.5px] active:shadow-btn-primary-active [&_svg]:text-primary-foreground',
        destructive:
          'rounded-full border border-black/10 bg-destructive text-destructive-foreground shadow-btn-primary hover:shadow-btn-primary-hover hover:bg-destructive/90 active:translate-y-[0.5px] active:shadow-btn-primary-active',
        /** Secondary actions and dialog Cancel - light tint + softer lift than primary. */
        outline:
          'rounded-full border border-black/[0.07] bg-muted text-foreground shadow-none hover:bg-muted/80 active:scale-100 focus-visible:bg-muted/80 dark:border-black/[0.07] dark:bg-muted/55 dark:hover:bg-muted/80',
        /** Alias of `outline` for semantic use (dialog dismiss / non-destructive secondary). */
        muted:
          'rounded-full border border-black/[0.07] bg-muted text-foreground shadow-none hover:bg-muted/80 active:scale-100 focus-visible:bg-muted/80 dark:border-black/[0.07] dark:bg-muted/55 dark:hover:bg-muted/80',
        secondary:
          'rounded-full border border-black/10 bg-secondary text-secondary-foreground shadow-btn-primary hover:shadow-btn-primary-hover hover:bg-secondary/80 active:translate-y-[0.5px] active:shadow-btn-primary-active',
        inverse:
          'rounded-full border border-black/10 bg-foreground text-background shadow-btn-primary hover:shadow-btn-primary-hover hover:bg-foreground/90 active:translate-y-[0.5px] active:shadow-btn-primary-active',
        ghost: 'rounded-full hover:bg-accent hover:text-accent-foreground',
        /** Flat primary CTA (page headers, search) - tinted, no shadow / lift. */
        flat: 'rounded-full border-0 bg-primary/10 text-primary shadow-none hover:bg-primary/15 hover:text-primary hover:shadow-none active:scale-100 [&_svg]:text-primary',
        /** Flat secondary / refresh (page headers) - muted, no shadow / lift. */
        flatMuted:
          'rounded-full border-0 bg-muted text-foreground shadow-none hover:bg-muted/80 hover:shadow-none active:scale-100',
        link: 'rounded-full text-primary no-underline',
      },
      size: {
        default: 'h-7 px-3 text-caption',
        xs: 'h-7 rounded-full px-2 text-caption',
        /** Alias of default - keep for callers; do not invent a third height. */
        sm: 'h-7 rounded-full px-3 text-caption',
        lg: 'h-7 rounded-full px-4 text-caption',
        icon: 'h-7 w-7',
        'icon-sm': 'size-7',
        'icon-lg': 'size-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
